import type { Core } from '@strapi/strapi';

/** Content types the Astro front end reads anonymously at build time. */
const PUBLIC_READ = ['api::blog.blog', 'api::case-study.case-study'];

/**
 * Grants `find` / `findOne` on the public role so the Astro site can fetch
 * content without a token. Runs on every boot and is idempotent.
 */
async function grantPublicRead(strapi: Core.Strapi) {
  const publicRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!publicRole) return;

  for (const uid of PUBLIC_READ) {
    for (const action of ['find', 'findOne']) {
      const permission = `${uid}.${action}`;
      const existing = await strapi
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action: permission, role: publicRole.id } });

      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action: permission, role: publicRole.id },
        });
        strapi.log.info(`[proventa] granted public read access to ${permission}`);
      }
    }
  }
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await grantPublicRead(strapi);
  },
};
