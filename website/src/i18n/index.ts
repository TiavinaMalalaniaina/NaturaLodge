export type Lang = 'fr' | 'en';
export const languages: Lang[] = ['fr', 'en'];

// French pages live at the root, English ones under /en/ (same slugs, so links and the server's
// `next` parameter stay identical across languages).
export const langFromPath = (pathname: string): Lang => (pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'fr');
export const localePath = (lang: Lang, path: string) => (lang === 'en' ? `/en${path === '/' ? '/' : path}` : path);
export const stripLang = (pathname: string) => (langFromPath(pathname) === 'en' ? pathname.slice(3) || '/' : pathname);
export const alternatePath = (pathname: string, target: Lang) => localePath(target, stripLang(pathname));

// For scripts: the page language is set on <html lang>.
export const pageLang = (): Lang => (document.documentElement.lang === 'en' ? 'en' : 'fr');

export const dateLocale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'fr-FR');
export const formatPrice = (price: number, lang: Lang = 'fr') => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR').format(price);
