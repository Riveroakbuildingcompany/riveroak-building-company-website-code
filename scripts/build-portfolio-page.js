const fs = require('fs');
const path = require('path');
const { parseYaml } = require('./lib/parse-yaml');

const args = process.argv.slice(2);
const contentDir = path.join(__dirname, '..', 'content', 'projects');
const outputDir = path.join(__dirname, '..', 'portfolio');
const repoRoot = path.join(__dirname, '..');
const relativeOutputDir = path.relative(repoRoot, outputDir) || '';
const siteBaseUrl = 'https://www.riveroakbuilding.com';

function discoverSlugs() {
  return fs
    .readdirSync(contentDir)
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => file.replace(/\.yaml$/, ''))
    .sort();
}

function loadProject(slug) {
  const projectPath = path.join(contentDir, `${slug}.yaml`);
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project data not found for slug “${slug}”. Expected ${projectPath}`);
  }

  const raw = fs.readFileSync(projectPath, 'utf8');
  const project = parseYaml(raw);

  if (!project.slug) {
    project.slug = slug;
  }

  if (project.slug !== slug) {
    console.warn(
      `Warning: content/projects/${slug}.yaml defines slug "${project.slug}". Update the filename or slug field so they match.`
    );
  }

  return project;
}

function resolveRequestedSlugs() {
  if (args.length === 0 || args.includes('--all')) {
    return discoverSlugs();
  }

  return args;
}

const requestedSlugs = resolveRequestedSlugs();

if (requestedSlugs.length === 0) {
  console.error('No projects found. Add YAML files to content/projects and rerun the build.');
  process.exit(1);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function toStrings(list, key) {
  return ensureArray(list)
    .map((item) => {
      if (item == null) return '';
      if (typeof item === 'string') return item;
      if (typeof item !== 'object') return '';
      if (key && item[key] != null) return item[key];
      if (!key) {
        if (item.value != null) return item.value;
        if (item.label != null) return item.label;
      }
      return '';
    })
    .filter((item) => item !== '');
}

function escapeAttr(value) {
  if (value == null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeForCssUrl(value) {
  if (value == null) return '';
  return String(value).replace(/'/g, "\\'");
}

function toPlainTextList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item.value != null) return item.value;
        if (typeof item === 'object' && item.label != null) return item.label;
        return '';
      })
      .filter(Boolean);
  }

  if (value == null) {
    return [];
  }

  return [String(value)];
}

function getImageMimeType(url) {
  if (!url) return '';
  const normalized = String(url).split(/[?#]/)[0];
  const ext = path.extname(normalized).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return '';
  }
}

function buildCanonicalUrl(outputFilename) {
  const trimmedBase = siteBaseUrl.replace(/\/?$/, '');
  const relativePath = relativeOutputDir
    ? `${relativeOutputDir.replace(/\\/g, '/')}/${outputFilename}`
    : outputFilename;
  return `${trimmedBase}/${relativePath}`;
}

function renderJsonLd(blocks = []) {
  const list = ensureArray(blocks).filter((block) => block && typeof block === 'object');
  if (list.length === 0) return '';

  return list
    .map((block) => `  <script type="application/ld+json">
${JSON.stringify(normalizeJsonLd(block), null, 2)
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  </script>`)
    .join('\n');
}

function normalizeJsonLd(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonLd(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, val]) => {
      let normalizedKey = key;
      if (typeof normalizedKey === 'string') {
        const quoteMatch = normalizedKey.match(/^['"](.*)['"]$/);
        if (quoteMatch) {
          normalizedKey = quoteMatch[1];
        }
      }

      acc[normalizedKey] = normalizeJsonLd(val);
      return acc;
    }, {});
  }

  return value;
}

function indentBlock(block, indent = ' ') {
  return block
    .split('\n')
    .map((line) => (line ? `${indent}${line}` : line))
    .join('\n');
}

function hasContent(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.some((item) => hasContent(item));
  if (typeof value === 'object') return Object.values(value).some((item) => hasContent(item));
  return false;
}

function renderHero(hero = {}) {
  const stats = ensureArray(hero.stats)
    .map((stat) => `
      <div class="stat-card" role="listitem">
        <span class="stat-card__label">${stat?.label || ''}</span>
        <span class="stat-card__value">${stat?.value || ''}</span>
      </div>`)
    .join('');

  const tags = toStrings(hero.tags, 'tag')
    .map((tag) => `<span class="portfolio-hero__tag">${tag}</span>`)
    .join('');

  return `<section class="portfolio-hero">
  <div class="portfolio-hero__media">
    <img src="${hero.image || ''}" alt="${hero.alt || ''}" loading="lazy">
  </div>
  <div class="portfolio-hero__overlay" aria-hidden="true"></div>
  <div class="container portfolio-hero__content">
    ${hero.eyebrow ? `<p class="eyebrow">${hero.eyebrow}</p>` : ''}
    <h1>${hero.heading || ''}</h1>
    ${hero.lede ? `<p class="portfolio-hero__lede">${hero.lede}</p>` : ''}
    ${stats ? `<div class="portfolio-hero__stats" role="list">${stats}
    </div>` : ''}
    ${tags ? `<div class="portfolio-hero__tags" aria-label="Project specialties">${tags}</div>` : ''}
  </div>
</section>`;
}

function renderSeoIntro(intro = {}) {
  const paragraphs = toStrings(intro.paragraphs, 'text')
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join('');

  const sidebar = intro.sidebar || {};
  const quickFacts = toStrings(sidebar.items, 'text')
    .map((item) => `<li>${item}</li>`)
    .join('');

  const sidebarContent = sidebar.heading || quickFacts
    ? `<aside class="project-seo-intro__sidebar" aria-label="${escapeAttr(sidebar.aria_label || 'Project quick facts')}">
      ${sidebar.heading ? `<h3>${sidebar.heading}</h3>` : ''}
      ${quickFacts ? `<ul class="project-detail-list">${quickFacts}</ul>` : ''}
    </aside>`
    : '';

  if (!intro.heading && !paragraphs && !sidebarContent) {
    return '';
  }

  return `<section class="section project-seo-intro">
  <div class="container">
    <div class="project-seo-intro__content">
      ${intro.heading ? `<h2>${intro.heading}</h2>` : ''}
      ${paragraphs}
    </div>
    ${sidebarContent}
  </div>
</section>`;
}

function renderOverview(overview = {}) {
  const paragraphs = toStrings(overview.paragraphs, 'text')
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join('');

  const detailColumns = ensureArray(overview.details)
    .map((detail) => {
      const items = toStrings(detail.items, 'text')
        .map((item) => `<li>${item}</li>`)
        .join('');
      return `<div>
        <h3>${detail.title || ''}</h3>
        <ul class="project-detail-list">${items}</ul>
      </div>`;
    })
    .join('');

  return `<section class="section project-intro">
  <div class="container project-intro__grid">
    <div class="project-overview__intro">
      ${overview.eyebrow ? `<p class="eyebrow">${overview.eyebrow}</p>` : ''}
      ${overview.heading ? `<h2>${overview.heading}</h2>` : ''}
      ${paragraphs}
    </div>

    <div class="project-overview__details">
      ${detailColumns}
    </div>
  </div>
</section>`;
}

function renderSeoBenefits(benefits = {}) {
  const columns = ensureArray(benefits.columns)
    .map((column) => {
      const items = toStrings(column.items, 'text')
        .map((item) => `<li>${item}</li>`)
        .join('');

      return `<div>
        ${column.heading ? `<h2>${column.heading}</h2>` : ''}
        ${column.body ? `<p>${column.body}</p>` : ''}
        ${items ? `<ul class="project-detail-list">${items}</ul>` : ''}
      </div>`;
    })
    .join('');

  if (!columns) {
    return '';
  }

  return `<section class="section project-seo-benefits">
  <div class="container">
    <div class="project-seo-benefits__grid">
      ${columns}
    </div>
  </div>
</section>`;
}

function renderGallery(gallery = {}) {
  const items = ensureArray(gallery.items)
    .map((item) => {
      const caption = item.caption ? `<figcaption${item.caption_hidden ? ' hidden' : ''}>${item.caption}</figcaption>` : '';
      return `<figure class="project-media__item">
        <button class="project-media__trigger" type="button" data-gallery-trigger${item.aria_label ? ` aria-label="${escapeAttr(item.aria_label)}"` : ''}>
          <img src="${item.image || ''}" alt="${item.alt || ''}" loading="lazy">
        </button>
        ${caption}
      </figure>`;
    })
    .join('');

  return `<section class="section project-media">
  <div class="container">
    <div class="project-media__header">
      ${gallery.eyebrow ? `<p class="eyebrow">${gallery.eyebrow}</p>` : ''}
      ${gallery.heading ? `<h2>${gallery.heading}</h2>` : ''}
    </div>

    <div class="project-media__gallery">
      ${items}
    </div>
  </div>
</section>`;
}

function renderVideoGallery(videoGallery = {}) {
  const videoItems = ensureArray(videoGallery.items);
  if (videoItems.length === 0) {
    return '';
  }

  const items = videoItems
    .map((item) => {
      const ariaLabel = item.aria_label || item.alt || '';
      const ariaAttr = ariaLabel ? ` aria-label="${escapeAttr(ariaLabel)}"` : '';
      const captionClass = item.caption_sr_only ? ' class="sr-only"' : '';
      const caption = item.caption ? `<figcaption${captionClass}>${item.caption}</figcaption>` : '';
      const altDataAttr = item.alt ? ` data-gallery-alt="${escapeAttr(item.alt)}"` : '';
      const posterAttr = item.poster ? ` poster="${escapeAttr(item.poster)}"` : '';
      const srcAttr = escapeAttr(item.src || '');

      return `<figure class="project-video-tile">
        <button class="project-media__trigger project-media__trigger--video project-video-tile__trigger" type="button" data-gallery-trigger data-gallery-type="video" data-gallery-src="${srcAttr}"${altDataAttr}${ariaAttr}>
          <video${posterAttr} muted playsinline webkit-playsinline preload="metadata" aria-hidden="true">
            <source src="${srcAttr}" type="video/mp4">
          </video>
          <span class="project-video-tile__icon" aria-hidden="true"></span>
        </button>
        ${caption}
      </figure>`;
    })
    .join('');

  return `<section class="section project-video-gallery">
  <div class="container">
    <div class="project-video-gallery__header">
      ${videoGallery.eyebrow ? `<p class="eyebrow">${videoGallery.eyebrow}</p>` : ''}
      ${videoGallery.heading ? `<h2>${videoGallery.heading}</h2>` : ''}
    </div>
    <div class="project-video-gallery__grid">
      ${items}
    </div>
  </div>
</section>`;
}

function renderMaterials(materials = {}) {
  const cards = ensureArray(materials.cards)
    .map((card) => `<article class="material-card">
        <h3>${card.title || ''}</h3>
        ${card.description ? `<p>${card.description}</p>` : ''}
      </article>`)
    .join('');

  return `<section class="section material-showcase">
  <div class="container">
    <div class="material-showcase__header">
      ${materials.eyebrow ? `<p class="eyebrow">${materials.eyebrow}</p>` : ''}
      ${materials.heading ? `<h2>${materials.heading}</h2>` : ''}
      ${materials.body ? `<p>${materials.body}</p>` : ''}
    </div>
    <div class="material-showcase__grid">
      ${cards}
    </div>
  </div>
</section>`;
}

function renderSeoOverview(overview = {}) {
  const paragraphs = toStrings(overview.paragraphs, 'text')
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join('');

  const sidebarItems = toStrings(overview.sidebar?.items, 'text')
    .map((item) => `<li>${item}</li>`)
    .join('');

  const sidebar = overview.sidebar && (overview.sidebar.heading || sidebarItems)
    ? `<aside class="seo-overview__sidebar" aria-label="Project quick facts">
      ${overview.sidebar.heading ? `<h3>${overview.sidebar.heading}</h3>` : ''}
      ${sidebarItems ? `<ul>${sidebarItems}</ul>` : ''}
    </aside>`
    : '';

  if (!overview.heading && !overview.eyebrow && !paragraphs && !sidebar) {
    return '';
  }

  return `<section class="section seo-overview">
  <div class="container">
    <div class="seo-overview__grid">
      <div class="seo-overview__content">
        ${overview.eyebrow ? `<p class="eyebrow">${overview.eyebrow}</p>` : ''}
        ${overview.heading ? `<h2>${overview.heading}</h2>` : ''}
        ${paragraphs}
      </div>
      ${sidebar}
    </div>
  </div>
</section>`;
}

function renderFaq(faq = {}) {
  const items = ensureArray(faq.items)
    .map((item) => `<article class="faq-item">
        ${item.question ? `<h3>${item.question}</h3>` : ''}
        ${item.answer ? `<p>${item.answer}</p>` : ''}
      </article>`)
    .join('');

  if (!faq.heading && !faq.intro && !items) {
    return '';
  }

  return `<section class="section faq-section">
  <div class="container">
    <div class="faq-section__intro">
      ${faq.heading ? `<h2>${faq.heading}</h2>` : ''}
      ${faq.intro ? `<p>${faq.intro}</p>` : ''}
    </div>
    <div class="faq-section__items">
      ${items}
    </div>
  </div>
</section>`;
}

function renderRelated(related = {}) {
  const cards = ensureArray(related.projects)
    .map((project) => {
      const meta = toStrings(project.meta, 'item')
        .map((item) => `<span>${item}</span>`)
        .join('');

      const style = project.image ? ` style="--project-image: url('${escapeForCssUrl(project.image)}');"` : '';
      const tag = project.tag ? `<span class="project-tag">${project.tag}</span>` : '';

      return `<a class="portfolio-card" href="${project.url || '#'}">
        <div class="project-image"${style}>
          ${tag}
        </div>
        <div class="project-details">
          <h3>${project.title || ''}</h3>
          ${project.summary ? `<p>${project.summary}</p>` : ''}
          <div class="project-meta">
            ${meta}
          </div>
        </div>
      </a>`;
    })
    .join('');

  return `<section class="section project-gallery">
  <div class="container">
    <div class="project-gallery__header">
      ${related.eyebrow ? `<p class="eyebrow">${related.eyebrow}</p>` : ''}
      ${related.heading ? `<h2>${related.heading}</h2>` : ''}
    </div>
    <div class="project-gallery__grid project-gallery__grid--linked">
      ${cards}
    </div>
  </div>
</section>`;
}

function renderCta(cta = {}) {
  const links = ensureArray(cta.links)
    .map((link) => {
      const attrs = [`class="${link.class || 'text-link'}"`];
      if (link.url) {
        attrs.push(`href="${link.url}"`);
      }
      return `<a ${attrs.join(' ')}>${link.label || ''}</a>`;
    })
    .join('');

  const detailItems = ensureArray(cta.details)
    .map((group) => {
      const entries = ensureArray(group.items)
        .map((entry) => {
          if (entry && entry.separator === 'text') {
            return `<span>${entry.separator_text || ''}</span>`;
          }
          if (entry && entry.separator === 'bullet') {
            return '<span aria-hidden="true">&bull;</span>';
          }

          const label = entry?.label || '';
          if (!entry?.url) {
            return `<span>${label}</span>`;
          }

          const attrs = [];
          if (entry.class) attrs.push(`class="${entry.class}"`);
          attrs.push(`href="${entry.url}"`);
          return `<a ${attrs.join(' ')}>${label}</a>`;
        })
        .join('');

      return `<div class="cta-details__item">
          <span class="cta-details__label">${group.label || ''}</span>
          <div class="cta-details__value">${entries}</div>
        </div>`;
    })
    .join('');

  return `<section class="section cta-section cta-section--luxe">
  <div class="container">
    <div class="cta-card luxe-cta">
      <div class="luxe-cta__intro">
        ${cta.eyebrow ? `<p class="eyebrow">${cta.eyebrow}</p>` : ''}
        ${cta.heading ? `<h2>${cta.heading.replace(/--/g, '&mdash;')}</h2>` : ''}
        ${cta.lede ? `<p class="luxe-cta__lede">${cta.lede}</p>` : ''}
        <div class="luxe-cta__links">${links}</div>
      </div>
      <div class="cta-details">
        ${detailItems}
      </div>
    </div>
  </div>
</section>`;
}

function renderFaq(faq = {}) {
  const items = ensureArray(faq.items)
    .map((item) => `<article class="faq-item">
        <h3>${item.question || ''}</h3>
        ${item.answer ? `<p>${item.answer}</p>` : ''}
      </article>`)
    .join('');

  if (!items) {
    return '';
  }

  return `<section class="section project-faq">
  <div class="container">
    ${faq.eyebrow ? `<p class="eyebrow">${faq.eyebrow}</p>` : ''}
    ${faq.heading ? `<h2>${faq.heading}</h2>` : ''}
    <div class="project-faq__items">
      ${items}
    </div>
  </div>
</section>`;
}

function normalizeStructuredData(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeStructuredData(entry));
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1) {
      const [key] = keys;
      const normalisedKey = key.replace(/^"|"$/g, '');
      const raw = value[key];
      if (typeof raw === 'string' && /^[-a-zA-Z0-9+.]+$/.test(normalisedKey) && raw.startsWith('//')) {
        return `${normalisedKey}:${raw}`;
      }
    }

    return keys.reduce((acc, key) => {
      const normalisedKey = key.replace(/^"|"$/g, '');
      acc[normalisedKey] = normalizeStructuredData(value[key]);
      return acc;
    }, {});
  }

  return value;
}

function renderHeadStructuredData(structuredData) {
  const entries = ensureArray(structuredData)
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const normalised = normalizeStructuredData(item);
      return `<script type="application/ld+json">\n${JSON.stringify(normalised, null, 2)}\n</script>`;
    })
    .filter(Boolean)
    .join('\n');

  return entries;
}

function renderHead(project, slug, { canonicalUrl } = {}) {
  const seo = project.seo || {};
  const title = seo.title || project.title || 'Riveroak Building Company';
  const description = seo.description || '';
  const keywords = toPlainTextList(seo.keywords).join(', ');
  const ogTitle = seo.og_title || title;
  const ogDescription = seo.og_description || description;
  const ogImage = seo.og_image || seo.social_image || '';
  const twitterImage = seo.twitter_image || seo.social_image || ogImage;
  const canonical = seo.canonical || canonicalUrl || '';
  const ogUrl = seo.url || canonical;
  const ogImageType = seo.og_image_type || (ogImage && ogImage.endsWith('.svg') ? 'image/svg+xml' : '');
  const ogImageWidth = seo.og_image_width || (ogImage ? '1200' : '');
  const ogImageHeight = seo.og_image_height || (ogImage ? '400' : '');
  const structuredData = renderHeadStructuredData(seo.structured_data || project.structured_data);

  return `<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${description ? `<meta name="description" content="${escapeAttr(description)}">` : ''}
  ${keywords ? `<meta name="keywords" content="${escapeAttr(keywords)}">` : ''}
  ${canonical ? `<link rel="canonical" href="${escapeAttr(canonical)}">` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap"
    rel="stylesheet">
  <link rel="apple-touch-icon" sizes="180x180" href="../images/Favicons/Tree-Logo-Favicon/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="../images/Favicons/Tree-Logo-Favicon/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="../images/Favicons/Tree-Logo-Favicon/favicon-16x16.png">
  <link rel="shortcut icon" href="../images/Favicons/Tree-Logo-Favicon/favicon.ico">
  <link rel="manifest" href="../images/Favicons/Tree-Logo-Favicon/site.webmanifest">
  <meta property="og:site_name" content="Riveroak Building Company">
  <meta property="og:type" content="website">
  ${title ? `<meta property="og:title" content="${escapeAttr(title)}">` : ''}
  ${description ? `<meta property="og:description" content="${escapeAttr(description)}">` : ''}
  ${ogUrl ? `<meta property="og:url" content="${escapeAttr(ogUrl)}">` : ''}
  ${ogImage ? `<meta property="og:image" content="${escapeAttr(ogImage)}">` : ''}
  ${ogImageType ? `<meta property="og:image:type" content="${escapeAttr(ogImageType)}">` : ''}
  ${ogImageWidth ? `<meta property="og:image:width" content="${escapeAttr(ogImageWidth)}">` : ''}
  ${ogImageHeight ? `<meta property="og:image:height" content="${escapeAttr(ogImageHeight)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  ${title ? `<meta name="twitter:title" content="${escapeAttr(title)}">` : ''}
  ${description ? `<meta name="twitter:description" content="${escapeAttr(description)}">` : ''}
  ${ogUrl ? `<meta name="twitter:url" content="${escapeAttr(ogUrl)}">` : ''}
  ${twitterImage ? `<meta name="twitter:image" content="${escapeAttr(twitterImage)}">` : ''}
  <link rel="stylesheet" href="../css/style.css">
  <script src="../js/main.js" defer></script>
  ${structuredData}
</head>`;
}

function renderStructuredData(project, slug) {
  const scripts = [];
  const structured = project.structured_data || {};
  const projectSchema = structured.project || {};

  if (Object.keys(projectSchema).length > 0) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': projectSchema.type || 'Project',
      name: projectSchema.name || project.title || '',
      description: projectSchema.description || project.seo?.description || '',
    };

    if (projectSchema.image) schema.image = projectSchema.image;
    if (projectSchema.url || project.seo?.canonical) {
      schema.url = projectSchema.url || project.seo?.canonical;
    } else if (projectSchema.url === '') {
      schema.url = '';
    }

    if (projectSchema.location) {
      const location = {
        '@type': projectSchema.location.type || 'Place',
        name: projectSchema.location.name || '',
      };

      if (projectSchema.location.address) {
        location.address = {
          '@type': 'PostalAddress',
          addressLocality: projectSchema.location.address.locality || '',
          addressRegion: projectSchema.location.address.region || '',
          addressCountry: projectSchema.location.address.country || '',
        };
      }

      schema.location = location;
    }

    if (projectSchema.creator) {
      schema.creator = {
        '@type': projectSchema.creator.type || 'Organization',
        name: projectSchema.creator.name || '',
      };

      if (projectSchema.creator.url) {
        schema.creator.url = projectSchema.creator.url;
      }
    }

    scripts.push(schema);
  }

  const faqItems = ensureArray(project.faq?.items)
    .map((item) => {
      if (!item?.question || !item?.answer) {
        return null;
      }

      return {
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      };
    })
    .filter(Boolean);

  if (faqItems.length > 0) {
    scripts.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems,
    });
  }

  if (scripts.length === 0) {
    return '';
  }

  return `\n${scripts
    .map((schema) => `  <script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
  </script>`)
    .join('\n\n')}`;
}

function renderPage(project, slug, options = {}) {
  const { outputFilename } = options;
  const bodyClass = ['portfolio-page'];
  if (project.body_class) {
    bodyClass.push(project.body_class);
  }

  const canonicalUrl = outputFilename ? buildCanonicalUrl(outputFilename) : '';

  const sections = [
    renderHero(project.hero),
    renderSeoIntro(project.seo_intro),
    renderOverview(project.overview),
    renderSeoBenefits(project.seo_benefits),
    renderGallery(project.gallery),
    renderVideoGallery(project.video_gallery),
    renderFaq(project.faq),
    renderMaterials(project.materials),
    renderSeoOverview(project.seo_overview),
    renderRelated(project.related),
    renderFaq(project.faq),
    renderCta(project.cta),
  ]
    .map((section) => indentBlock((section || '').trim()))
    .filter(Boolean)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
${renderHead(project, slug, { canonicalUrl })}
<body class="${bodyClass.join(' ')}">
  <!-- Generated from content/projects/${project.slug || slug}.yaml by scripts/build-portfolio-page.js -->
  <header class="home-header">
    <a href="../index.html" class="home-logo">Riveroak</a>
    <button class="home-menu-toggle" aria-label="Open navigation" aria-expanded="false">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </header>
  <nav class="home-menu" aria-label="Primary">
    <div class="home-menu-inner">
      <a href="../about.html">About</a>
      <a href="portfolio.html" class="active">Portfolio</a>
      <a href="../riveroak-building-company-process.html">Process</a>
      <a href="../service-areas.html">Service Areas</a>
      <a href="../contact.html">Contact</a>
      <a href="https://www.instagram.com/riveroak_building_co/" target="_blank" rel="noopener">Instagram</a>
    </div>
  </nav>

  <main>
${sections}
  </main>

  <button class="legal-scroll-top portfolio-scroll-top" type="button" aria-label="Back to top">
    <span class="legal-scroll-top__icon" aria-hidden="true">&#8593;</span>
  </button>

  ${fs.readFileSync(path.join(__dirname, 'partials', 'footer.html'), 'utf8')}
${renderStructuredData(project, slug)}
</body>
</html>\n`;
}

const footerPartialPath = path.join(__dirname, 'partials', 'footer.html');

if (!fs.existsSync(footerPartialPath)) {
  fs.mkdirSync(path.join(__dirname, 'partials'), { recursive: true });
  const footerHtml = `  <footer class="site-footer contact-footer">
    <div class="container">
      <div class="contact-footer__grid">
        <div class="contact-footer__brand">
          <a href="/index.html" class="logo">
            <img
              src="/images/LOGOS/riveroak-footer.png"
              srcset="/images/LOGOS/riveroak-footer@2x.png 2x, /images/LOGOS/riveroak-footer@3x.png 3x"
              alt="Riveroak Building Company"
            />
          </a>
          <p class="contact-footer__tagline">Bespoke homes crafted with enduring care in Birmingham.</p>
        </div>
        <div class="contact-footer__column">
          <p class="contact-footer__heading">Explore</p>
          <nav class="contact-footer__nav" aria-label="Footer navigation">
            <a href="/about.html">About</a>
            <a href="/portfolio/portfolio.html" class="active">Portfolio</a>
            <a href="/riveroak-building-company-process.html">Process</a>
            <a href="/contact.html">Contact</a>
          </nav>
        </div>
        <div class="contact-footer__column">
          <p class="contact-footer__heading">Get in touch</p>
          <ul class="contact-footer__list">
            <li>
              <span>Phone</span>
              <a href="tel:12056170176">205-617-0176</a>
            </li>
            <li>
              <span>Email</span>
              <a href="mailto:zac@riveroakbuilding.com">zac@riveroakbuilding.com</a>
            </li>
            <li>
              <span>Consultations</span>
              <p>Available by appointment in Birmingham or at your homesite.</p>
            </li>
          </ul>
        </div>
      </div>

      <div class="contact-footer__bottom">
        <p class="contact-footer__rights">&copy; <span data-year></span> Riveroak Building Company. All rights reserved.</p>
        <div class="social-links" aria-label="Social media">
          <a href="https://www.instagram.com/riveroak_building_co/" target="_blank" rel="noopener">
            <span class="sr-only">Riveroak on Instagram</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H7zm5 2.5a5.5 5.5 0 11-5.5 5.5A5.5 5.5 0 0112 6.5zm0 2a3.5 3.5 0 103.5 3.5A3.5 3.5 0 0012 8.5zm6.75-4a1.25 1.25 0 11-1.25 1.25A1.25 1.25 0 0118.75 4.5z" />
            </svg>
          </a>
          <a href="https://facebook.com/Riveroak-Building-Company" target="_blank" rel="noopener">
            <span class="sr-only">Riveroak on Facebook</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 12a10 10 0 10-11.5 9.9v-7H8.8V12h1.7v-1.8c0-2 1.2-3.1 3-3.1.9 0 1.8.1 1.8.1v2h-1c-1 0-1.3.6-1.3 1.2V12h2.2l-.4 2.9h-1.8v7A10 10 0 0022 12z" />
            </svg>
          </a>
        </div>
      </div>

      <div class="footer-legal">
        <a href="/terms.html">Terms &amp; Conditions</a>
        <span aria-hidden="true">&bull;</span>
        <a href="/privacy.html">Privacy Policy</a>
        <span aria-hidden="true">&bull;</span>
        <a href="/accessibility.html">Accessibility Statement</a>
        <span aria-hidden="true">&bull;</span>
        <a href="https://github.com/pmastropolo" target="_blank" rel="noopener">Made by: pmastropolo</a>
      </div>
    </div>
  </footer>`;
  fs.writeFileSync(footerPartialPath, footerHtml);
}

fs.mkdirSync(outputDir, { recursive: true });

function resolveOutputFilename(project, slug) {
  const candidates = [
    project?.output_filename,
    project?.outputFilename,
    project?.output_file,
    project?.outputFile,
    project?.html,
  ].filter((value) => typeof value === 'string' && value.trim() !== '');

  if (candidates.length > 0) {
    const filename = candidates[0].trim();

    if (filename.includes('..')) {
      throw new Error(
        `Invalid output filename “${filename}” for slug “${slug}”. Remove “..” to keep builds inside the portfolio folder.`
      );
    }

    const basename = path.basename(filename);
    if (basename !== filename) {
      throw new Error(
        `Invalid output filename “${filename}” for slug “${slug}”. Remove directory segments so it stays inside the portfolio folder.`
      );
    }

    return basename;
  }

  return `portfolio-${slug}.html`;
}

function buildProject(slug) {
  let project;

  try {
    project = loadProject(slug);
  } catch (error) {
    console.error(error.message);
    return false;
  }

  let outputFilename;

  try {
    outputFilename = resolveOutputFilename(project, slug);
  } catch (error) {
    console.error(error.message);
    return false;
  }

  const html = renderPage(project, slug, { outputFilename });
  const outputPath = path.join(outputDir, outputFilename);
  fs.writeFileSync(outputPath, html);
  console.log(`Built ${path.relative(process.cwd(), outputPath)}`);
  return true;
}

let success = true;

for (const slug of requestedSlugs) {
  const result = buildProject(slug);
  if (!result) {
    success = false;
  }
}

if (!success) {
  process.exit(1);
}
