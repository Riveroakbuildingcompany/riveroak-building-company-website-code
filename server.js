const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const zlib = require('zlib');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const loadEnvFile = () => {
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  });
};

loadEnvFile();

const loadNetlifyRedirects = () => {
  const netlifyConfigPath = path.join(__dirname, 'netlify.toml');

  if (!fs.existsSync(netlifyConfigPath)) {
    return [];
  }

  try {
    const fileContents = fs.readFileSync(netlifyConfigPath, 'utf8');
    const redirectPattern = /\[\[redirects\]\]([\s\S]*?)(?=\n\s*\[|$)/g;
    const redirects = [];
    let match = redirectPattern.exec(fileContents);

    while (match) {
      const block = match[1];
      const fromMatch = block.match(/from\s*=\s*"([^"]+)"/);
      const toMatch = block.match(/to\s*=\s*"([^"]+)"/);
      const statusMatch = block.match(/status\s*=\s*(\d{3})/);

      if (fromMatch && toMatch) {
        redirects.push({
          from: fromMatch[1],
          to: toMatch[1],
          status: statusMatch ? Number(statusMatch[1]) : 301,
        });
      }

      match = redirectPattern.exec(fileContents);
    }

    return redirects;
  } catch (error) {
    console.warn('Unable to parse netlify.toml redirects. Falling back to default routing.', error);
    return [];
  }
};

const netlifyRedirects = loadNetlifyRedirects();

const normalizePathname = (value) => {
  if (!value) {
    return '/';
  }

  if (value === '/') {
    return '/';
  }

  return value.replace(/\/+$/, '') || '/';
};

const buildHtmlAliasMap = (rootDir) => {
  const aliasMap = new Map();
  const duplicates = new Set();
  const skipDirs = new Set(['node_modules', '.git']);

  const registerAlias = (key, relativePath) => {
    if (!key) {
      return;
    }

    if (duplicates.has(key)) {
      return;
    }

    if (aliasMap.has(key)) {
      aliasMap.delete(key);
      duplicates.add(key);
      return;
    }

    aliasMap.set(key, relativePath);
  };

  const walk = (currentDir, relativeBase = '') => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) {
          continue;
        }

        const nextRelative = relativeBase ? path.join(relativeBase, entry.name) : entry.name;
        walk(path.join(currentDir, entry.name), nextRelative);
        continue;
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.html')) {
        continue;
      }

      if (!relativeBase) {
        // Files in the repository root already resolve correctly.
        continue;
      }

      if (entry.name.toLowerCase() === 'index.html') {
        continue;
      }

      const relativePath = relativeBase ? path.join(relativeBase, entry.name) : entry.name;
      const basename = entry.name;
      const nameWithoutExt = basename.replace(/\.html$/i, '');

      registerAlias(basename, relativePath);
      registerAlias(nameWithoutExt, relativePath);
    }
  };

  walk(rootDir);

  return aliasMap;
};

const htmlAliasMap = buildHtmlAliasMap(__dirname);

const formatBirminghamTimestamp = (dateInput = new Date()) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  const options = {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  };

  try {
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const formatted = formatter.format(date);

    if (typeof formatter.formatToParts === 'function') {
      const parts = formatter.formatToParts(date);
      const timeZonePart = parts.find((part) => part.type === 'timeZoneName');

      if (timeZonePart && timeZonePart.value !== 'UTC') {
        return formatted;
      }
    }

    if (!formatted.includes('UTC')) {
      return formatted;
    }
  } catch (error) {
    // Ignore and fall back to manual formatting below.
  }

  const isBirminghamInDst = (targetDate) => {
    const year = targetDate.getUTCFullYear();

    const marchFirst = new Date(Date.UTC(year, 2, 1));
    const marchOffset = (7 - marchFirst.getUTCDay()) % 7;
    const secondSundayInMarch = 1 + marchOffset + 7;
    const dstStart = Date.UTC(year, 2, secondSundayInMarch, 8, 0, 0);

    const novemberFirst = new Date(Date.UTC(year, 10, 1));
    const novemberOffset = (7 - novemberFirst.getUTCDay()) % 7;
    const firstSundayInNovember = 1 + novemberOffset;
    const dstEnd = Date.UTC(year, 10, firstSundayInNovember, 7, 0, 0);

    const timestamp = targetDate.getTime();

    return timestamp >= dstStart && timestamp < dstEnd;
  };

  const isDst = isBirminghamInDst(date);
  const offsetMinutes = (isDst ? -5 : -6) * 60;
  const birminghamMillis = date.getTime() + offsetMinutes * 60 * 1000;
  const birminghamDate = new Date(birminghamMillis);

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const weekday = weekdays[birminghamDate.getUTCDay()];
  const month = months[birminghamDate.getUTCMonth()];
  const day = birminghamDate.getUTCDate();
  const year = birminghamDate.getUTCFullYear();

  const padMinutes = (value) => (value < 10 ? `0${value}` : `${value}`);
  const hours24 = birminghamDate.getUTCHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = padMinutes(birminghamDate.getUTCMinutes());
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const zone = isDst ? 'CDT' : 'CST';

  return `${weekday}, ${month} ${day}, ${year} ${hours12}:${minutes} ${period} ${zone}`;
};

const findRedirectForRequest = (pathname) => {
  const normalizedPath = normalizePathname(pathname);

  return netlifyRedirects.find((redirect) => {
    if (!redirect.from) {
      return false;
    }

    if (redirect.from.includes('*')) {
      return false;
    }

    return normalizePathname(redirect.from) === normalizedPath;
  });
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.svg',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const gzipCompression = (req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';

  if (!acceptEncoding.includes('gzip')) {
    return next();
  }

  let extension = path.extname(req.path.split('?')[0]).toLowerCase();

  if (!extension) {
    extension = '.html';
  }

  if (!COMPRESSIBLE_EXTENSIONS.has(extension)) {
    return next();
  }

  const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED });
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const originalSetHeader = res.setHeader.bind(res);

  const disallowContentLength = (name) =>
    typeof name === 'string' && name.toLowerCase() === 'content-length';

  res.setHeader('Content-Encoding', 'gzip');
  const existingVary = res.getHeader('Vary');

  if (!existingVary) {
    res.setHeader('Vary', 'Accept-Encoding');
  } else if (typeof existingVary === 'string') {
    if (!existingVary.includes('Accept-Encoding')) {
      res.setHeader('Vary', `${existingVary}, Accept-Encoding`);
    }
  } else if (Array.isArray(existingVary)) {
    if (!existingVary.some((value) => String(value).includes('Accept-Encoding'))) {
      res.setHeader('Vary', [...existingVary, 'Accept-Encoding']);
    }
  }
  res.removeHeader('Content-Length');

  res.setHeader = (name, value) => {
    if (disallowContentLength(name)) {
      return;
    }

    return originalSetHeader(name, value);
  };

  const cleanup = () => {
    gzip.destroy();
    res.write = originalWrite;
    res.end = originalEnd;
    res.setHeader = originalSetHeader;
  };

  const handleGzipError = (error) => {
    cleanup();
    res.removeHeader('Content-Encoding');
    next(error);
  };

  gzip.on('error', handleGzipError);

  gzip.on('data', (chunk) => {
    if (originalWrite(chunk) === false) {
      gzip.pause();
      res.once('drain', () => {
        gzip.resume();
      });
    }
  });

  gzip.on('end', () => {
    originalEnd();
  });

  gzip.on('drain', () => {
    res.emit('drain');
  });

  res.write = (chunk, encoding, callback) => {
    return gzip.write(chunk, encoding, callback);
  };

  res.end = (chunk, encoding, callback) => {
    return gzip.end(chunk, encoding, callback);
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);

  next();
};

app.use(gzipCompression);

const staticAssetCacheControl = (res, filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache');
    return;
  }

  if (ext === '.yaml' || ext === '.yml') {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return;
  }

  if (ext === '.json') {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=300');
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
};

app.use(
  express.static(__dirname, {
    maxAge: '30d',
    setHeaders: staticAssetCacheControl,
    redirect: false,
  })
);

const buildTransportOptions = () => {
  const baseOptions = {};

  if (process.env.MAIL_HOST) {
    baseOptions.host = process.env.MAIL_HOST;
  }

  if (process.env.MAIL_PORT) {
    baseOptions.port = Number(process.env.MAIL_PORT);
  }

  if (process.env.MAIL_SECURE) {
    baseOptions.secure = process.env.MAIL_SECURE === 'true';
  }

  if (process.env.MAIL_SERVICE && !process.env.MAIL_HOST) {
    baseOptions.service = process.env.MAIL_SERVICE;
  }

  if (process.env.MAIL_USER && process.env.MAIL_PASS) {
    baseOptions.auth = {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    };
  }

  return baseOptions;
};

const transportOptions = buildTransportOptions();

if (!Object.keys(transportOptions).length) {
  console.warn('Email transport options are empty. Provide SMTP or service credentials in the environment.');
}

let transporter = null;
let transporterVerified = false;
let transporterVerificationError = null;
let transporterReady = Promise.resolve();

if (Object.keys(transportOptions).length) {
  transporter = nodemailer.createTransport(transportOptions);
  transporterReady = transporter
    .verify()
    .then(() => {
      transporterVerified = true;
      console.log('Email transport verified successfully.');
    })
    .catch((error) => {
      transporterVerificationError = error;
      console.warn(
        'Email transport verification failed:',
        error.message,
        'Continuing and relying on sendMail().'
      );
    });
}

const getContactSettings = () => ({
  recipient: process.env.CONTACT_RECIPIENT || process.env.MAIL_TO || process.env.MAIL_USER || '',
  subject: process.env.CONTACT_SUBJECT || 'Website contact submission',
});

let recipientFallbackWarningLogged = false;

app.post('/api/contact', async (req, res) => {
  const body = req.body || {};
  const isJsonRequest = Boolean(
    req.headers['content-type'] && req.headers['content-type'].includes('application/json')
  );
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const projectLocationRaw =
    (typeof body.projectLocation === 'string' && body.projectLocation) ||
    (typeof body['project-location'] === 'string' && body['project-location']) ||
    '';
  const projectLocation = projectLocationRaw.trim();
  const project = typeof body.project === 'string' ? body.project.trim() : '';

  if (!name || !email || !project) {
    const errorPayload = {
      error: 'Please provide your name, email, and project vision so we can respond.',
    };

    if (isJsonRequest) {
      return res.status(400).json(errorPayload);
    }

    return res.redirect(303, '/contact.html?status=error');
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    const errorPayload = {
      error: 'Please provide a valid email address so we can follow up.',
    };

    if (isJsonRequest) {
      return res.status(400).json(errorPayload);
    }

    return res.redirect(303, '/contact.html?status=error');
  }

  const messageLines = [
    'You have a new contact submission from the Riveroak Building Company website.',
    '',
    'Submission Details',
    '--------------------',
    `Submitted at: ${formatBirminghamTimestamp()} (Birmingham, AL)`,
    '',
    'Contact Information',
    '--------------------',
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || 'Not provided'}`,
    '',
    'Project Details',
    '--------------------',
    `Location: ${projectLocation || 'Not provided'}`,
    '',
    'Vision Summary',
    '--------------------',
    project,
    '',
    '---',
    '',
    'Reply directly to this email to respond to the prospective client.',
  ];

  const { recipient: contactRecipient, subject: contactSubject } = getContactSettings();

  if (!process.env.CONTACT_RECIPIENT && process.env.MAIL_USER && !recipientFallbackWarningLogged) {
    console.warn('CONTACT_RECIPIENT not set; falling back to MAIL_USER for delivery.');
    recipientFallbackWarningLogged = true;
  }

  await transporterReady.catch(() => {});

  if (!transporter || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.error('MAIL_USER and MAIL_PASS must be configured before sending emails.');
    const errorPayload = {
      error: 'Email service is not configured. Please reach out directly while we resolve this.',
    };

    if (isJsonRequest) {
      return res.status(500).json(errorPayload);
    }

    return res.redirect(303, '/contact.html?status=error');
  }

  if (transporterVerificationError && !transporterVerified) {
    const authFailed =
      transporterVerificationError.code === 'EAUTH' ||
      transporterVerificationError.responseCode === 535;

    if (authFailed) {
      console.error('Email transport authentication failed. Check SMTP username/password.');
      const errorPayload = {
        error: 'Email service is temporarily unavailable. Please reach out directly while we resolve this.',
      };

      if (isJsonRequest) {
        return res.status(500).json(errorPayload);
      }

      return res.redirect(303, '/contact.html?status=error');
    }

    console.warn('Email transport verification did not complete successfully. Attempting to send message anyway.');
  }

  if (!contactRecipient) {
    console.error(
      'CONTACT_RECIPIENT must be configured (or MAIL_USER provided for fallback) before sending emails.'
    );
    const errorPayload = {
      error: 'Email service is not configured. Please reach out directly while we resolve this.',
    };

    if (isJsonRequest) {
      return res.status(500).json(errorPayload);
    }

    return res.redirect(303, '/contact.html?status=error');
  }

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER || 'no-reply@riveroakbuilding.com',
      to: contactRecipient,
      subject: `${contactSubject} – ${name}`,
      text: messageLines.join('\n'),
      replyTo: email,
    });
    console.log('Contact submission delivered from %s to %s.', email || 'unknown sender', contactRecipient);
    const successPayload = {
      message: 'Thank you for reaching out. We will contact you shortly to schedule a consultation.',
    };

    if (isJsonRequest) {
      return res.json(successPayload);
    }

    return res.redirect(303, '/contact.html?status=success');
  } catch (error) {
    console.error('Error sending contact form submission:', error);
    const failurePayload = {
      error: 'We could not send your message right now. Please try again or reach out directly.',
    };

    if (isJsonRequest) {
      return res.status(500).json(failurePayload);
    }

    return res.redirect(303, '/contact.html?status=error');
  }
});

app.use((req, res, next) => {
  const isReadRequest = req.method === 'GET' || req.method === 'HEAD';

  if (!isReadRequest || req.path.startsWith('/api')) {
    return next();
  }

  const redirect = findRedirectForRequest(req.path);

  if (redirect) {
    if (redirect.status >= 300 && redirect.status < 400) {
      return res.redirect(redirect.status, redirect.to);
    }

    const target = redirect.to.startsWith('/') ? redirect.to.slice(1) : redirect.to;
    const targetPath = path.join(__dirname, target);

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      return res.sendFile(targetPath);
    }
  }

  if (normalizePathname(req.path) === '/') {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }

  const normalizedPath = normalizePathname(req.path);
  const trimmedPath = normalizedPath.replace(/^\//, '');

  if (trimmedPath) {
    const aliasKeys = new Set();

    aliasKeys.add(trimmedPath);

    if (trimmedPath.endsWith('.html')) {
      aliasKeys.add(trimmedPath.replace(/\.html$/i, ''));
    } else {
      aliasKeys.add(`${trimmedPath}.html`);
    }

    for (const key of aliasKeys) {
      const aliasTarget = htmlAliasMap.get(key);

      if (aliasTarget) {
        const aliasPath = path.join(__dirname, aliasTarget);

        if (fs.existsSync(aliasPath) && fs.statSync(aliasPath).isFile()) {
          return res.sendFile(aliasPath);
        }
      }
    }
  }

  const candidateName =
    trimmedPath && trimmedPath.endsWith('.html') ? trimmedPath : `${trimmedPath}.html`;
  const candidatePath = path.join(__dirname, candidateName);

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return res.sendFile(candidatePath);
  }

  const notFoundPath = path.join(__dirname, '404.html');

  if (fs.existsSync(notFoundPath) && fs.statSync(notFoundPath).isFile()) {
    return res.status(404).sendFile(notFoundPath);
  }

  return res.status(404).send('Not Found');
});

app.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`Riveroak site running on http://${displayHost}:${PORT}`);
});
