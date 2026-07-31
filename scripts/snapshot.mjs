/**
 * Freezes the current Strapi content into the repo so the theme builds with no
 * backend running.
 *
 *   STRAPI_URL=http://localhost:1337 node scripts/snapshot.mjs
 *
 * Writes src/data/*.json and copies every referenced image into public/cms/.
 * Media URLs are rewritten from /uploads/... to /cms/..., so the snapshot is
 * self-contained and hostname-free.
 *
 * Re-run after editing content in Strapi to refresh what the demo shows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const MEDIA_DIR = path.join(ROOT, 'public', 'cms');

const STRAPI_URL = (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/$/, '');

const downloaded = new Set();

async function download(uploadPath) {
  const name = path.basename(uploadPath);
  const dest = path.join(MEDIA_DIR, name);
  if (!downloaded.has(name)) {
    const res = await fetch(`${STRAPI_URL}${uploadPath}`);
    if (!res.ok) {
      console.warn(`  ! ${res.status} ${uploadPath}`);
      return uploadPath;
    }
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    downloaded.add(name);
  }
  return `/cms/${name}`;
}

/** Walks an entry, pulling every /uploads/... reference local. */
async function localise(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = await localise(value[i]);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = await localise(value[key]);
    return value;
  }
  if (typeof value === 'string') {
    if (value.startsWith('/uploads/')) return download(value);
    // rich text carries <img src="/uploads/...">
    if (value.includes('/uploads/')) {
      const refs = [...value.matchAll(/\/uploads\/[^"')\s]+/g)].map((m) => m[0]);
      let out = value;
      for (const ref of new Set(refs)) out = out.split(ref).join(await download(ref));
      return out;
    }
  }
  return value;
}

async function fetchAll(collection, sort) {
  const qs = new URLSearchParams({
    populate: '*',
    'pagination[pageSize]': '100',
    'sort[0]': sort,
  });
  const res = await fetch(`${STRAPI_URL}/api/${collection}?${qs}`);
  if (!res.ok) throw new Error(`Strapi returned ${res.status} for /api/${collection}`);
  const { data } = await res.json();
  return data;
}

/** Keep the snapshot readable: drop Strapi's bookkeeping fields. */
function slim(entry) {
  const { createdAt, updatedAt, publishedAt, locale, ...rest } = entry;
  for (const key of Object.keys(rest)) {
    const v = rest[key];
    if (v && typeof v === 'object' && 'url' in v) {
      rest[key] = {
        url: v.url,
        alternativeText: v.alternativeText ?? null,
        width: v.width,
        height: v.height,
      };
    }
  }
  return rest;
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.rmSync(MEDIA_DIR, { recursive: true, force: true });
  fs.mkdirSync(MEDIA_DIR, { recursive: true });

  for (const [collection, sort, file] of [
    ['blogs', 'publishDate:desc', 'blogs.json'],
    ['case-studies', 'publishDate:desc', 'case-studies.json'],
  ]) {
    // slim first, so the unused responsive variants are never downloaded
    const slimmed = await localise((await fetchAll(collection, sort)).map(slim));
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(slimmed, null, 2) + '\n');
    console.log(`${file}: ${slimmed.length} entries`);
  }

  console.log(`public/cms/: ${downloaded.size} images`);
}

main().catch((err) => {
  console.error(err.message);
  console.error(`\nIs Strapi running at ${STRAPI_URL}? Start it with \`npm run develop\` in strapi/.`);
  process.exit(1);
});
