/**
 * Seeds the Blog and Case Study collections from the CSV exports in ../CMS.
 *
 *   npm run seed
 *
 * Images referenced by the CSVs are downloaded once into .seed-cache/ and then
 * uploaded to Strapi's media library, so the content is fully self-contained.
 * Re-running replaces every entry (the seed owns these collections).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const CMS_DIR = path.resolve(__dirname, '..', 'seed-data');
const CACHE_DIR = path.resolve(__dirname, '..', '.seed-cache');

/* ------------------------------------------------------------------ CSV -- */

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift();
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/* ---------------------------------------------------------------- media -- */

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Downloads `url` into the cache and returns the local path (or null). */
async function cacheRemoteFile(url) {
  if (!url) return null;

  const name = decodeURIComponent(url.split('/').pop().split('?')[0]).replace(/[^\w.\- ]+/g, '-');
  const dest = path.join(CACHE_DIR, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ! ${res.status} downloading ${url}`);
    return null;
  }
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

/** Uploads a cached file to the media library, reusing an earlier upload. */
async function uploadOnce(strapi, filepath, memo) {
  if (!filepath) return null;
  if (memo.has(filepath)) return memo.get(filepath);

  const ext = path.extname(filepath).toLowerCase();
  const name = path.basename(filepath, ext);

  // A previous run already put this asset in the media library.
  const known = await strapi.query('plugin::upload.file').findOne({ where: { name } });
  if (known) {
    memo.set(filepath, known.id);
    return known.id;
  }

  const [file] = await strapi.plugin('upload').service('upload').upload({
    data: {},
    files: {
      filepath,
      originalFilename: path.basename(filepath),
      mimetype: MIME[ext] || 'application/octet-stream',
      size: fs.statSync(filepath).size,
    },
  });

  memo.set(filepath, file.id);
  return file.id;
}

/**
 * Rich text exported from Webflow embeds `<img src="https://cdn.prod.website-files.com/...">`.
 * Pull those into the media library too and point the HTML at the local copy,
 * so the content survives the Webflow site going away.
 */
async function localiseRichText(strapi, html, memo) {
  if (!html) return html;

  const urls = [...html.matchAll(/src="(https:\/\/cdn\.prod\.website-files\.com\/[^"]+)"/g)].map(
    (m) => m[1],
  );

  let out = html;
  for (const url of new Set(urls)) {
    const id = await uploadOnce(strapi, await cacheRemoteFile(url), memo);
    if (!id) continue;
    const file = await strapi.query('plugin::upload.file').findOne({ where: { id } });
    // Stored relative; the Astro side prefixes STRAPI_URL when rendering.
    out = out.split(`src="${url}"`).join(`src="${file.url}"`);
  }
  return out;
}

/** Webflow's "Mon Apr 20 2026 ..." strings -> YYYY-MM-DD. */
function toDate(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/* ----------------------------------------------------------------- seed -- */

async function wipe(strapi, uid) {
  const existing = await strapi.documents(uid).findMany({ fields: ['id'], limit: -1, status: 'draft' });
  for (const doc of existing) {
    await strapi.documents(uid).delete({ documentId: doc.documentId });
  }
  return existing.length;
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const app = await createStrapi(await compileStrapi()).load();
  const memo = new Map();

  try {
    const blogs = parseCsv(fs.readFileSync(path.join(CMS_DIR, 'Blog CMS.csv'), 'utf8'));
    const caseStudies = parseCsv(fs.readFileSync(path.join(CMS_DIR, 'Case Studies CMG.csv'), 'utf8'));

    console.log(`Removed ${await wipe(app, 'api::blog.blog')} existing blogs`);
    console.log(`Removed ${await wipe(app, 'api::case-study.case-study')} existing case studies`);

    for (const row of blogs) {
      if (row['Archived'] === 'true') continue;
      console.log(`Blog: ${row['Blog Title']}`);

      const [thumbnail, mainImage, authorImage] = await Promise.all([
        cacheRemoteFile(row['Blog Thumbnail']),
        cacheRemoteFile(row['Blog Main Image']),
        cacheRemoteFile(row['Blog Author Image']),
      ]);

      await app.documents('api::blog.blog').create({
        status: row['Draft'] === 'true' ? 'draft' : 'published',
        data: {
          title: row['Blog Title'],
          slug: row['Slug'],
          summary: row['Blog Summary'],
          thumbnail: await uploadOnce(app, thumbnail, memo),
          mainImage: await uploadOnce(app, mainImage, memo),
          authorName: row['Blog Author Name'],
          authorImage: await uploadOnce(app, authorImage, memo),
          authorDesignation: row['Blog Author Designation'],
          category: row['Blog Category'] || null,
          socialLinkOne: row['Blog Social Link One'],
          socialLinkTwo: row['Blog Social Link Two'],
          socialLinkThree: row['Blog Social Link Three'],
          socialLinkFour: row['Blog Social Link Four'],
          details: await localiseRichText(app, row['Blog Details Text'], memo),
          isFeatured: row['Is Feature?'] === 'true',
          publishDate: toDate(row['Published On'] || row['Created On']),
        },
      });
    }

    for (const row of caseStudies) {
      if (row['Archived'] === 'true') continue;
      console.log(`Case study: ${row['Case Study Name']}`);

      const [mainImage, darkLogo, whiteLogo] = await Promise.all([
        cacheRemoteFile(row['Case Study Main Image']),
        cacheRemoteFile(row['Case Study Dark Logo']),
        cacheRemoteFile(row['Case Study White Logo']),
      ]);

      await app.documents('api::case-study.case-study').create({
        status: row['Draft'] === 'true' ? 'draft' : 'published',
        data: {
          title: row['Case Study Name'],
          slug: row['Slug'],
          summary: row['Case Study Summary'],
          shortText: row['Case Study Short Text'],
          mainImage: await uploadOnce(app, mainImage, memo),
          darkLogo: await uploadOnce(app, darkLogo, memo),
          whiteLogo: await uploadOnce(app, whiteLogo, memo),
          industry: row['Case Study Industry'] || null,
          companySize: row['Company Size'],
          location: row['Location'],
          videoLink: row['Case Study Video Link'],
          details: await localiseRichText(app, row['Case Study Details Text'], memo),
          publishDate: toDate(row['Published On'] || row['Created On']),
        },
      });
    }

    console.log(`\nSeeded ${blogs.length} blogs and ${caseStudies.length} case studies.`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
