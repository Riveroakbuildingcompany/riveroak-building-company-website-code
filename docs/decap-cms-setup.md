# Decap CMS Setup Guide

This guide explains how to integrate [Decap CMS](https://decapcms.org/) (formerly Netlify CMS) with the Riveroak Building Company marketing site so that you can edit your pages through a friendly admin interface.

## 1. Prerequisites

1. **Repository hosting** – Host this Git repository on GitHub, GitLab, or Bitbucket so Decap CMS can commit content changes.
2. **Deploy target** – Deploy the site to a host that can serve static files and optionally run serverless functions (Netlify, Vercel, Render, etc.). If you stay on Netlify you can use Git Gateway; otherwise use a Git provider backend with an access token.
3. **Authentication method** – Choose one of:
   - **Decap Bridge + Git Gateway** (recommended when the site stays on Netlify).
   - **GitHub backend** (requires creating an OAuth app and environment variables).
   - **GitLab** or **Bitbucket** backends.

Decap CMS stores its configuration and page content in your repository, so the user that logs into the admin UI must have permission to push commits.

## 2. Add the admin interface

1. Create an `admin/` folder at the repository root with two files:

   ```text
   admin/
     index.html
     config.yml
   ```

2. Add the following HTML shell to `admin/index.html` so the CMS UI can load and authenticate:

   ```html
   <!doctype html>
   <html lang="en">
     <head>
       <meta charset="utf-8" />
       <title>Riveroak CMS</title>
       <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
        <script src="https://unpkg.com/@decapcms/decap-cms-app@^1.1.0/dist/decap-cms-app.js"></script>
        <script src="https://unpkg.com/@decapcms/decap-bridge@^1.1.0/dist/decap-bridge.js"></script>
        <script>
          if (window.DecapCMSApp) {
            window.DecapCMSApp.init();
          }
          if (window.DecapBridge) {
            window.DecapBridge.init();
          }
        </script>
      </head>
      <body>
      </body>
    </html>
   ```

   Serve this file at `/admin/` so editors can visit `https://<your-domain>/admin/`.

## 3. Configure the CMS

Populate `admin/config.yml` with your preferred backend and the content files you want to edit. The example below uses Decap Bridge with Git Gateway and treats the existing HTML pages as "files" collections so the CMS can edit their front matter and body content.

```yaml
backend:
  name: git-gateway
  branch: main
media_folder: "images/uploads"
publish_mode: editorial_workflow
collections:
  - label: "Pages"
    name: "pages"
    files:
      - label: "Home"
        name: "home"
        file: "index.html"
        fields:
          - { label: "Title", name: "title", widget: "string" }
          - { label: "Body", name: "body", widget: "markdown" }
      - label: "About"
        name: "about"
        file: "about.html"
        fields:
          - { label: "Title", name: "title", widget: "string" }
          - { label: "Body", name: "body", widget: "markdown" }
```

### Front matter requirement

Decap CMS writes front matter to the top of managed files. Add a YAML front matter block to each HTML page you want to manage so the CMS can parse it:

```html
---
title: "About Riveroak"
---
<!doctype html>
<html lang="en">
  ...
```

Inside the HTML templates (for example `about.html` or `index.html`), replace hard-coded titles or content with template placeholders that read front matter values. Because this project uses plain HTML files, you can expose the values by embedding them with simple server-side templating (e.g., Nunjucks) or by adding a build step that injects the values during deployment. If you prefer not to add a build step, restrict CMS editing to sections that can live inside the front matter `body` field and render it with a small script (see the next section).

## 4. Rendering the CMS-managed content

To display the Markdown `body` field inside an existing HTML file without a build step:

1. Include a placeholder element where you want editable content to appear:

   ```html
   <section id="about-intro"></section>
   ```

2. Add a lightweight Markdown renderer (such as [Marked](https://marked.js.org/)) and fetch the front matter body at runtime. An example snippet you can place near the end of `about.html` is shown below:

   ```html
   <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
   <script type="module">
     import frontMatter from "https://cdn.skypack.dev/front-matter@4";

     fetch("/about.html")
       .then((response) => response.text())
       .then((raw) => {
         const { body } = frontMatter(raw);
         document.getElementById("about-intro").innerHTML = marked.parse(body);
       });
   </script>
   ```

   Adjust the selector and placement as needed for each page. When the CMS commits new Markdown content, this script keeps the public site in sync.

## 5. Enable local previews (optional)

For richer previews, add custom preview templates in `admin/index.html`:

```html
<script>
  CMS.registerPreviewTemplate("about", ({ entry }) => {
    const data = entry.getIn(["data"]);
    return `<h1>${data.get("title")}</h1>\n<div>${data.get("body")}</div>`;
  });
</script>
```

You can also install the local development server that proxies authentication:

```bash
npx decap-server
```

Run this alongside `npm start` so editors can test the CMS locally before deploying.

## 6. Secure the admin route

Because the admin app exposes write access to your repository, block unauthenticated visitors by enforcing Decap Bridge authentication (if you use Git Gateway) or by configuring HTTP Basic Auth / access control on your host. On Netlify you can add the following to `netlify.toml`:

```toml
[[redirects]]
  from = "/admin/*"
  to = "/admin/index.html"
  status = 200
  force = true
```

This ensures the single-page admin app handles all sub-routes required for previews.

## 7. Build data-driven portfolio pages

Portfolio project content now lives in `content/projects/<slug>.yaml` and appears in the **Portfolio Projects** collection inside the CMS. The older static pages remain available under **Portfolio Pages (Legacy HTML)** so you can reference their markup while you migrate them.

Run the build helper before deploying to regenerate the HTML page for any project you edit in the CMS:

```bash
npm run build:portfolio
```

The command compiles every YAML file in `content/projects/` into an HTML page using the **HTML File Name** field (for example `portfolio-craftsman-trussville.html`). Each portfolio project therefore stays mapped to its own standalone HTML document inside the `portfolio/` directory. To rebuild a single project (useful while iterating on a draft), pass its slug:

```bash
npm run build:portfolio -- craftsman-trussville
```

Need to seed your local repository with the latest HTML that’s already live? Use the sync helper to download the production files referenced by each project’s HTML File Name. It reads the `site_url` value from `admin/config.yml` (or accept an override via `--site`):

```bash
# Review the downloads that would occur without writing any files
npm run sync:portfolio -- --dry-run

# Fetch the live HTML for every project and write it into portfolio/
npm run sync:portfolio -- --all

# Limit the sync to a single project
npm run sync:portfolio -- craftsman-trussville
```

The sync step is optional for day-to-day editing, but it’s handy when the deployed site picked up manual changes and you want to ensure the regenerated pages start from that baseline before rerunning `npm run build:portfolio`.

Creating a brand new project works the same way: add it through the **Portfolio Projects** collection (the file name is generated from the title automatically, so you only need to enter the content and set the HTML file name you want under `/portfolio/`), save it, and rerun `npm run build:portfolio`. The script discovers the new YAML file, generates the HTML shell, and overwrites the specified HTML file so the live portfolio stays in sync without renaming other pages.

## 8. Deploy changes

1. Commit the new `admin/` files and any front matter updates.
2. Push to your Git host and trigger a new deploy on your hosting platform.
3. Visit `/admin/`, authenticate, and begin editing content. Any edits made in Decap CMS will open pull requests or commit directly to `main` depending on your `publish_mode`.

Refer to the [Decap CMS documentation](https://decapcms.org/docs/intro/) for advanced widgets, editorial workflows, and custom previews.
