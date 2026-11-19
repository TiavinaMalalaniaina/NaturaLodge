import type { APIRoute } from 'astro';
import { alternatePath, languages } from '../i18n';
import { legalSlugs } from '../i18n/legal';

// Indexable pages only (French paths). Customer pages (login, booking, my bookings) are noindex and stay out.
const pages = ['/', ...Object.values(legalSlugs)];

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = ({ site }) => {
  if (!site) return new Response(null, { status: 404 });
  const url = (path: string) => escape(new URL(path, site).toString());
  const entries = pages.flatMap(page => languages.map(lang => {
    const links = languages.map(other => `<xhtml:link rel="alternate" hreflang="${other}" href="${url(alternatePath(page, other))}"/>`);
    links.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${url(alternatePath(page, 'fr'))}"/>`);
    return `<url><loc>${url(alternatePath(page, lang))}</loc>${links.join('')}</url>`;
  }));
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
