const fs = require('fs');
const path = require('path');

function stripInlineComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === '#' && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

function countIndent(line) {
  let count = 0;
  while (count < line.length && line[count] === ' ') {
    count++;
  }
  if (count < line.length && line[count] === '\t') {
    throw new Error('Tabs are not supported in YAML indentation');
  }
  return count;
}

function peekNext(lines, startIndex) {
  for (let i = startIndex + 1; i < lines.length; i++) {
    let candidate = stripInlineComment(lines[i]).trimEnd();
    if (candidate.trim() === '') continue;
    const indent = countIndent(candidate);
    return { indent, trimmed: candidate.trim() };
  }
  return null;
}

function parseInline(str) {
  let jsonLike = str;
  jsonLike = jsonLike.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_\-]*)(?=\s*:)/g, '$1"$2"');
  jsonLike = jsonLike.replace(/(:\s*)([A-Za-z_][A-Za-z0-9_\-]*)(?=[,}\]])/g, (_m, prefix, value) => {
    if (/^(true|false|null)$/i.test(value)) return prefix + value.toLowerCase();
    if (/^-?\d+(?:\.\d+)?$/.test(value)) return prefix + value;
    return prefix + '"' + value + '"';
  });
  jsonLike = jsonLike.replace(/([\[,]\s*)([A-Za-z_][A-Za-z0-9_\-]*)(?=[,\]])/g, (_m, prefix, value) => {
    if (/^(true|false|null)$/i.test(value)) return prefix + value.toLowerCase();
    if (/^-?\d+(?:\.\d+)?$/.test(value)) return prefix + value;
    return prefix + '"' + value + '"';
  });
  return JSON.parse(jsonLike);
}

function parseScalar(value) {
  if (value === '') return null;
  if (value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    const quote = value[0];
    if (quote === '"') {
      return JSON.parse(value);
    }
    return value.slice(1, -1);
  }
  if (value.startsWith('{') || value.startsWith('[')) {
    return parseInline(value);
  }
  return value;
}

function splitKeyValue(line, lineNumber) {
  const idx = line.indexOf(':');
  if (idx === -1) {
    throw new Error(`Missing ':' on line ${lineNumber}`);
  }
  const key = line.slice(0, idx).trim();
  const valuePart = line.slice(idx + 1).trim();
  return { key, valuePart };
}

function ensureObjectParent(parent, lineNumber) {
  if (!parent || parent.type !== 'object') {
    throw new Error(`Expected mapping parent on line ${lineNumber}`);
  }
}

function parseYAML(lines) {
  const root = {};
  const stack = [{ indent: -1, type: 'object', value: root }];

  for (let i = 0; i < lines.length; i++) {
    let raw = lines[i];
    raw = stripInlineComment(raw);
    if (raw.trim() === '') continue;

    const indent = countIndent(raw);
    const trimmed = raw.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (!parent) {
      throw new Error(`Invalid indentation near line ${i + 1}`);
    }

    if (trimmed.startsWith('- ')) {
      if (parent.type !== 'array') {
        throw new Error(`List item without an array parent on line ${i + 1}`);
      }
      const rest = trimmed.slice(2).trim();
      if (!rest) {
        const newObj = {};
        parent.value.push(newObj);
        stack.push({ indent, type: 'object', value: newObj });
        continue;
      }
      if (rest.startsWith('{') || rest.startsWith('[')) {
        parent.value.push(parseInline(rest));
        continue;
      }
      if (rest.includes(':')) {
        const { key, valuePart } = splitKeyValue(rest, i + 1);
        const newObj = {};
        newObj[key] = valuePart === '' ? null : parseScalar(valuePart);
        parent.value.push(newObj);
        stack.push({ indent, type: 'object', value: newObj });
        if (valuePart === '') {
          const next = peekNext(lines, i);
          const containerType = next && next.indent > indent && next.trimmed.startsWith('-') ? 'array' : 'object';
          const containerValue = containerType === 'array' ? [] : {};
          newObj[key] = containerValue;
          stack.push({ indent: indent + 1, type: containerType, value: containerValue });
        }
        continue;
      }
      parent.value.push(parseScalar(rest));
      continue;
    }

    const { key, valuePart } = splitKeyValue(trimmed, i + 1);

    if (valuePart === '') {
      ensureObjectParent(parent, i + 1);
      const next = peekNext(lines, i);
      const containerType = next && next.indent > indent && next.trimmed.startsWith('-') ? 'array' : 'object';
      const containerValue = containerType === 'array' ? [] : {};
      parent.value[key] = containerValue;
      stack.push({ indent, type: containerType, value: containerValue });
      continue;
    }

    const value = parseScalar(valuePart);
    if (parent.type === 'object') {
      parent.value[key] = value;
    } else if (parent.type === 'array') {
      const newObj = {};
      newObj[key] = value;
      parent.value.push(newObj);
    } else {
      throw new Error(`Unknown parent type near line ${i + 1}`);
    }
  }

  return root;
}

function validateConfig(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  parseYAML(text);
}

const configPath = path.join(__dirname, '..', 'admin', 'config.yml');

try {
  validateConfig(configPath);
  console.log('CMS configuration parsed successfully using JavaScript.');
} catch (err) {
  console.error('Failed to parse CMS configuration.');
  console.error(err.message);
  process.exitCode = 1;
}
