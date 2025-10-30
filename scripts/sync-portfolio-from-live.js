const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { parseYaml } = require('./lib/parse-yaml');

const args = process.argv.slice(2);
const repoRoot = path.join(__dirname, '..');
const configPath = path.join(repoRoot, 'admin', 'config.yml');
const projectsDir = path.join(repoRoot, 'content', 'projects');
const portfolioDir = path.join(repoRoot, 'portfolio');

function printUsage() {
  console.log('Usage: node scripts/sync-portfolio-from-live.js [--all] [slug ...] [--site <url>] [--dry-run]');
  console.log('       npm run sync:portfolio -- --dry-run');
}

function parseArgs(list) {
  const options = {
    all: false,
    dryRun: false,
    siteUrl: null,
    slugs: [],
  };

  for (let index = 0; index < list.length; index += 1) {
    const value = list[index];
    if (value === '--help' || value === '-h') {
      printUsage();
      process.exit(0);
    }

    if (value === '--all') {
      options.all = true;
      continue;
    }

    if (value === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (value === '--site') {
      const next = list[index + 1];
      if (!next) {
        throw new Error('Missing value after --site');
      }
      options.siteUrl = next;
      index += 1;
      continue;
    }

    if (value.startsWith('--site=')) {
      options.siteUrl = value.slice('--site='.length);
      continue;
    }

    if (value.startsWith('-')) {
      throw new Error(`Unknown option: ${value}`);
    }

    options.slugs.push(value);
  }

  return options;
}

function discoverSlugs() {
  return fs
    .readdirSync(projectsDir)
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => file.replace(/\.yaml$/, ''))
    .sort();
}

function loadYaml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return parseYaml(raw);
}

function normalizeSiteUrl(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;
  return trimmed.replace(/\/$/, '');
}

function resolveSiteUrl(explicit) {
  const siteFromArg = normalizeSiteUrl(explicit);
  if (siteFromArg) {
    return siteFromArg;
  }

  if (!fs.existsSync(configPath)) {
    throw new Error('admin/config.yml not found. Provide a site with --site.');
  }

  const config = loadYaml(configPath);
  if (config.site_url) {
    return normalizeSiteUrl(config.site_url);
  }

  throw new Error('site_url missing from admin/config.yml. Provide a site with --site.');
}

function resolveSlugs(options) {
  if (options.all || options.slugs.length === 0) {
    return discoverSlugs();
  }

  return options.slugs;
}

function ensurePortfolioDir() {
  if (!fs.existsSync(portfolioDir)) {
    fs.mkdirSync(portfolioDir, { recursive: true });
  }
}

function fetchUrl(targetUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const client = url.protocol === 'http:' ? http : https;

    const request = client.get(
      url,
      {
        headers: {
          'User-Agent': 'riveroak-sync-script/1.0 (+https://riveroakbuilding.com) Node.js',
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      (response) => {
        const { statusCode, headers } = response;

        if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
          if (redirectCount >= 5) {
            response.resume();
            reject(new Error(`Too many redirects while fetching ${targetUrl}`));
            return;
          }

          const nextUrl = new URL(headers.location, url);
          response.resume();
          resolve(fetchUrl(nextUrl.toString(), redirectCount + 1));
          return;
        }

        if (statusCode !== 200) {
          response.resume();
          reject(new Error(`Request for ${targetUrl} failed with status ${statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
      }
    );

    request.on('error', (error) => {
      reject(error);
    });
  });
}

function resolveOutputFilename(project, slug) {
  const filename = project.output_filename && String(project.output_filename).trim();
  if (filename) {
    return filename.replace(/^\/+/, '');
  }
  return `portfolio-${slug}.html`;
}

async function downloadProject(siteUrl, slug, dryRun) {
  const projectPath = path.join(projectsDir, `${slug}.yaml`);
  if (!fs.existsSync(projectPath)) {
    console.warn(`Skipping ${slug} because ${projectPath} is missing.`);
    return { skipped: true };
  }

  const project = loadYaml(projectPath);
  const outputFilename = resolveOutputFilename(project, slug);
  const relativePath = outputFilename.startsWith('portfolio/')
    ? outputFilename
    : path.posix.join('portfolio', outputFilename);
  const remoteUrl = new URL(relativePath, `${siteUrl}/`).toString();
  const destinationPath = path.join(portfolioDir, outputFilename);

  if (dryRun) {
    console.log(`[dry-run] Would download ${remoteUrl} -> ${path.relative(repoRoot, destinationPath)}`);
    return { skipped: false, dryRun: true };
  }

  const html = await fetchUrl(remoteUrl);
  fs.writeFileSync(destinationPath, html);
  console.log(`Saved ${path.relative(repoRoot, destinationPath)}`);
  return { skipped: false, dryRun: false };
}

async function main() {
  const options = parseArgs(args);
  const slugs = resolveSlugs(options);
  if (slugs.length === 0) {
    console.error('No projects found. Add YAML files to content/projects or pass slugs to sync.');
    process.exit(1);
  }

  const siteUrl = resolveSiteUrl(options.siteUrl);
  ensurePortfolioDir();

  let failures = 0;
  for (const slug of slugs) {
    try {
      await downloadProject(siteUrl, slug, options.dryRun);
    } catch (error) {
      failures += 1;
      let detail = 'Unknown error';
      if (error) {
        if (Array.isArray(error.errors) && error.errors.length > 0) {
          detail = error.errors.map((item) => (item && item.message ? item.message : String(item))).join('; ');
        } else if (error.message) {
          detail = error.message;
        } else {
          detail = String(error);
        }
      }
      console.error(`Failed to download ${slug}: ${detail}`);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
