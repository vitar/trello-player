// Assembles the deployable GitHub Pages site from src/trello-power-up.
//
// Usage: PROXY_URL=https://your-proxy.workers.dev/ node scripts/prepare-site.mjs [outDir]
//
// Run `npm run build` first so the popup bundle exists. Fails when PROXY_URL is
// missing or not an https URL, so a deployment never ships the placeholder proxy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteSource = path.join(projectRoot, 'src/trello-power-up');
const requiredFiles = [
  'trello-player-power-up.html',
  'trello-player-power-up-popup.html',
  'trello-player-power-up-popup.js',
];

export function validateProxyUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      'PROXY_URL is not set. Configure it under Settings → Secrets and variables → Actions → Variables.',
    );
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`PROXY_URL is not a valid URL: ${value}`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`PROXY_URL must use https: ${value}`);
  }
  return url.toString();
}

export function renderConfig(proxyUrl) {
  return (
    'window.trelloPlayerConfig = window.trelloPlayerConfig || {};\n' +
    `window.trelloPlayerConfig.proxyUrl = ${JSON.stringify(proxyUrl)};\n`
  );
}

export function prepareSite({ outDir, proxyUrl }) {
  const validProxyUrl = validateProxyUrl(proxyUrl);
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(siteSource, file))) {
      throw new Error(`Missing ${file}; run \`npm run build\` first.`);
    }
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(siteSource, outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'trello-player-config.js'), renderConfig(validProxyUrl));
  // GitHub Pages skips files and folders starting with _ unless this exists.
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = path.resolve(process.argv[2] ?? path.join(projectRoot, 'dist/site'));
  try {
    prepareSite({ outDir, proxyUrl: process.env.PROXY_URL });
    console.log(`Site prepared in ${path.relative(projectRoot, outDir) || outDir}`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
