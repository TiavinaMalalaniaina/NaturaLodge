import type { APIRoute } from 'astro';

// Production robots.txt. Outside production the Dockerfile overwrites it with `Disallow: /`.
// Customer pages are not disallowed on purpose: crawlers must fetch them to see their noindex.
export const GET: APIRoute = ({ site }) => {
  const lines = ['User-agent: *', 'Allow: /'];
  if (site) lines.push('', `Sitemap: ${new URL('/sitemap.xml', site).toString()}`);
  return new Response(`${lines.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
