# Riveroak Building Company Website

A comprehensive marketing site for Riveroak Building Company that showcases custom home projects, promotes available services across Birmingham-area communities, and captures new business inquiries. The repository includes the static site, front-end enhancements, serverless email handling, and automation scripts that keep the experience consistent across every page. 

### LIVE

- https://riveroakbuilding.com/

## Live preview

- Production deployment: <https://neon-malabi-0f2e54.netlify.app/>
- Production deployment: <https://joyful-cocada-1f9ba7.netlify.app/>
- The live site is generated directly from the files in this repository and deployed to Netlify using the configuration in [`netlify.toml`](netlify.toml).

## Table of contents

- [Key features](#key-features)
- [Technology stack](#technology-stack)
- [Site architecture](#site-architecture)
- [Content & automation](#content--automation)
- [Contact form & email delivery](#contact-form--email-delivery)
- [Local development](#local-development)
- [Available scripts](#available-scripts)
- [Deployment & hosting](#deployment--hosting)
- [Accessibility, SEO & performance](#accessibility-seo--performance)
- [Further documentation & assets](#further-documentation--assets)

## Key features

- **Multi-page marketing funnel** – Hero storytelling, differentiators, testimonials, FAQs, and a detailed process outline spread across `index.html`, [`about.html`](about.html), [`riveroak-building-company-process.html`](riveroak-building-company-process.html), and [`contact.html`](contact.html).
- **Portfolio storytelling** – Project detail pages under [`portfolio/`](portfolio) are generated from structured YAML and include hero stats, photo galleries, materials highlights, and scroll-to-top shortcuts driven by [`js/main.js`](js/main.js).
- **Service area microsites** – Each Birmingham-area community has a dedicated landing page inside [`service-areas/<city>/`](service-areas) with localized messaging, SEO-friendly URLs, and Netlify redirects defined in [`netlify.toml`](netlify.toml).
- **Interactive UI enhancements** – [`js/main.js`](js/main.js) powers mobile navigation toggles, scroll-aware headers, responsive sliders, a lightbox gallery modal, active footer links, and smooth scroll helpers. [`js/contact-form.js`](js/contact-form.js) progressively enhances the contact form with validation, fetch-based submissions, and Netlify Forms fallbacks.
- **Lead capture pipeline** – The contact form submits to a Node.js/Express API during local development (`/api/contact`) and the mirrored Netlify Function in production (`/.netlify/functions/contact`), both implemented with Nodemailer to deliver inquiries by email.
- **Compliance & trust signals** – Legal policies (`privacy.html`, `terms.html`, `accessibility.html`), downloadable brochures (`downloads/`, `PDF/`), and social proof content reinforce credibility across the site.

## Technology stack

| Layer | Details |
| ----- | ------- |
| Markup | Hand-authored HTML5 pages for each marketing, legal, portfolio, and service-area view. |
| Styling | Custom responsive CSS in [`css/style.css`](css/style.css) with utility classes, animations, and breakpoint-specific layouts. |
| Interactivity | Vanilla JavaScript modules in [`js/main.js`](js/main.js) and [`js/contact-form.js`](js/contact-form.js); no front-end framework required. |
| Backend & email | [`server.js`](server.js) provides an Express server for local development, while [`netlify/functions/contact.js`](netlify/functions/contact.js) mirrors the same logic for production. Nodemailer handles SMTP delivery. |
| Automation | Node-based scripts in [`scripts/`](scripts) manage portfolio generation, footer consistency, and live content syncing from the deployed site. |
| Tooling | npm scripts (see below) and `.env` configuration for credentials. |
| Hosting | Netlify serves the static assets, processes form submissions, and executes the serverless contact function per [`netlify.toml`](netlify.toml). |

## Site architecture

```
.
├── index.html                      # Home page hero, services, testimonials, FAQs, and CTA blocks
├── about.html                      # Company story, leadership, and differentiators
├── contact.html                    # Contact form enhanced by js/contact-form.js
├── riveroak-building-company-process.html  # Step-by-step build process timeline
├── service-areas/                  # Community-specific landing pages (e.g., Homewood, Hoover, Chelsea)
│   └── <city>/<slug>.html
├── portfolio/                      # Generated project detail pages + listing (`portfolio.html`)
├── content/projects/               # YAML sources for each portfolio project
├── downloads/ & PDF/               # Marketing collateral available for download
├── css/style.css                   # Global styling, layout, animations, and responsive rules
├── js/main.js                      # Navigation, slider, gallery modal, scroll helpers, dynamic footer
├── js/contact-form.js              # Form validation, fetch submission, Netlify fallback, honeypot handling
├── server.js                       # Express static server + `/api/contact` email relay for local dev
├── netlify/functions/contact.js    # Production-ready serverless function mirroring server.js email logic
├── scripts/                        # Build utilities (portfolio generation, footer sync, live content pull)
├── admin/                          # Decap CMS configuration (`config.yml`) and admin shell
├── docs/                           # Project documentation (CMS setup, preview instructions)
└── netlify.toml                    # Redirects, headers, and functions configuration for Netlify
```

## Content & automation

- **Portfolio builder** – `content/projects/*.yaml` describes each project. Run `npm run build:portfolio` to convert the YAML into HTML files under `portfolio/` using [`scripts/build-portfolio-page.js`](scripts/build-portfolio-page.js).
- **Consistent contact footer** – [`scripts/apply-contact-footer.js`](scripts/apply-contact-footer.js) can be executed to inject the standardized footer across every HTML page.
- **Live content syncing** – [`scripts/sync-portfolio-from-live.js`](scripts/sync-portfolio-from-live.js) pulls the latest deployed HTML back into the repository (supports `--dry-run` and slug arguments).
- **Low-code editing** – The optional Decap CMS integration (`/admin`) is configured in [`admin/config.yml`](admin/config.yml) and documented in [`docs/decap-cms-setup.md`](docs/decap-cms-setup.md). Preview instructions live in [`docs/previews/README.md`](docs/previews/README.md).

## Contact form & email delivery

1. **Front-end experience**
   - `contact.html` contains a progressively-enhanced form. [`js/contact-form.js`](js/contact-form.js) enforces required fields, validates email addresses, handles a spam honeypot, and posts JSON to `/api/contact` while falling back to Netlify Forms when the static hosting environment handles the submission.
2. **Local API**
   - [`server.js`](server.js) loads SMTP credentials from `.env`, serves the static site, and exposes `POST /api/contact`. Submitted payloads are validated, normalized, and sent via Nodemailer.
3. **Production API**
   - [`netlify/functions/contact.js`](netlify/functions/contact.js) mirrors the Express handler for serverless execution. `netlify.toml` routes `/api/*` requests to the function automatically.
4. **Environment variables**
   - Copy `.env.example` to `.env` and provide `MAIL_SERVICE` (or `MAIL_HOST`/`MAIL_PORT`/`MAIL_SECURE`), `MAIL_USER`, `MAIL_PASS`, optional `MAIL_FROM`, `CONTACT_RECIPIENT`, and `CONTACT_SUBJECT` before running the server locally. Configure the same variables in the Netlify UI for production.
5. **Troubleshooting**
   - Both implementations log verification, delivery success, or detailed SMTP errors to help diagnose misconfigurations. The front-end surfaces friendly success/error states and removes query-string status parameters after display.

## Local development

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Serve the static site only**
   ```bash
   npx serve .
   # or use your preferred static file server
   ```
   Visit <http://localhost:3000> (or the port reported by your static server).
3. **Run the Express server with email relay**
   ```bash
   npm start
   ```
   Express serves the static files and the `/api/contact` endpoint at <http://localhost:3000>. Submit the contact form to confirm Nodemailer delivery and watch the console for transport verification logs.
4. **Direct API testing**
   ```bash
   curl -X POST http://localhost:3000/api/contact \
     -H 'Content-Type: application/json' \
     -d '{
       "name": "Jane Doe",
       "email": "jane@example.com",
       "phone": "205-555-1234",
       "project": "Looking to build a 4-bed custom home on a new lot.",
       "projectLocation": "Homewood, AL"
     }'
   ```

## Available scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Runs [`server.js`](server.js) to serve the site locally and relay contact form submissions via SMTP. |
| `npm run build:portfolio` | Executes [`scripts/build-portfolio-page.js`](scripts/build-portfolio-page.js) to transform YAML project data into HTML pages inside `portfolio/`. |
| `npm run sync:portfolio` | Runs [`scripts/sync-portfolio-from-live.js`](scripts/sync-portfolio-from-live.js) to pull down live project HTML (`--dry-run`, `--all`, or slug arguments supported). |
| *(optional)* `node scripts/apply-contact-footer.js` | Regenerates the contact footer in every HTML page for consistency. |

## Deployment & hosting

- **Netlify configuration** – [`netlify.toml`](netlify.toml) defines clean redirects (e.g., `/portfolio` → `/portfolio/portfolio.html`), canonical URLs, redirect rules for every service area, and security/cache headers.
- **Serverless contact function** – Requests to `/api/contact` on Netlify automatically proxy to [`netlify/functions/contact.js`](netlify/functions/contact.js).
- **Forms** – The contact form includes Netlify form attributes to enable static-site submissions when JavaScript is unavailable.
- **Secrets management** – Provide SMTP credentials through Netlify environment variables or the local `.env` file. Never commit real secrets; Netlify’s secret scanning will block deployments if sensitive values appear in the repo.

## Accessibility, SEO & performance

- Semantic landmarks (`header`, `nav`, `main`, `section`, `footer`) and ARIA labels guide assistive technologies throughout the site.
- Meaningful `alt` attributes and descriptive captions accompany imagery and gallery media.
- The JavaScript enhancements are progressive: navigation, sliders, galleries, and scroll helpers gracefully degrade when scripts are disabled.
- CSS breakpoints tailor layouts for mobile, tablet, and desktop. Scroll-driven header behavior only activates at appropriate viewport widths.
- Netlify redirects provide clean URLs for marketing campaigns while preserving indexable `.html` pages.

## Further documentation & assets

- **CMS onboarding** – [`docs/decap-cms-setup.md`](docs/decap-cms-setup.md) explains how to enable the `/admin` interface for non-technical editors.
- **Preview guidance** – [`docs/previews/README.md`](docs/previews/README.md) outlines the preview flow for stakeholders.
- **Collateral** – Shareable brochures live in [`downloads/`](downloads) and [`PDF/`](PDF).
- **Accessibility statement** – [`accessibility.html`](accessibility.html) documents the company’s commitment to inclusive design.

Have a question or improvement idea? Open an issue or start a discussion to keep the site evolving alongside Riveroak’s projects.
