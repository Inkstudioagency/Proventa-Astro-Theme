/**
 * Inline style Webflow's IX2 engine writes on elements that animate in on
 * scroll. It has to be present in the initial HTML or the element flashes
 * before webflow.js takes over.
 */
export const SCROLL_IN_STYLE =
  'opacity:0;-webkit-transform:translate3d(0, 80px, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);' +
  '-moz-transform:translate3d(0, 80px, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);' +
  '-ms-transform:translate3d(0, 80px, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);' +
  'transform:translate3d(0, 80px, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0)';

/** Payload Webflow's lightbox reads from the `w-json` script inside a link. */
export function lightboxVideoJson(url: string) {
  const id = url.match(/[?&]v=([^&]+)/)?.[1] ?? url.split('/').pop() ?? '';
  const embed =
    `//cdn.embedly.com/widgets/media.html?src=${encodeURIComponent(
      `https://www.youtube.com/embed/${id}?feature=oembed`,
    )}&display_name=YouTube&url=${encodeURIComponent(url)}` +
    `&image=${encodeURIComponent(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}&type=text%2Fhtml&schema=youtube`;

  return JSON.stringify(
    {
      items: [
        {
          url,
          originalUrl: url,
          width: 940,
          height: 528,
          thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          html:
            `<iframe class="embedly-embed" src="${embed}" width="940" height="528" scrolling="no" ` +
            `title="YouTube embed" frameborder="0" allow="autoplay; fullscreen; encrypted-media; picture-in-picture;" ` +
            `allowfullscreen="true"></iframe>`,
          type: 'video',
        },
      ],
      group: '',
    },
    null,
    2,
  );
}
