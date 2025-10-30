// ========================= Global Navigation (Desktop) =========================
// Controls the standard navigation toggle used on secondary page templates.
const navToggle = document.querySelector('.nav-toggle');
const primaryNav = document.querySelector('.primary-nav');
const homeHeader = document.querySelector('.home-header');

if (navToggle && primaryNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.classList.toggle('open');
    primaryNav.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  primaryNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('open');
      primaryNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ========================= Full-Screen Home Menu =========================
// Manages the overlay navigation used on the home and primary marketing pages.
const homeMenuToggle = document.querySelector('.home-menu-toggle');
const homeMenu = document.querySelector('.home-menu');
const pageBody = document.body;
const hideHeaderPages =
  pageBody.classList.contains('about-page-body') ||
  pageBody.classList.contains('contact-page-body') ||
  pageBody.classList.contains('portfolio-page') ||
  pageBody.classList.contains('service-area-page');
const mobileHideHeaderPages =
  pageBody.classList.contains('home-page') ||
  pageBody.classList.contains('process-page');
const headerHideBreakpoint = 1024;
const mobileHeaderHideBreakpoint = 768;
// Helper to determine whether the header should collapse on scroll for the current viewport.
const canHideHeaderOnScroll = () => {
  if (hideHeaderPages && window.innerWidth <= headerHideBreakpoint) {
    return true;
  }

  if (mobileHideHeaderPages && window.innerWidth <= mobileHeaderHideBreakpoint) {
    return true;
  }

  return false;
};
let applyHeaderVisibility = null;

if (homeMenuToggle && homeMenu) {
  // Controls the mobile-friendly overlay menu experience.
  const body = document.body;

  const closeMenu = () => {
    homeMenuToggle.classList.remove('open');
    homeMenu.classList.remove('open');
    homeMenuToggle.setAttribute('aria-expanded', 'false');
    body.classList.remove('home-menu-open');
  };

  homeMenuToggle.addEventListener('click', () => {
    const isOpen = homeMenu.classList.toggle('open');
    homeMenuToggle.classList.toggle('open', isOpen);
    homeMenuToggle.setAttribute('aria-expanded', String(isOpen));
    body.classList.toggle('home-menu-open', isOpen);

    if (!homeHeader) {
      return;
    }

    if (isOpen || !canHideHeaderOnScroll()) {
      homeHeader.classList.remove('home-header--hidden');
    } else if (typeof applyHeaderVisibility === 'function') {
      applyHeaderVisibility();
    }
  });

  homeMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (event) => {
    // Provide an Escape key shortcut to close the overlay menu.
    if (event.key === 'Escape' && homeMenu.classList.contains('open')) {
      closeMenu();
    }
  });
}

// ========================= Header Visibility on Scroll =========================
// Hides the floating header on supported templates once the user scrolls past it.
if ((hideHeaderPages || mobileHideHeaderPages) && homeHeader) {
  let headerHeight = homeHeader.offsetHeight;
  let ticking = false;

  applyHeaderVisibility = () => {
    if (!canHideHeaderOnScroll()) {
      homeHeader.classList.remove('home-header--hidden');
      ticking = false;
      return;
    }

    headerHeight = homeHeader.offsetHeight;
    const shouldHideHeader = window.scrollY > headerHeight;

    homeHeader.classList.toggle('home-header--hidden', shouldHideHeader);

    ticking = false;
  };

  const requestTick = () => {
    if (!ticking) {
      window.requestAnimationFrame(applyHeaderVisibility);
      ticking = true;
    }
  };

  window.addEventListener('scroll', requestTick, { passive: true });

  window.addEventListener('resize', () => {
    headerHeight = homeHeader.offsetHeight;
    applyHeaderVisibility();
  });

  headerHeight = homeHeader.offsetHeight;
  applyHeaderVisibility();
}

// ========================= Dynamic Footer Year =========================
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// ========================= Legal Pages: Scroll to Top =========================
document.querySelectorAll('.legal-scroll-top').forEach((button) => {
  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

const footer = document.querySelector('.site-footer');

if (footer) {
  // ========================= Footer Active Link Highlight =========================
  const normalizePathname = (pathname) => {
    if (!pathname) {
      return '/';
    }

    let normalised = pathname;

    if (!normalised.startsWith('/')) {
      normalised = `/${normalised}`;
    }

    normalised = normalised.replace(/index\.html$/, '');
    normalised = normalised.replace(/\.html$/, '');

    if (normalised.length > 1 && normalised.endsWith('/')) {
      normalised = normalised.slice(0, -1);
    }

    return normalised || '/';
  };

  const currentPath = normalizePathname(window.location.pathname);

  const resolveHrefPathname = (href) => {
    try {
      return new URL(href, window.location.href).pathname;
    } catch (error) {
      return href || '/';
    }
  };

  footer.querySelectorAll('[data-footer-link]').forEach((link) => {
    const linkPath = normalizePathname(resolveHrefPathname(link.getAttribute('href')));
    const isActive = linkPath === currentPath;

    link.classList.toggle('active', isActive);
  });
}

const portfolioScrollButtons = document.querySelectorAll('.portfolio-scroll-top');

if (portfolioScrollButtons.length) {
  const scrollTopMediaQuery = window.matchMedia('(max-width: 768px)');
  const addMediaQueryListener = (mq, handler) => {
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(handler);
    }
  };
  const shouldShowScrollTop = () => scrollTopMediaQuery.matches && window.scrollY > 160;
  let ticking = false;

  const updateScrollTopVisibility = () => {
    const isVisible = shouldShowScrollTop();

    portfolioScrollButtons.forEach((button) => {
      button.classList.toggle('portfolio-scroll-top--visible', isVisible);
    });

    ticking = false;
  };

  const requestTick = () => {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollTopVisibility);
      ticking = true;
    }
  };

  window.addEventListener('scroll', requestTick, { passive: true });
  addMediaQueryListener(scrollTopMediaQuery, updateScrollTopVisibility);
  updateScrollTopVisibility();
}

const sliders = document.querySelectorAll('[data-slider]');

if (sliders.length) {
  const getGap = (track) => {
    const styles = window.getComputedStyle(track);
    const gap = styles.columnGap || styles.gap;
    const parsed = parseFloat(gap || '0');

    return Number.isNaN(parsed) ? 0 : parsed;
  };

  sliders.forEach((slider) => {
    const track = slider.querySelector('[data-slider-track]');
    const prevButton = slider.querySelector('[data-slider-prev]');
    const nextButton = slider.querySelector('[data-slider-next]');
    const items = track ? Array.from(track.querySelectorAll('.slider__item')) : [];

    if (!track || !items.length || (!prevButton && !nextButton)) {
      return;
    }

    const scrollByAmount = () => {
      const firstItem = items[0];

      if (!firstItem) {
        return track.clientWidth;
      }

      const itemWidth = firstItem.getBoundingClientRect().width;

      return itemWidth + getGap(track);
    };

    const updateButtons = () => {
      const maxScrollLeft = track.scrollWidth - track.clientWidth - 1;

      if (prevButton) {
        prevButton.disabled = track.scrollLeft <= 0;
      }

      if (nextButton) {
        nextButton.disabled = track.scrollLeft >= maxScrollLeft;
      }
    };

    if (prevButton) {
      prevButton.addEventListener('click', () => {
        track.scrollBy({ left: -scrollByAmount(), behavior: 'smooth' });
        window.requestAnimationFrame(updateButtons);
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        track.scrollBy({ left: scrollByAmount(), behavior: 'smooth' });
        window.requestAnimationFrame(updateButtons);
      });
    }

    track.addEventListener('scroll', () => {
      window.requestAnimationFrame(updateButtons);
    });

    window.addEventListener('resize', () => {
      window.requestAnimationFrame(updateButtons);
    });

    updateButtons();
  });
}
const galleryTriggers = document.querySelectorAll('[data-gallery-trigger]');

if (galleryTriggers.length) {
  const createGalleryModal = () => {
    const modal = document.createElement('div');

    modal.className = 'gallery-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="gallery-modal__dialog" role="document">
        <figure class="gallery-modal__figure">
          <div class="gallery-modal__image-wrapper">
            <button type="button" class="gallery-modal__close" data-gallery-close aria-label="Close project photo">
              <span class="gallery-modal__close-icon" aria-hidden="true"></span>
            </button>
            <div class="gallery-modal__media" data-gallery-modal-media></div>
            <button
              type="button"
              class="gallery-modal__nav gallery-modal__prev"
              data-gallery-prev
              aria-label="View previous project photo"
            >
              <span aria-hidden="true">&larr;</span>
              Previous
            </button>
            <button
              type="button"
              class="gallery-modal__nav gallery-modal__next"
              data-gallery-next
              aria-label="View next project photo"
            >
              Next
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
          <figcaption class="gallery-modal__description" data-gallery-modal-description></figcaption>
        </figure>
      </div>
    `;

    document.body.appendChild(modal);

    return modal;
  };

  const galleryModal = createGalleryModal();
  const modalMediaContainer = galleryModal.querySelector('[data-gallery-modal-media]');
  const modalDescription = galleryModal.querySelector('[data-gallery-modal-description]');
  const modalCloseButtons = galleryModal.querySelectorAll('[data-gallery-close]');
  const modalPrevButton = galleryModal.querySelector('[data-gallery-prev]');
  const modalNextButton = galleryModal.querySelector('[data-gallery-next]');
  const triggers = Array.from(galleryTriggers);
  let activeTrigger = null;
  let activeIndex = -1;
  let activeMediaElement = null;

  const resetModalMedia = () => {
    if (activeMediaElement) {
      const tagName = activeMediaElement.tagName ? activeMediaElement.tagName.toLowerCase() : '';

      if (tagName === 'video') {
        const activeVideo = activeMediaElement;

        activeVideo.pause();
        activeVideo.currentTime = 0;
        activeVideo.removeAttribute('src');
        activeVideo.removeAttribute('poster');
        activeVideo.removeAttribute('aria-label');
        activeVideo.load();
      }

      activeMediaElement.remove();
      activeMediaElement = null;
    }

    if (modalMediaContainer) {
      while (modalMediaContainer.firstChild) {
        modalMediaContainer.removeChild(modalMediaContainer.firstChild);
      }
    }
  };

  const closeModal = () => {
    if (!galleryModal.classList.contains('is-active')) {
      return;
    }

    galleryModal.classList.remove('is-active');
    galleryModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-modal-open');

    resetModalMedia();

    if (activeTrigger) {
      activeTrigger.focus();
      activeTrigger = null;
    }

    activeIndex = -1;
  };

  const openModal = (trigger) => {
    if (!trigger || !modalDescription) {
      return;
    }

    const triggerMedia = trigger.querySelector('img, video');
    const type = trigger.dataset.galleryType || (triggerMedia && triggerMedia.tagName.toLowerCase() === 'video' ? 'video' : 'image');
    const src = trigger.dataset.gallerySrc || (triggerMedia ? triggerMedia.currentSrc || triggerMedia.src : '');
    const alt = trigger.dataset.galleryAlt || trigger.getAttribute('aria-label') || (triggerMedia && triggerMedia.getAttribute('alt')) || '';
    const description = trigger.dataset.galleryDescription || '';
    const poster = trigger.dataset.galleryPoster || (triggerMedia && triggerMedia.poster ? triggerMedia.poster : '');

    resetModalMedia();

    if (!modalMediaContainer || !src) {
      return;
    }

    if (type === 'video') {
      const modalVideo = document.createElement('video');

      modalVideo.controls = true;
      modalVideo.playsInline = true;
      modalVideo.preload = 'metadata';
      modalVideo.setAttribute('controls', '');
      modalVideo.setAttribute('playsinline', '');
      modalVideo.setAttribute('preload', 'metadata');
      modalVideo.src = src;

      if (poster) {
        modalVideo.poster = poster;
      }

      if (alt) {
        modalVideo.setAttribute('aria-label', alt);
      }

      modalMediaContainer.appendChild(modalVideo);
      activeMediaElement = modalVideo;

      modalVideo.load();

      const playPromise = modalVideo.play();

      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Ignore autoplay errors caused by browser policies.
        });
      }
    } else {
      const modalImage = document.createElement('img');

      modalImage.src = src;
      modalImage.alt = alt;
      modalImage.decoding = 'async';
      modalImage.loading = 'eager';

      modalMediaContainer.appendChild(modalImage);
      activeMediaElement = modalImage;
    }

    modalDescription.textContent = description;

    galleryModal.classList.add('is-active');
    galleryModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-modal-open');
    activeTrigger = trigger;
    activeIndex = triggers.indexOf(trigger);

    const firstCloseButton = modalCloseButtons[0];

    if (firstCloseButton) {
      firstCloseButton.focus();
    }
  };

  const showNextImage = () => {
    if (triggers.length <= 1 || activeIndex === -1) {
      return;
    }

    const nextIndex = (activeIndex + 1) % triggers.length;
    const nextTrigger = triggers[nextIndex];

    if (nextTrigger) {
      openModal(nextTrigger);

      if (modalNextButton && !modalNextButton.disabled && !modalNextButton.hidden) {
        modalNextButton.focus();
      }
    }
  };

  const showPreviousImage = () => {
    if (triggers.length <= 1 || activeIndex === -1) {
      return;
    }

    const previousIndex = (activeIndex - 1 + triggers.length) % triggers.length;
    const previousTrigger = triggers[previousIndex];

    if (previousTrigger) {
      openModal(previousTrigger);

      if (modalPrevButton && !modalPrevButton.disabled && !modalPrevButton.hidden) {
        modalPrevButton.focus();
      }
    }
  };

  modalCloseButtons.forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  galleryModal.addEventListener('click', (event) => {
    if (event.target === galleryModal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
    } else if (event.key === 'ArrowRight' && galleryModal.classList.contains('is-active')) {
      event.preventDefault();
      showNextImage();
    } else if (event.key === 'ArrowLeft' && galleryModal.classList.contains('is-active')) {
      event.preventDefault();
      showPreviousImage();
    }
  });

  const prepareTrigger = (trigger) => {
    const media = trigger.querySelector('img, video');
    const figure = trigger.closest('figure');
    const caption = figure ? figure.querySelector('figcaption') : null;

    if (media) {
      if (!trigger.dataset.gallerySrc) {
        trigger.dataset.gallerySrc = media.currentSrc || media.src || '';
      }

      if (!trigger.dataset.galleryAlt) {
        if (media.tagName.toLowerCase() === 'img' && media.alt) {
          trigger.dataset.galleryAlt = media.alt;
        } else if (trigger.getAttribute('aria-label')) {
          trigger.dataset.galleryAlt = trigger.getAttribute('aria-label');
        }
      }

      if (media.tagName.toLowerCase() === 'video') {
        if (!trigger.dataset.galleryType) {
          trigger.dataset.galleryType = 'video';
        }

        if (!trigger.dataset.galleryPoster && media.poster) {
          trigger.dataset.galleryPoster = media.poster;
        }
      }
    }

    if (!trigger.dataset.galleryAlt && trigger.getAttribute('aria-label')) {
      trigger.dataset.galleryAlt = trigger.getAttribute('aria-label');
    }

    if (caption) {
      if (!trigger.dataset.galleryDescription) {
        trigger.dataset.galleryDescription = caption.textContent.trim();
      }

      caption.hidden = true;
    }

    trigger.addEventListener('click', () => {
      openModal(trigger);
    });
  };

  galleryTriggers.forEach(prepareTrigger);

  if (modalPrevButton) {
    modalPrevButton.addEventListener('click', showPreviousImage);
    modalPrevButton.hidden = triggers.length <= 1;
    modalPrevButton.disabled = triggers.length <= 1;
  }

  if (modalNextButton) {
    modalNextButton.addEventListener('click', showNextImage);
    modalNextButton.hidden = triggers.length <= 1;
    modalNextButton.disabled = triggers.length <= 1;
  }
}

const heroSlides = document.querySelectorAll('.hero-slide');

if (heroSlides.length > 1) {
  let currentSlide = 0;

  setInterval(() => {
    heroSlides[currentSlide].classList.remove('is-active');
    currentSlide = (currentSlide + 1) % heroSlides.length;
    heroSlides[currentSlide].classList.add('is-active');
  }, 6000);
}

