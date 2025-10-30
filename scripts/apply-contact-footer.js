const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
function buildFooterTemplate(activeLink) {
  const isActive = (link) => (activeLink === link ? ' class="active"' : '');

  return `  <footer class="site-footer contact-footer">
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
            <a href="/about.html"${isActive('about')}>About</a>
            <a href="/portfolio/portfolio.html"${isActive('portfolio')}>Portfolio</a>
            <a href="/riveroak-building-company-process.html"${isActive('process')}>Process</a>
            <a href="/contact.html"${isActive('contact')}>Contact</a>
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
}

const excludedDirs = new Set(['node_modules', '.git', 'downloads', 'PDF']);

const htmlFiles = [];

function collectHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach((entry) => {
    if (excludedDirs.has(entry.name)) {
      return;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectHtmlFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(fullPath);
    }
  });
}

collectHtmlFiles(projectRoot);

const footerPattern = /<footer class="site-footer[\s\S]*?<\/footer>/;

function resolveActiveLink(filePath) {
  const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

  if (relativePath.endsWith('contact.html')) {
    return 'contact';
  }

  if (relativePath.endsWith('about.html')) {
    return 'about';
  }

  if (relativePath.includes('portfolio/')) {
    return 'portfolio';
  }

  if (relativePath.endsWith('portfolio.html')) {
    return 'portfolio';
  }

  if (relativePath.includes('process')) {
    return 'process';
  }

  return null;
}

let updatedCount = 0;

htmlFiles.forEach((filePath) => {
  const originalContent = fs.readFileSync(filePath, 'utf8');

  if (!footerPattern.test(originalContent)) {
    return;
  }

  const nextContent = originalContent.replace(footerPattern, buildFooterTemplate(resolveActiveLink(filePath)));

  if (nextContent !== originalContent) {
    fs.writeFileSync(filePath, nextContent);
    updatedCount += 1;
  }
});

console.log(`Updated footers in ${updatedCount} HTML files.`);
