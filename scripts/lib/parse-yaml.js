const BLOCK_FOLDED = new Set(['>', '>-', '>+']);
const BLOCK_LITERAL = new Set(['|', '|-', '|+']);

function parseYaml(content) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  let index = 0;
  const root = {};
  const stack = [{ indent: -1, type: 'object', value: root }];

  while (index < lines.length) {
    const rawLine = lines[index];
    if (rawLine == null) {
      index += 1;
      continue;
    }

    if (/^\s*(#.*)?$/.test(rawLine)) {
      index += 1;
      continue;
    }

    const indent = countIndent(rawLine);
    const trimmed = rawLine.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const ctx = stack[stack.length - 1];

    if (trimmed.startsWith('- ')) {
      if (ctx.type !== 'array') {
        throw new Error(`Unexpected list item at line ${index + 1}`);
      }
      index = processListItem(lines, index, indent, ctx, stack);
      continue;
    }

    if (ctx.type !== 'object') {
      throw new Error(`Expected array item at line ${index + 1}`);
    }

    index = processKeyValue(lines, index, indent, ctx, stack);
  }

  return root;
}

function processKeyValue(lines, index, indent, ctx, stack) {
  const line = lines[index];
  const trimmed = line.trim();
  const colonIndex = trimmed.indexOf(':');

  if (colonIndex === -1) {
    throw new Error(`Invalid mapping entry at line ${index + 1}`);
  }

  const key = trimmed.slice(0, colonIndex).trim();
  let valuePart = trimmed.slice(colonIndex + 1).trim();

  if (BLOCK_FOLDED.has(valuePart) || BLOCK_LITERAL.has(valuePart)) {
    const { value, nextIndex } = readBlockScalar(lines, index + 1, indent + 2, valuePart);
    ctx.value[key] = value;
    return nextIndex;
  }

  if (valuePart === '' || valuePart === null) {
    const lookahead = findNextContentLine(lines, index + 1);
    if (!lookahead || lookahead.indent <= indent) {
      ctx.value[key] = null;
      return index + 1;
    }

    if (lookahead.trimmed.startsWith('- ')) {
      const arr = [];
      ctx.value[key] = arr;
      stack.push({ indent, type: 'array', value: arr });
    } else {
      const obj = {};
      ctx.value[key] = obj;
      stack.push({ indent, type: 'object', value: obj });
    }

    return index + 1;
  }

  ctx.value[key] = parseScalar(valuePart);
  return index + 1;
}

function processListItem(lines, index, indent, ctx, stack) {
  const line = lines[index];
  const trimmed = line.trim();
  let valuePart = trimmed.slice(2).trim();

  if (BLOCK_FOLDED.has(valuePart) || BLOCK_LITERAL.has(valuePart)) {
    const { value, nextIndex } = readBlockScalar(lines, index + 1, indent + 2, valuePart);
    ctx.value.push(value);
    return nextIndex;
  }

  if (valuePart === '' || valuePart === null) {
    const lookahead = findNextContentLine(lines, index + 1);
    if (!lookahead || lookahead.indent <= indent) {
      ctx.value.push(null);
      return index + 1;
    }

    if (lookahead.trimmed.startsWith('- ')) {
      const arr = [];
      ctx.value.push(arr);
      stack.push({ indent, type: 'array', value: arr });
    } else {
      const obj = {};
      ctx.value.push(obj);
      stack.push({ indent, type: 'object', value: obj });
    }

    return index + 1;
  }

  const colonIndex = valuePart.indexOf(':');
  if (colonIndex !== -1) {
    const key = valuePart.slice(0, colonIndex).trim();
    let rest = valuePart.slice(colonIndex + 1).trim();
    const obj = {};
    ctx.value.push(obj);

    if (BLOCK_FOLDED.has(rest) || BLOCK_LITERAL.has(rest)) {
      const { value, nextIndex } = readBlockScalar(lines, index + 1, indent + 2, rest);
      obj[key] = value;
      stack.push({ indent, type: 'object', value: obj });
      return nextIndex;
    }

    if (rest === '' || rest === null) {
      const lookahead = findNextContentLine(lines, index + 1);
      if (!lookahead || lookahead.indent <= indent) {
        obj[key] = null;
      } else if (lookahead.trimmed.startsWith('- ')) {
        obj[key] = [];
        stack.push({ indent, type: 'object', value: obj });
        stack.push({ indent: indent + 2, type: 'array', value: obj[key] });
        return index + 1;
      } else {
        obj[key] = {};
        stack.push({ indent, type: 'object', value: obj });
        stack.push({ indent: indent + 2, type: 'object', value: obj[key] });
        return index + 1;
      }
    } else {
      obj[key] = parseScalar(rest);
    }

    stack.push({ indent, type: 'object', value: obj });
    return index + 1;
  }

  ctx.value.push(parseScalar(valuePart));
  return index + 1;
}

function findNextContentLine(lines, startIndex) {
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (line == null) continue;
    if (/^\s*(#.*)?$/.test(line)) continue;
    return {
      index: i,
      indent: countIndent(line),
      trimmed: line.trim(),
    };
  }
  return null;
}

function readBlockScalar(lines, startIndex, contentIndent, style) {
  const collected = [];
  let i = startIndex;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (line == null) break;
    const indent = countIndent(line);
    if (indent < contentIndent && line.trim() !== '') {
      break;
    }

    if (indent < contentIndent) {
      collected.push('');
      continue;
    }

    collected.push(line.slice(contentIndent));
  }

  let value;
  if (BLOCK_LITERAL.has(style)) {
    value = collected.join('\n');
  } else {
    value = foldLines(collected);
  }

  return { value, nextIndex: i };
}

function foldLines(lines) {
  const parts = [];
  let pendingSpace = false;

  lines.forEach((line) => {
    if (line.trim() === '') {
      if (parts.length && parts[parts.length - 1] !== '\n') {
        parts.push('\n');
      }
      pendingSpace = false;
      return;
    }

    const segment = line.trim();
    if (parts.length && parts[parts.length - 1] !== '\n') {
      if (pendingSpace) {
        parts.push(' ');
      }
    }
    parts.push(segment);
    pendingSpace = true;
  });

  return parts.join('');
}

function parseScalar(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(value)) {
    return Number(value);
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    const quote = value[0];
    let inner = value.slice(1, -1);
    if (quote === '"') {
      inner = inner.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    } else {
      inner = inner.replace(/''/g, "'");
    }
    return inner;
  }

  return value;
}

function countIndent(line) {
  let count = 0;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === ' ') {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

module.exports = { parseYaml };
