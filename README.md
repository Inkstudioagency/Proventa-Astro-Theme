# Proventa — Astro SaaS Theme

A conversion-focused Astro theme for Business, Software and SaaS companies.
Twelve pages, a blog and a case-study collection, Webflow-quality motion, and an
**optional** Strapi backend for the content.

## Quick start

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview
```

That is the whole setup. The theme ships with its content already in the repo,
so it builds with no database, no API keys and no backend running.

## Pages

| Route | | Route | |
| --- | --- | --- | --- |
| `/` | Home | `/blog/[slug]` | Blog post |
| `/features` | Features | `/case-study/[slug]` | Case study |
| `/blog` | Blog index, category tabs | `/sign-in` `/sign-up` | Auth |
| `/customers` | Case studies, industry tabs | `/forgot-password` | Auth |
| `/contact` | Contact | `/style-guide` | Style guide |
| `/search` | Search results | `/404` | Not found |

## Content

Two collections — **Blog** (16 entries) and **Case Study** (9 entries) — with two
interchangeable sources:

| `STRAPI_URL` | Source | Use for |
| --- | --- | --- |
| unset *(default)* | `src/data/*.json` + `public/cms/` | building, deploying, shipping |
| set | live Strapi REST API | authoring content |

Editing content is therefore optional. To edit it in a real CMS:

```bash
cd Strapi
npm install
npm run seed        # imports seed-data/*.csv and its images (once)
npm run develop     # http://localhost:1337 — create your admin user
```

Then point the site at it and refresh the committed snapshot when you are done:

```bash
echo "STRAPI_URL=http://localhost:1337" > .env
npm run snapshot    # rewrites src/data/*.json and public/cms/
```

`npm run snapshot` is what keeps the zero-config build in sync with the CMS.
Without it the site still builds — just from the previous snapshot.

### Strapi MCP server

The backend enables Strapi's built-in [MCP server](https://docs.strapi.io/cms/features/strapi-mcp-server)
at `http://localhost:1337/mcp`, so an AI client can create and edit entries. Add
an API token in **Settings → API Tokens**, then:

```bash
claude mcp add strapi-mcp --transport http http://localhost:1337/mcp \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Set `MCP_ENABLED=false` in `Strapi/.env` to turn it off.

## Structure

```
src/layouts/BaseLayout.astro   <head>, meta, Webflow + GSAP script stack
src/components/                Navbar, Footer, card + collection components
src/lib/strapi.ts              content source (snapshot or live Strapi)
src/lib/webflow.ts             scroll-in style, lightbox payload
src/data/                      committed content snapshot
src/pages/                     one file per route
public/                        css, js, images, videos, cms media
scripts/snapshot.mjs           Strapi -> src/data + public/cms
Strapi/                        optional CMS (Strapi 5, SQLite in dev)
```

Styling is the original Webflow CSS bundle in `public/css/`; there is no Tailwind
or preprocessor step. Interactions are Webflow's IX2 engine plus GSAP
ScrollTrigger / SplitText.

## Deploying

Any static host works. The build needs no environment variables — leave
`STRAPI_URL` unset in production so the deploy uses the committed snapshot.

For Vercel: framework preset **Astro**, build `npm run build`, output `dist`.

## Credits

Design and development by [Ink Studio](https://www.inks.studio/).
Licensed under the [MIT License](LICENSE).
