// requires js-yaml CDN on each page (see append step below)
const shouldBypassDataCache = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has('preview') || params.has('nocache');
  } catch (error) {
    return false;
  }
};

async function loadYAML(path){
  const fetchOptions = shouldBypassDataCache() ? { cache: 'reload' } : { cache: 'default' };
  const res = await fetch(path, fetchOptions);
  return jsyaml.load(await res.text());
}
function setText(sel, v){ const el=document.querySelector(sel); if(el && v!=null) el.textContent=v; }
function setHTML(sel, v){ const el=document.querySelector(sel); if(el && v!=null) el.innerHTML=v; }
function setImage(sel, src, alt=""){ const el=document.querySelector(sel); if(el && src){
  if(el.tagName && el.tagName.toLowerCase()==='img'){ el.src=src; if(alt) el.alt=alt; }
  else { el.style.backgroundImage=`url('${src}')`; if(alt) el.setAttribute('aria-label', alt); }
} }
function setLink(sel, text, url){ const el=document.querySelector(sel); if(!el) return; if(text!=null) el.textContent=text; if(url!=null && el.tagName){ el.setAttribute('href', url); } }
function setList(sel, items, render){ const el=document.querySelector(sel); if(!el) return; if(Array.isArray(items)){ el.innerHTML = items.map((item, idx)=>render(item, idx, items)).join(''); } else { el.innerHTML=''; } }
function formatLines(v){ return v ? v.replace(/\n/g,'<br/>') : ''; }
function setLinkData(sel, cfg){
  const el=document.querySelector(sel);
  if(!el) return;
  const data=cfg||{};
  if('label' in data){ el.textContent = data.label || ''; }
  if('url' in data){
    if(data.url){ el.setAttribute('href', data.url); }
    else { el.removeAttribute('href'); }
  }
  if('target' in data){
    if(data.target){ el.setAttribute('target', data.target); }
    else { el.removeAttribute('target'); }
  }
  if('rel' in data){
    if(data.rel){ el.setAttribute('rel', data.rel); }
    else { el.removeAttribute('rel'); }
  }
  if('download' in data){
    if(data.download){ el.setAttribute('download', data.download===true ? '' : data.download); }
    else { el.removeAttribute('download'); }
  }
}
function updateMeta(selector, value, attribute = 'content'){ if(!value) return; const el=document.querySelector(selector); if(el){ el.setAttribute(attribute, value); } }
function renderRichText(v){ if(!v) return ''; if(typeof marked !== 'undefined'){ return marked.parse(v); } return formatLines(v); }
function resolveValue(item, key){ if(item==null) return ''; if(typeof item==='string') return item; if(typeof item==='object'){ if(key && item[key]!=null) return item[key]; const values=Object.values(item); if(values.length===1) return values[0]; } return ''; }
function updateDataMeta(name, value){ if(value==null) return; const el=document.querySelector(`[data-thank-meta="${name}"]`); if(!el) return; const tag=el.tagName ? el.tagName.toLowerCase() : ''; const attr = tag === 'link' ? 'href' : 'content'; el.setAttribute(attr, value); }
function updateJsonScript(attr, data){ const el=document.querySelector(`[data-${attr}-json]`); if(!el || !data) return; try { el.textContent = JSON.stringify(data, null, 2); } catch (error) { /* ignore invalid JSON */ } }
function normalizeJsonLd(data){
  if(data==null || typeof data!=='object') return data;
  if(Array.isArray(data)) return data.map(normalizeJsonLd);
  const result={};
  Object.entries(data).forEach(([key, value])=>{
    const normalizedKey=key==='context'?'@context':key==='type'?'@type':key;
    result[normalizedKey]=normalizeJsonLd(value);
  });
  return result;
}
function buttonClassFromStyle(style){ switch((style||'').toLowerCase()){ case 'outline': return 'btn btn-outline'; case 'ghost': return 'btn btn-ghost'; default: return 'btn btn-primary'; } }

// page loaders
async function loadHome(){ const d=await loadYAML('/content/pages/home.yaml');
  setText('[data-home="eyebrow"]', d.eyebrow);
  setText('[data-home="heading"]', d.heading);
  setText('[data-home="subtext"]', d.subtext);
  setImage('[data-home="hero_image"]', d.hero_image, d.heading);
  setImage('[data-home="hero_image_2"]', d.hero_image_2, d.heading);
  setImage('[data-home="hero_image_3"]', d.hero_image_3, d.heading);
  setImage('[data-home="hero_image_4"]', d.hero_image_4, d.heading);
  setHTML('[data-home="body"]', formatLines(d.body));
  const sig=d.signature||{};
  setText('[data-home="signature_eyebrow"]', sig.eyebrow);
  setText('[data-home="signature_heading"]', sig.heading);
  setHTML('[data-home="signature_body"]', sig.body||'');
  setList('[data-home="signature_links"]', sig.links, link => `
    <a class="signature-link" href="${link.url||'#'}">
      <span>${link.label||''}</span>
      <span class="signature-link__icon" aria-hidden="true">&rarr;</span>
    </a>`);
  setText('[data-home="highlight_title"]', sig.highlight_title);
  setHTML('[data-home="highlight_body"]', formatLines(sig.highlight_body));
  setList('[data-home="highlight_cards"]', sig.highlight_cards, card => `
    <li class="signature-highlight">
      <span class="signature-highlight__title">${card.title||''}</span>
      <p>${card.description||''}</p>
    </li>`);
  if(sig.highlight_cta){ setLink('[data-home-link="highlight_cta"]', sig.highlight_cta.label, sig.highlight_cta.url); }
  const featured=d.featured||{};
  setText('[data-home="featured_eyebrow"]', featured.eyebrow);
  setText('[data-home="featured_heading"]', featured.heading);
  setHTML('[data-home="featured_intro"]', formatLines(featured.intro));
  setLink('[data-home-link="featured_cta"]', featured.cta_text, featured.cta_url);
  setList('[data-home="featured_projects"]', featured.projects, proj => `
    <figure class="project-card project-card--luxe">
      <a class="project-card__link" href="${proj.url||'#'}">
        <div class="project-image" style="${proj.image ? `background-image: url('${proj.image}')` : ''}"></div>
        <figcaption>
          <h3>${proj.title||''}</h3>
          <p>${proj.summary||''}</p>
          <span class="project-cta">View the project&nbsp;&rarr;</span>
        </figcaption>
      </a>
    </figure>`);
  const proc=d.process_preview||{};
  setText('[data-home="process_eyebrow"]', proc.eyebrow);
  setText('[data-home="process_heading"]', proc.heading);
  setHTML('[data-home="process_intro"]', formatLines(proc.intro));
  setLink('[data-home-link="process_cta"]', proc.cta_text, proc.cta_url);
  setList('[data-home="process_steps"]', proc.steps, (step, idx) => `
    <article class="timeline-step">
      <div class="timeline-step__marker">${String(idx+1).padStart(2,'0')}</div>
      <div class="timeline-step__body">
        <h3>${step.title||''}</h3>
        <p>${step.description||''}</p>
      </div>
    </article>`);
  const quote=d.testimonial||{};
  setHTML('[data-home="testimonial_quote"]', quote.quote||'');
  setText('[data-home="testimonial_byline"]', quote.byline);
  const cta=d.cta||{};
  setText('[data-home="cta_eyebrow"]', cta.eyebrow);
  setText('[data-home="cta_heading"]', cta.heading);
  setHTML('[data-home="cta_body"]', formatLines(cta.body));
  setList('[data-home="cta_links"]', cta.links, link => `
    <a class="text-link" href="${link.url||'#'}">${link.label||''}</a>`);
  setLink('[data-home-link="cta_phone"]', cta.phone, cta.phone_href);
  setLink('[data-home-link="cta_email"]', cta.email, cta.email_href);
  setList('[data-home="cta_connect"]', cta.connect, (link, idx, arr) => `
    <a href="${link.url||'#'}" target="${/^https?:/.test(link.url||'') ? '_blank' : ''}" rel="noopener">${link.label||''}</a>${idx < arr.length -1 ? '<span>&bull;</span>' : ''}`);
  setLink('[data-home-link="cta_button"]', cta.button_text, cta.button_url);
}
async function loadAbout(){ const d=await loadYAML('/content/pages/about.yaml');
  const founder=d.founder||{};
  setText('[data-about="founder_eyebrow"]', founder.eyebrow);
  setText('[data-about="founder_heading"]', founder.heading);
  setImage('[data-about="founder_portrait"]', founder.portrait, founder.heading);
  setList('[data-about="founder_paragraphs"]', founder.paragraphs, para => `<p>${para||''}</p>`);
  setList('[data-about="founder_highlights"]', founder.highlights, item => `
    <article class="about-highlight-card">
      <h3>${item.title||''}</h3>
      <p>${item.description||''}</p>
    </article>`);
  const promise=d.promise||{};
  setText('[data-about="promise_eyebrow"]', promise.eyebrow);
  setText('[data-about="promise_heading"]', promise.heading);
  setHTML('[data-about="promise_body"]', formatLines(promise.body));
  setList('[data-about="promise_links"]', promise.links, link => `
    <a class="signature-link" href="${link.url||'#'}">
      <span>${link.label||''}</span>
      <span class="signature-link__icon" aria-hidden="true">&rarr;</span>
    </a>`);
  setList('[data-about="promise_pillars"]', promise.pillars, item => `
    <li>
      <span class="promise-label">${item.label||''}</span>
      <p>${item.description||''}</p>
    </li>`);
  const acta=d.cta||{};
  setText('[data-about="cta_eyebrow"]', acta.eyebrow);
  setText('[data-about="cta_heading"]', acta.heading);
  setHTML('[data-about="cta_body"]', formatLines(acta.body));
  setLink('[data-about-link="cta_phone"]', acta.phone, acta.phone_href);
  setLink('[data-about-link="cta_email"]', acta.email, acta.email_href);
  setList('[data-about="cta_connect"]', acta.connect, (link, idx, arr) => `
    <a href="${link.url||'#'}" target="${/^https?:/.test(link.url||'') ? '_blank' : ''}" rel="noopener">${link.label||''}</a>${idx < arr.length - 1 ? '<span>&bull;</span>' : ''}`);
  setList('[data-about="cta_links"]', acta.links, link => `
    <a class="text-link" href="${link.url||'#'}">${link.label||''}</a>`);
}
async function loadProcess(){ const d=await loadYAML('/content/pages/process.yaml');
  const hero=d.hero||{};
  setText('[data-process="hero_badge"]', hero.badge);
  setText('[data-process="hero_heading"]', hero.heading);
  if(hero.lead!=null) setHTML('[data-process="hero_lead"]', formatLines(hero.lead));
  setLinkData('[data-process-link="hero_primary_cta"]', hero.primary_cta);
  setLinkData('[data-process-link="hero_secondary_cta"]', hero.secondary_cta);
  setList('[data-process="hero_details"]', hero.details, detail => {
    const item = detail || {};
    return `<div>
      <span class="journey-hero__detail-label">${item.label||''}</span>
      <span class="journey-hero__detail-text">${item.text||''}</span>
    </div>`;
  });

  if(d.body!=null) setHTML('[data-process="body"]', formatLines(d.body));

  const overview=d.overview||{};
  setText('[data-process="overview_eyebrow"]', overview.eyebrow);
  setText('[data-process="overview_heading"]', overview.heading);
  if(overview.body!=null) setHTML('[data-process="overview_body"]', formatLines(overview.body));
  setList('[data-process="overview_steps"]', overview.steps, (step, idx) => {
    const item = step || {};
    const number = item.number != null ? item.number : String(idx+1).padStart(2,'0');
    const displayNumber = String(number).padStart(2,'0');
    return `<article class="journey-step">
        <span class="journey-step__number">${displayNumber}</span>
        <div class="journey-step__content">
          <h2>${item.title||''}</h2>
          <p>${item.description||''}</p>
        </div>
      </article>`;
  });

  const download=d.download||{};
  setText('[data-process="download_eyebrow"]', download.eyebrow);
  setText('[data-process="download_heading"]', download.heading);
  if(download.body!=null) setHTML('[data-process="download_body"]', formatLines(download.body));
  setLinkData('[data-process-link="download_button"]', download.button);
  const mediaLink=document.querySelector('[data-process-link="download_media"]');
  if(mediaLink){
    const media=download.media||{};
    if('url' in media){
      if(media.url){ mediaLink.setAttribute('href', media.url); }
      else { mediaLink.removeAttribute('href'); }
    }
    if('download' in media){
      if(media.download){ mediaLink.setAttribute('download', media.download===true ? '' : media.download); }
      else { mediaLink.removeAttribute('download'); }
    }
    if('aria_label' in media){
      if(media.aria_label){ mediaLink.setAttribute('aria-label', media.aria_label); }
      else { mediaLink.removeAttribute('aria-label'); }
    }
    if('target' in media){
      if(media.target){ mediaLink.setAttribute('target', media.target); }
      else { mediaLink.removeAttribute('target'); }
    }
    if('rel' in media){
      if(media.rel){ mediaLink.setAttribute('rel', media.rel); }
      else { mediaLink.removeAttribute('rel'); }
    }
  }
  const downloadImage=download.image||{};
  setImage('[data-process="download_image"]', downloadImage.src, downloadImage.alt||download.heading||'');

  const support=d.support||{};
  setText('[data-process="support_eyebrow"]', support.eyebrow);
  setText('[data-process="support_heading"]', support.heading);
  if(support.body!=null) setHTML('[data-process="support_body"]', formatLines(support.body));
  setLinkData('[data-process-link="support_primary_cta"]', support.primary_cta);
  setLinkData('[data-process-link="support_secondary_cta"]', support.secondary_cta);
}
async function loadServiceAreas(){ const d=await loadYAML('/content/pages/service-areas.yaml');
  setText('[data-sa="title"]', d.title);
  setText('[data-sa="lead"]', d.lead);
  const list=document.querySelector('[data-sa="featured"]');
  if(list && Array.isArray(d.featured_areas) && d.featured_areas.length){
    const arrowIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/></svg>';
    list.innerHTML = d.featured_areas.map(area => {
      const name = area.name || '';
      const teaser = area.teaser || '';
      const url = area.url || '';
      const cta = area.cta || (name ? `Discover ${name}` : 'Discover');
      const imageMarkup = area.image ? `<img src="${area.image}" alt="${name}">` : '';
      const linkMarkup = url ? `
        <a class="service-area-link" href="${url}">
          ${cta}
          ${arrowIcon}
        </a>` : '';
      return `
        <article class="service-area-card">
          ${imageMarkup}
          <h3>${name}</h3>
          ${teaser ? `<p>${teaser}</p>` : ''}
          ${linkMarkup}
        </article>`;
    }).join('');
  }
}
async function loadPortfolio(){ const d=await loadYAML('/content/pages/portfolio.yaml');
  const hero=d.hero||{};
  setText('[data-portfolio="hero_eyebrow"]', hero.eyebrow);
  setText('[data-portfolio="hero_heading"]', hero.heading);
  setText('[data-portfolio="hero_lead"]', hero.lead);
  setHTML('[data-portfolio="hero_body"]', formatLines(hero.body));
  const grid=document.querySelector('[data-portfolio="projects"]');
  if(grid){
    const renderProject=(proj={}, highlight=false)=>{
      if(!proj) return '';
      const classes=['portfolio-card'];
      if(highlight) classes.push('portfolio-card--highlight');
      const headingTag=highlight?'h2':'h3';
      const imageStyle=proj.image?`--project-image: url('${proj.image}')`:'';
      const tagMarkup=proj.tag?`<span class="project-tag">${proj.tag}</span>`:'';
      const descriptionMarkup=proj.description?`<p>${proj.description}</p>`:'';
      const locationMarkup=proj.location?`<span>${proj.location}</span>`:'';
      const metaMarkup=locationMarkup?`<div class="project-meta">${locationMarkup}</div>`:'';
      const href=proj.url || '#';
      return `
        <a class="${classes.join(' ')}" href="${href}">
          <div class="project-image" style="${imageStyle}">
            ${tagMarkup}
          </div>
          <div class="project-details">
            <${headingTag}>${proj.title||''}</${headingTag}>
            ${descriptionMarkup}
            ${metaMarkup}
          </div>
        </a>`;
    };
    const projects=d.projects||{};
    const cards=[];
    if(projects.highlight){
      cards.push(renderProject(projects.highlight, true));
    }
    if(Array.isArray(projects.items)){
      projects.items.forEach((proj)=>{
        cards.push(renderProject(proj));
      });
    }
    grid.innerHTML=cards.join('');
  }
  const cta=d.cta||{};
  setText('[data-portfolio="cta_eyebrow"]', cta.eyebrow);
  setText('[data-portfolio="cta_heading"]', cta.heading);
  setHTML('[data-portfolio="cta_body"]', formatLines(cta.body));
  setList('[data-portfolio="cta_links"]', cta.links, (link)=>`
    <a class="text-link" href="${link.url||'#'}">${link.label||''}</a>`);
  setText('[data-portfolio="cta_phone_label"]', cta.phone_label);
  setLink('[data-portfolio-link="cta_phone"]', cta.phone, cta.phone_href);
  setText('[data-portfolio="cta_email_label"]', cta.email_label);
  setLink('[data-portfolio-link="cta_email"]', cta.email, cta.email_href);
  setText('[data-portfolio="cta_explore_label"]', cta.explore_label);
  setList('[data-portfolio="cta_explore_links"]', cta.explore_links, (link, idx, arr)=>`
    <a class="text-link" href="${link.url||'#'}">${link.label||''}</a>${idx<arr.length-1?'<span>&bull;</span>':''}`);
}
async function loadContact(){ const d=await loadYAML('/content/pages/contact.yaml');
  const hero=d.hero||{};
  if(!d.hero){
    if(d.eyebrow!=null) hero.eyebrow=d.eyebrow;
    if(d.heading!=null) hero.heading=d.heading;
    if(d.subtext!=null) hero.subtext=d.subtext;
    if(d.body!=null) hero.body=d.body;
  }
  setText('[data-contact="hero_eyebrow"]', hero.eyebrow);
  setText('[data-contact="heading"]', hero.heading);
  setText('[data-contact="subtext"]', hero.subtext);
  setHTML('[data-contact="body"]', formatLines(hero.body));
  setHTML('[data-contact="hero_note"]', formatLines(hero.note));
  setList('[data-contact-list="hero_actions"]', hero.actions, (action)=>{
    if(!action) return '';
    const variant=action.variant==='outline'?'btn-outline':'btn-primary';
    const extraClass=action.class?` ${action.class}`:'';
    const target=action.target?` target="${action.target}"`:'';
    const rel=action.rel?` rel="${action.rel}"`:'';
    const download=action.download?` download="${action.download===true?'':action.download}"`:'';
    const href=action.url||'#';
    const label=action.label||'';
    return `<a class="btn ${variant}${extraClass}" href="${href}"${target}${rel}${download}>${label}</a>`;
  });

  const details=d.details||{};
  setText('[data-contact="details_heading"]', details.heading);
  setHTML('[data-contact="details_intro"]', formatLines(details.intro));
  setList('[data-contact-list="essentials"]', details.essentials, (item)=>{
    if(!item) return '';
    const value=item.value||'';
    const url=item.url;
    const formatted=url?`<a href="${url}">${value||url}</a>`:formatLines(value);
    return `<div>
      <dt>${item.label||''}</dt>
      <dd>${formatted}</dd>
    </div>`;
  });
  setList('[data-contact-list="highlights"]', details.highlights, (item)=>{
    if(!item) return '';
    return `<div>
      <h3>${item.title||''}</h3>
      <p>${formatLines(item.description||'')}</p>
    </div>`;
  });
  setHTML('[data-contact="appointment_note"]', formatLines(details.appointment_note));

  setList('[data-contact-list="footer_essentials"]', details.footer_essentials||details.essentials, (item)=>{
    if(!item) return '';
    const value=item.value||'';
    const url=item.url;
    const formattedValue=formatLines(value);
    const content=url?`<a href="${url}">${value||url}</a>`:`<p>${formattedValue}</p>`;
    return `<li>
      <span>${item.label||''}</span>
      ${content}
    </li>`;
  });

  const form=d.form||{};
  setText('[data-contact="form_heading"]', form.heading);
  setHTML('[data-contact="form_lead"]', formatLines(form.lead));
}
async function loadThankYou(){ const d=await loadYAML('/content/pages/thank-you.yaml');
  const seo=d.seo||{};
  if(seo.title) document.title=seo.title;
  updateDataMeta('description', seo.description);
  updateDataMeta('canonical', seo.canonical);
  updateDataMeta('og:title', seo.og_title || seo.title);
  updateDataMeta('og:description', seo.og_description || seo.description);
  updateDataMeta('og:url', seo.og_url || seo.canonical);
  updateDataMeta('og:image', seo.og_image);
  updateDataMeta('twitter:title', seo.twitter_title || seo.title);
  updateDataMeta('twitter:description', seo.twitter_description || seo.description);
  updateDataMeta('twitter:image', seo.twitter_image || seo.og_image);
  updateJsonScript('thank', normalizeJsonLd(seo.jsonld));

  const hero=d.hero||{};
  setText('[data-thank="hero_eyebrow"]', hero.eyebrow);
  setText('[data-thank="hero_heading"]', hero.heading);
  if(hero.message!=null) setHTML('[data-thank="hero_message"]', renderRichText(hero.message));
  if(hero.support_message!=null) setHTML('[data-thank="support_message"]', renderRichText(hero.support_message));
  setList('[data-thank-list="actions"]', hero.actions, action => {
    const item=action||{};
    const label=item.label||'';
    if(!label) return '';
    const url=item.url||'#';
    const klass=buttonClassFromStyle(item.style);
    return `<a class="${klass}" href="${url}">${label}</a>`;
  });
}

async function loadProjectPage(){
  const body=document.body;
  if(!body||!body.dataset||!body.dataset.projectSlug) return;
  const slug=body.dataset.projectSlug;
  const data=await loadYAML(`/content/projects/${slug}.yaml`).catch(()=>null);
  if(!data) return;

  const seo=data.seo||{};
  const pageTitle=seo.title||data.title||document.title;
  const portfolioSuffix=' | Riveroak Building Company Portfolio';
  document.title=pageTitle.includes('Riveroak Building Company')?pageTitle:pageTitle+portfolioSuffix;
  const metaDescription=seo.description||data.meta_description||data.summary||'';
  updateMeta('meta[name="description"]', metaDescription);
  updateMeta('meta[property="og:title"]', seo.og_title||pageTitle);
  updateMeta('meta[property="og:description"]', seo.og_description||metaDescription);
  updateMeta('meta[name="twitter:title"]', seo.twitter_title||pageTitle);
  updateMeta('meta[name="twitter:description"]', seo.twitter_description||metaDescription);
  updateMeta('meta[property="og:image"]', seo.og_image||data.social_image);
  updateMeta('meta[name="twitter:image"]', seo.twitter_image||seo.og_image||data.social_image);

  if(Array.isArray(seo.meta)){
    seo.meta.forEach((meta)=>{
      if(!meta||!meta.name||!meta.content) return;
      updateMeta(`meta[name="${meta.name}"]`, meta.content);
    });
  }

  const bodyClass=data.body_class||'';
  if(bodyClass){
    bodyClass.split(/\s+/).forEach((cls)=>{ if(cls) body.classList.add(cls); });
  }

  const hero=data.hero||{};
  const heroImg=document.querySelector('[data-project="hero_image"]');
  if(heroImg){
    if(hero.image){ heroImg.src=hero.image; }
    heroImg.alt=hero.alt||hero.heading||data.title||'';
  }
  setText('[data-project="hero_eyebrow"]', hero.eyebrow);
  setText('[data-project="hero_heading"]', hero.heading||data.title);
  setHTML('[data-project="hero_lede"]', formatLines(hero.lede||''));
  setList('[data-project="hero_stats"]', hero.stats, (stat)=>`
    <div class="stat-card" role="listitem">
      <span class="stat-card__label">${stat.label||''}</span>
      <span class="stat-card__value">${stat.value||''}</span>
    </div>`);
  setList('[data-project="hero_tags"]', hero.tags, (tag)=>`<span class="portfolio-hero__tag">${tag.tag||tag}</span>`);

  const overview=data.overview||{};
  const overviewSection=document.querySelector('[data-project-section="overview"]');
  if(overviewSection){ overviewSection.hidden = !overview.heading && !Array.isArray(overview.paragraphs); }
  setText('[data-project="overview_eyebrow"]', overview.eyebrow);
  setText('[data-project="overview_heading"]', overview.heading);
  setList('[data-project="overview_paragraphs"]', overview.paragraphs, (para)=>`<p>${para.text||para}</p>`);
  setList('[data-project="overview_details"]', overview.details, (detail)=>{
    const items=Array.isArray(detail.items)?detail.items.map((item)=>`<li>${item.text||item}</li>`).join(''):'';
    return `<div>
      <h3>${detail.title||''}</h3>
      <ul class="project-detail-list">${items}</ul>
    </div>`;
  });

  const gallerySection=document.querySelector('[data-project-section="gallery"]');
  const gallery=data.gallery||{};
  if(gallerySection){
    const hasGallery=Array.isArray(gallery.items)&&gallery.items.length>0;
    gallerySection.hidden=!hasGallery;
    if(hasGallery){
      setText('[data-project="gallery_eyebrow"]', gallery.eyebrow);
      setText('[data-project="gallery_heading"]', gallery.heading);
      setList('[data-project="gallery_items"]', gallery.items, (item)=>{
        const ariaLabel=item.aria_label||item.alt||'';
        const caption=item.caption?`<figcaption${item.caption_hidden?' hidden':''}>${item.caption}</figcaption>`:'';
        const buttonAria=ariaLabel?` aria-label="${ariaLabel}"`:'';
        return `<figure class="project-media__item">
          <button class="project-media__trigger" type="button" data-gallery-trigger${buttonAria}>
            <img src="${item.image||''}" alt="${item.alt||''}" loading="lazy">
          </button>
          ${caption}
        </figure>`;
      });
    }
  }

  const videoSection=document.querySelector('[data-project-section="video_gallery"]');
  const videoGallery=data.video_gallery||{};
  if(videoSection){
    const hasVideos=Array.isArray(videoGallery.items)&&videoGallery.items.length>0;
    videoSection.hidden=!hasVideos;
    if(hasVideos){
      setText('[data-project="video_gallery_eyebrow"]', videoGallery.eyebrow);
      setText('[data-project="video_gallery_heading"]', videoGallery.heading);
      setList('[data-project="video_gallery_items"]', videoGallery.items, (item)=>{
        const ariaLabel=item.aria_label||item.alt||'';
        const caption=item.caption?`<figcaption${item.caption_sr_only?' class="sr-only"':''}>${item.caption}</figcaption>`:'';
        const altAttr=item.alt?` data-gallery-alt="${item.alt}"`:'';
        const posterAttr=item.poster?` poster="${item.poster}"`:'';
        return `<figure class="project-video-tile">
          <button class="project-media__trigger project-media__trigger--video project-video-tile__trigger" type="button" data-gallery-trigger data-gallery-type="video" data-gallery-src="${item.src||''}"${altAttr}${ariaLabel?` aria-label="${ariaLabel}"`:''}>
            <video${posterAttr} muted playsinline webkit-playsinline preload="metadata" aria-hidden="true">
              <source src="${item.src||''}" type="video/mp4" />
            </video>
            <span class="project-video-tile__icon" aria-hidden="true"></span>
          </button>
          ${caption}
        </figure>`;
      });
    }
  }

  const materialsSection=document.querySelector('[data-project-section="materials"]');
  const materials=data.materials||{};
  if(materialsSection){
    const hasMaterials=(materials.heading||materials.body||Array.isArray(materials.cards));
    materialsSection.hidden=!hasMaterials;
    if(hasMaterials){
      setText('[data-project="materials_eyebrow"]', materials.eyebrow);
      setText('[data-project="materials_heading"]', materials.heading);
      setHTML('[data-project="materials_body"]', formatLines(materials.body||''));
      setList('[data-project="materials_cards"]', materials.cards, (card)=>`
        <article class="material-card">
          <h3>${card.title||''}</h3>
          <p>${card.description||''}</p>
        </article>`);
    }
  }

  const relatedSection=document.querySelector('[data-project-section="related"]');
  const related=data.related||{};
  if(relatedSection){
    const hasRelated=Array.isArray(related.projects)&&related.projects.length>0;
    relatedSection.hidden=!hasRelated;
    if(hasRelated){
      setText('[data-project="related_eyebrow"]', related.eyebrow);
      setText('[data-project="related_heading"]', related.heading);
      setList('[data-project="related_projects"]', related.projects, (proj)=>{
        const metaItems=Array.isArray(proj.meta)?proj.meta.map((meta)=>`<span>${meta}</span>`).join(''):'';
        const imageStyle=proj.image?` style="--project-image: url('${proj.image}')"`:'';
        const tagMarkup=proj.tag?`<span class="project-tag">${proj.tag}</span>`:'';
        return `<a class="portfolio-card" href="${proj.url||'#'}">
          <div class="project-image"${imageStyle}>
            ${tagMarkup}
          </div>
          <div class="project-details">
            <h3>${proj.title||''}</h3>
            <p>${proj.summary||''}</p>
            <div class="project-meta">${metaItems}</div>
          </div>
        </a>`;
      });
    }
  }

  const ctaSection=document.querySelector('[data-project-section="cta"]');
  const cta=data.cta||{};
  if(ctaSection){
    const hasCTA=cta.heading||cta.lede||Array.isArray(cta.links)||Array.isArray(cta.details);
    ctaSection.hidden=!hasCTA;
    if(hasCTA){
      setText('[data-project="cta_eyebrow"]', cta.eyebrow);
      setText('[data-project="cta_heading"]', cta.heading);
      setHTML('[data-project="cta_lede"]', formatLines(cta.lede||''));
      setList('[data-project="cta_links"]', cta.links, (link)=>{
        const cls=link.class?` class="${link.class}"`:'';
        const target=/^https?:/.test(link.url||'')?' target="_blank" rel="noopener"':'';
        return `<a${cls} href="${link.url||'#'}"${target}>${link.label||''}</a>`;
      });
      setList('[data-project="cta_details"]', cta.details, (detail)=>{
        const items=Array.isArray(detail.items)?detail.items.map((item, idx)=>{
          let separatorMarkup='';
          if(idx>0){
            const type=item.separator||'bullet';
            if(type==='text') separatorMarkup=`<span>${item.separator_text||'&bull;'}</span>`;
            else if(type==='none') separatorMarkup='';
            else separatorMarkup='<span>&bull;</span>';
          }
          const target=/^https?:/.test(item.url||'')?' target="_blank" rel="noopener"':'';
          const cls=item.class?` class="${item.class}"`:'';
          const content=item.url?`<a${cls} href="${item.url}"${target}>${item.label||item.text||item.value||''}</a>`:`<span${cls}>${item.label||item.text||item.value||''}</span>`;
          return `${separatorMarkup}${content}`;
        }).join(''):(detail.value||'');
        return `<div class="cta-details__item">
          <span class="cta-details__label">${detail.label||''}</span>
          <div class="cta-details__value">${items}</div>
        </div>`;
      });
    }
  }
}
async function loadNotFound(){ const d=await loadYAML('/content/pages/404.yaml');
  const hero=d.hero||{};
  setText('[data-404="monogram"]', hero.monogram);
  setText('[data-404="status"]', hero.status);
  setText('[data-404="heading"]', hero.heading);
  setText('[data-404="lead"]', hero.lead);
  setText('[data-404="code"]', hero.code);
  setText('[data-404="subtitle"]', hero.subtitle);
  setImage('[data-404="background_image"]', hero.background_image, hero.background_alt||'');
  const actions=document.querySelector('[data-404-actions]');
  if(actions && Array.isArray(hero.actions) && hero.actions.length){
    const classMap={primary:'btn-primary', outline:'btn-outline', ghost:'btn-ghost'};
    actions.innerHTML = hero.actions.map(action => {
      const label = action.label || '';
      const url = action.url || '#';
      const style = classMap[action.style] || 'btn-primary';
      return `<a class="btn ${style}" href="${url}">${label}</a>`;
    }).join('');
  } else if(actions){ actions.innerHTML=''; }
}
function setLegalHero(scope, data){
  setText(`[data-${scope}="hero_eyebrow"]`, data.eyebrow);
  setText(`[data-${scope}="hero_title"]`, data.title);
  setHTML(`[data-${scope}="hero_meta"]`, renderRichText(data.meta||''));
  const intro=document.querySelector(`[data-${scope}="hero_intro"]`);
  if(intro){
    if(Array.isArray(data.intro) && data.intro.length){
      intro.innerHTML = data.intro.map(item => renderRichText(resolveValue(item, 'paragraph'))).join('');
    } else {
      intro.innerHTML='';
    }
  }
}
function setLegalSections(scope, sections){
  const container=document.querySelector(`[data-${scope}="sections"]`);
  if(!container) return;
  if(!Array.isArray(sections) || !sections.length){ container.innerHTML=''; return; }
  container.innerHTML = sections.map(section => {
    const heading = section.heading || resolveValue(section, 'heading');
    const body = renderRichText(section.body || resolveValue(section, 'body'));
    return `<div>${heading ? `<h2>${heading}</h2>` : ''}${body}</div>`;
  }).join('');
}
async function loadPrivacy(){ const d=await loadYAML('/content/pages/privacy.yaml');
  const hero=d.hero||{};
  setLegalHero('privacy', hero);
  setLegalSections('privacy', d.sections);
}
async function loadTerms(){ const d=await loadYAML('/content/pages/terms.yaml');
  const hero=d.hero||{};
  setLegalHero('terms', hero);
  if(d.intro){ setHTML('[data-terms="intro"]', renderRichText(d.intro)); }
  setLegalSections('terms', d.sections);
}
async function loadAccessibility(){ const d=await loadYAML('/content/pages/accessibility.yaml');
  const hero=d.hero||{};
  setLegalHero('accessibility', hero);
  setLegalSections('accessibility', d.sections);
}

// route by page
document.addEventListener('DOMContentLoaded', () => {
  const p=location.pathname;
  if (p==='/' || p.endsWith('/index.html')) loadHome();
  else if (p.endsWith('/about.html')) loadAbout();
  else if (p.endsWith('/riveroak-building-company-process.html')) loadProcess();
  else if (p.endsWith('/service-areas.html')) loadServiceAreas();
  else if (p.endsWith('/portfolio/portfolio.html')) loadPortfolio();
  else if (p.endsWith('/contact.html')) loadContact();
  else if (p.endsWith('/thank-you.html')) loadThankYou();
  else if (/\/portfolio\/portfolio-.+\.html$/.test(p)) loadProjectPage();
  else if (p.endsWith('/404.html') || p.endsWith('/404')) loadNotFound();
  else if (p.endsWith('/privacy.html')) loadPrivacy();
  else if (p.endsWith('/terms.html')) loadTerms();
  else if (p.endsWith('/accessibility.html')) loadAccessibility();
});
