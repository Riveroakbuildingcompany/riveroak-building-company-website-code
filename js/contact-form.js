(() => {
  const contactForm = document.querySelector('.contact-form');

  if (!contactForm) {
    return;
  }

  const feedback = contactForm.querySelector('[data-contact-feedback]');
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const birminghamTimestampField = contactForm.querySelector('[data-birmingham-timestamp]');
  const defaultButtonLabel = submitButton ? submitButton.textContent.trim() : '';
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const shouldUseNetlifyForms = contactForm.hasAttribute('data-netlify');
  const useNetlifyForms = shouldUseNetlifyForms && !isLocalhost;
  const isFormSubmitEndpoint = (() => {
    const action = contactForm.getAttribute('action');

    if (!action) {
      return false;
    }

    try {
      const { hostname } = new URL(action, window.location.href);
      return hostname.endsWith('formsubmit.co');
    } catch (error) {
      console.warn('Unable to determine contact form action host.', error);
      return false;
    }
  })();

  const formatBirminghamTimestamp = (dateInput = new Date()) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

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

        if (timeZonePart && timeZonePart.value && timeZonePart.value !== 'UTC') {
          return formatted;
        }
      }

      if (!formatted.includes('UTC')) {
        return formatted;
      }
    } catch (error) {
      // Ignore and fall through to manual formatting.
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

  const updateBirminghamTimestamp = () => {
    if (!birminghamTimestampField) {
      return '';
    }

    const formatted = formatBirminghamTimestamp();
    birminghamTimestampField.value = formatted;
    return formatted;
  };

  const syncRedirectTarget = () => {
    const nextInput = contactForm.querySelector('input[name="_next"][data-relative-path]');

    if (!nextInput) {
      return;
    }

    const relativePath = nextInput.dataset.relativePath || '';

    if (!relativePath) {
      return;
    }

    const normalizedPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    const expectedUrl = `${window.location.origin}${normalizedPath}`;

    if (nextInput.value !== expectedUrl) {
      nextInput.value = expectedUrl;
    }
  };

  syncRedirectTarget();
  updateBirminghamTimestamp();

  const encodeFormData = (formData) => {
    const pairs = [];

    formData.forEach((value, key) => {
      if (typeof value === 'string') {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    });

    return pairs.join('&');
  };

  const getJsonEndpoint = () => {
    if (contactForm.dataset.endpoint) {
      return contactForm.dataset.endpoint;
    }

    if (contactForm.action && contactForm.action !== window.location.href) {
      return contactForm.action;
    }

    return '/api/contact';
  };

  const setFeedback = (message, state) => {
    if (!feedback) {
      return;
    }

    feedback.textContent = message;
    feedback.classList.remove('is-error', 'is-success');

    if (state === 'success') {
      feedback.classList.add('is-success');
    } else if (state === 'error') {
      feedback.classList.add('is-error');
    }
  };

  const resetButton = () => {
    if (!submitButton) {
      return;
    }

    submitButton.disabled = false;
    submitButton.textContent = defaultButtonLabel || 'Request a consultation';
  };

  const handleQueryFeedback = () => {
    if (!feedback) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const status = searchParams.get('status');

    if (!status) {
      return;
    }

    if (status === 'success') {
      setFeedback('Thank you for reaching out. We will be in touch soon.', 'success');
    } else if (status === 'error') {
      setFeedback('We were unable to send your message. Please try again or contact us directly.', 'error');
    }

    searchParams.delete('status');
    const newQuery = searchParams.toString();
    const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
  };

  handleQueryFeedback();

  const submitViaNetlifyForms = async (formData) => {
    if (!formData.get('form-name')) {
      const formName = contactForm.getAttribute('name') || 'contact';
      formData.set('form-name', formName);
    }

    const netlifyEndpoint = contactForm.getAttribute('action') || window.location.pathname || '/';
    const netlifyMethod = (contactForm.getAttribute('method') || 'post').toUpperCase();
    const response = await fetch(netlifyEndpoint, {
      method: netlifyMethod === 'GET' ? 'POST' : netlifyMethod,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: encodeFormData(formData),
    });

    // Netlify form submissions respond with a 303 redirect on success,
    // which fetch treats as a resolved request with a non-"ok" status.
    // Treat anything below 400 as a success so those redirects don't
    // trigger an unnecessary error message for visitors.
    if (response.status >= 400) {
      throw new Error('We could not send your message. Please try again shortly.');
    }

    return 'Thank you for reaching out. We will be in touch soon.';
  };

  const submitViaJsonEndpoint = async (payload) => {
    const response = await fetch(getJsonEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'We could not send your message. Please try again shortly.');
    }

    return result.message || 'Thank you for reaching out. We will be in touch soon.';
  };

  const submitViaFormSubmit = async (formData) => {
    const response = await fetch(contactForm.action, {
      method: (contactForm.getAttribute('method') || 'post').toUpperCase(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: encodeFormData(formData),
    });

    if (response.status >= 400) {
      throw new Error('We could not send your message. Please try again shortly.');
    }

    return 'Thank you for reaching out. We will be in touch soon.';
  };

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    setFeedback('', undefined);

    const birminghamTimestamp = updateBirminghamTimestamp();
    const formData = new FormData(contactForm);

    if (birminghamTimestamp) {
      formData.set('Submitted At (Birmingham)', birminghamTimestamp);
    }

    const getFieldValue = (...keys) => {
      for (const key of keys) {
        const rawValue = formData.get(key);

        if (typeof rawValue === 'string') {
          return rawValue.toString().trim();
        }
      }

      return '';
    };

    const payload = {
      name: getFieldValue('Full Name', 'name'),
      email: getFieldValue('Email', 'email'),
      phone: getFieldValue('Phone', 'phone'),
      projectLocation: getFieldValue('Project Location', 'project-location'),
      project: getFieldValue('Project Vision', 'project'),
      submittedAtBirmingham: birminghamTimestamp,
    };

    // "_honey" is the FormSubmit honeypot and "bot-field" remains for legacy Netlify markup.
    const honeypotValue = getFieldValue('_honey', 'bot-field');

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!payload.name || !payload.email || !payload.project) {
      setFeedback('Please share your name, email, and project vision so we can follow up.', 'error');
      return;
    }

    if (!emailPattern.test(payload.email)) {
      setFeedback('The email address you entered appears to be invalid. Please double-check it and try again.', 'error');
      return;
    }

    if (honeypotValue) {
      contactForm.reset();
      return;
    }

    if (isFormSubmitEndpoint) {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
      }

      contactForm.submit();
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
      }

      let successMessage = '';
      let netlifyError = null;

      if (useNetlifyForms) {
        try {
          successMessage = await submitViaNetlifyForms(formData);
        } catch (error) {
          netlifyError = error instanceof Error ? error : new Error(String(error));
        }
      } else {
        try {
          successMessage = await submitViaJsonEndpoint(payload);
        } catch (error) {
          if (netlifyError) {
            console.warn('Netlify form submission failed, falling back to JSON endpoint.', netlifyError);
          }

          throw error;
        }
      }

      setFeedback(successMessage, 'success');

      contactForm.reset();
    } catch (error) {
      const fallbackMessage =
        error instanceof Error
          ? error.message
          : 'We could not send your message. Please try again shortly.';

      setFeedback(fallbackMessage, 'error');
    } finally {
      resetButton();
    }
  });
})();
