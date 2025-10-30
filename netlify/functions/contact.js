const nodemailer = require('nodemailer');

const buildTransportOptions = () => {
  const options = {};

  if (process.env.MAIL_HOST) {
    options.host = process.env.MAIL_HOST;
  }

  if (process.env.MAIL_PORT) {
    options.port = Number(process.env.MAIL_PORT);
  }

  if (process.env.MAIL_SECURE) {
    options.secure = process.env.MAIL_SECURE === 'true';
  }

  if (process.env.MAIL_SERVICE && !process.env.MAIL_HOST) {
    options.service = process.env.MAIL_SERVICE;
  }

  if (process.env.MAIL_USER && process.env.MAIL_PASS) {
    options.auth = {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    };
  }

  return options;
};

const transportOptions = buildTransportOptions();

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
} else {
  console.warn('Email transport options are empty. Provide SMTP or service credentials.');
}

const getContactSettings = () => ({
  recipient: process.env.CONTACT_RECIPIENT || process.env.MAIL_TO || process.env.MAIL_USER || '',
  subject: process.env.CONTACT_SUBJECT || 'Website contact submission',
});

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

let recipientFallbackWarningLogged = false;

const decodeBody = (body, isBase64Encoded) => {
  if (!body) {
    return '';
  }

  if (!isBase64Encoded) {
    return body;
  }

  return Buffer.from(body, 'base64').toString('utf8');
};

const parseRequestBody = (event) => {
  const headers = event.headers || {};
  const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
  const rawBody = decodeBody(event.body, event.isBase64Encoded);

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody || '{}');
    } catch (error) {
      return {};
    }
  }

  const params = new URLSearchParams(rawBody);
  const parsed = {};

  for (const [key, value] of params.entries()) {
    parsed[key] = value;
  }

  return parsed;
};

const buildResponse = (statusCode, payload, isJsonRequest, redirectStatus) => {
  if (isJsonRequest) {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(payload),
    };
  }

  const status = redirectStatus || (statusCode >= 200 && statusCode < 300 ? 'success' : 'error');

  return {
    statusCode: 303,
    headers: {
      Location: `/contact.html?status=${status}`,
      'Cache-Control': 'no-store',
    },
    body: '',
  };
};

const validateRequest = ({ name, email, project }) => {
  const errors = [];

  if (!name) {
    errors.push('name');
  }

  if (!email) {
    errors.push('email');
  }

  if (!project) {
    errors.push('project');
  }

  if (!errors.length) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return {
        error: 'Please provide a valid email address so we can follow up.',
      };
    }

    return null;
  }

  return {
    error: 'Please provide your name, email, and project vision so we can respond.',
  };
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { Allow: 'POST' },
      body: 'Method Not Allowed',
    };
  }

  const headers = event.headers || {};
  const isJsonRequest = (headers['content-type'] || headers['Content-Type'] || '').includes('application/json');
  const body = parseRequestBody(event);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const projectLocationRaw =
    (typeof body.projectLocation === 'string' && body.projectLocation) ||
    (typeof body['project-location'] === 'string' && body['project-location']) ||
    '';
  const projectLocation = projectLocationRaw.trim();
  const project = typeof body.project === 'string' ? body.project.trim() : '';

  const validationError = validateRequest({ name, email, project });

  if (validationError) {
    return buildResponse(400, validationError, isJsonRequest, 'error');
  }

  const { recipient: contactRecipient, subject: contactSubject } = getContactSettings();

  if (!process.env.CONTACT_RECIPIENT && process.env.MAIL_USER && !recipientFallbackWarningLogged) {
    console.warn('CONTACT_RECIPIENT not set; falling back to MAIL_USER for delivery.');
    recipientFallbackWarningLogged = true;
  }

  await transporterReady.catch(() => {});

  if (!transporter || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.error('Email transport is not configured. Provide MAIL_USER and MAIL_PASS.');

    return buildResponse(
      500,
      {
        error: 'Email service is not configured. Please reach out directly while we resolve this.',
      },
      isJsonRequest,
      'error'
    );
  }

  if (transporterVerificationError && !transporterVerified) {
    const authFailed =
      transporterVerificationError.code === 'EAUTH' ||
      transporterVerificationError.responseCode === 535;

    if (authFailed) {
      console.error('Email transport authentication failed. Check SMTP username/password.');

      return buildResponse(
        500,
        {
          error: 'Email service is temporarily unavailable. Please reach out directly while we resolve this.',
        },
        isJsonRequest,
        'error'
      );
    }

    console.warn(
      'Email transport verification did not complete successfully. Attempting to send message anyway.'
    );
  }

  if (!contactRecipient) {
    console.error(
      'CONTACT_RECIPIENT is not configured (and no MAIL_USER fallback was provided). Set the destination inbox in the environment.'
    );

    return buildResponse(
      500,
      {
        error: 'Email service is not configured. Please reach out directly while we resolve this.',
      },
      isJsonRequest,
      'error'
    );
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

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER || 'no-reply@riveroakbuilding.com',
      to: contactRecipient,
      replyTo: email,
      subject: `${contactSubject} – ${name}`,
      text: messageLines.join('\n'),
    });

    console.log(
      'Contact submission delivered from %s to %s.',
      email || 'unknown sender',
      contactRecipient
    );

    return buildResponse(
      200,
      {
        message: 'Thank you for reaching out. We will contact you shortly to schedule a consultation.',
      },
      isJsonRequest,
      'success'
    );
  } catch (error) {
    console.error('Error sending contact form submission:', error);

    return buildResponse(
      500,
      {
        error: 'We could not send your message right now. Please try again or reach out directly.',
      },
      isJsonRequest,
      'error'
    );
  }
};
