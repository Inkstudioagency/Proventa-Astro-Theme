/**
 * Content source for the theme, with two modes.
 *
 * - **STRAPI_URL set** — read live from the Strapi project in `strapi/`
 *   (collection types `blog` and `case-study`). Use this while authoring.
 * - **STRAPI_URL unset** — read the snapshot committed at `src/data/*.json`,
 *   with its images in `public/cms/`. This is the default, so a fresh clone
 *   builds with no backend running.
 *
 * Refresh the snapshot after editing content: `npm run snapshot`.
 */
import blogSnapshot from '../data/blogs.json';
import caseStudySnapshot from '../data/case-studies.json';

const STRAPI_URL = (import.meta.env.STRAPI_URL || '').replace(/\/$/, '');
const STRAPI_TOKEN = import.meta.env.STRAPI_TOKEN || '';

/** True when the build is talking to a live Strapi rather than the snapshot. */
export const usingStrapi = Boolean(STRAPI_URL);

export interface StrapiMedia {
  url: string;
  alternativeText?: string | null;
  width?: number;
  height?: number;
}

export interface Blog {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  summary: string;
  thumbnail: StrapiMedia | null;
  mainImage: StrapiMedia | null;
  authorName: string;
  authorImage: StrapiMedia | null;
  authorDesignation: string;
  category: string;
  socialLinkOne: string;
  socialLinkTwo: string;
  socialLinkThree: string;
  socialLinkFour: string;
  details: string;
  isFeatured: boolean;
  publishDate: string;
}

export interface CaseStudy {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  summary: string;
  shortText: string;
  darkLogo: StrapiMedia | null;
  whiteLogo: StrapiMedia | null;
  mainImage: StrapiMedia | null;
  industry: string;
  companySize: string;
  location: string;
  videoLink: string;
  details: string;
  publishDate: string;
}

/**
 * URL for a media object. Snapshot entries already point at `/cms/...`; live
 * Strapi returns `/uploads/...`, which needs the backend host in front.
 */
export function mediaUrl(media: StrapiMedia | null | undefined): string {
  if (!media?.url) return '';
  if (media.url.startsWith('http') || media.url.startsWith('/cms/')) return media.url;
  return `${STRAPI_URL}${media.url}`;
}

/**
 * Rich text stores media as relative paths so the content is not tied to a
 * hostname. Snapshot paths (`/cms/...`) are already correct; live Strapi paths
 * (`/uploads/...`) are resolved against the backend.
 */
export function richText(html: string | null | undefined): string {
  if (!html) return '';
  if (!usingStrapi) return html;
  return html.replace(/(src|href)="\/uploads\//g, `$1="${STRAPI_URL}/uploads/`);
}

async function fetchCollection<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const qs = new URLSearchParams({
    populate: '*',
    'pagination[pageSize]': '100',
    ...params,
  });
  const url = `${STRAPI_URL}/api/${path}?${qs}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: STRAPI_TOKEN ? { Authorization: `Bearer ${STRAPI_TOKEN}` } : {},
    });
  } catch (cause) {
    throw new Error(
      `STRAPI_URL is set to ${STRAPI_URL} but nothing is listening there. ` +
        `Start the backend with \`npm run develop\` in strapi/, or unset STRAPI_URL ` +
        `to build from the committed snapshot in src/data/.`,
      { cause },
    );
  }

  if (!res.ok) {
    throw new Error(
      `Strapi returned ${res.status} for /api/${path}. ` +
        `If this is a 403, enable find/findOne for the Public role in Settings → Roles → Public.`,
    );
  }

  const json = await res.json();
  return json.data as T[];
}

export async function getBlogs(): Promise<Blog[]> {
  if (!usingStrapi) return blogSnapshot as unknown as Blog[];
  return fetchCollection<Blog>('blogs', { 'sort[0]': 'publishDate:desc' });
}

export async function getCaseStudies(): Promise<CaseStudy[]> {
  if (!usingStrapi) return caseStudySnapshot as unknown as CaseStudy[];
  return fetchCollection<CaseStudy>('case-studies', { 'sort[0]': 'publishDate:desc' });
}

/** Categories used by the blog page tab filter, in template order. */
export const BLOG_CATEGORIES = [
  'Management',
  'Compliance',
  'Strategy',
  'Marketing',
  'Leadership',
  'Productivity',
] as const;

/** "Fri Jul 31 2026" style date used on the blog detail page. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
