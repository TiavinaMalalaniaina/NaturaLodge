import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../lib/logger';

type Lang = 'fr' | 'en';
const configured = () => !!(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.WEBSITE_URL);
let cached: Transporter | null = null;
function transport(): Transporter {
  cached ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  return cached;
}
// English pages live under /en/ on the website, French ones at the root.
const siteUrl = (lang: Lang, path: string) => new URL(`${lang === 'en' ? '/en' : ''}${path}`, process.env.WEBSITE_URL);
const dateLocale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'fr-FR');
// Stay dates are stored at UTC midnight: format them in UTC so they never shift by a day.
const day = (date: Date, lang: Lang) => date.toLocaleDateString(dateLocale(lang), { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const amount = (value: number, lang: Lang) => `${value.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} Ar`;

const text = {
  fr: {
    loginSubject: 'Natura Lodge — Votre connexion',
    login: (link: string) => `Bonjour,\n\nPour vous connecter ou créer votre espace client, ouvrez ce lien :\n${link}\n\nCe lien est valable 15 minutes et utilisable une seule fois. Ne le partagez pas. Si vous n’avez pas demandé cette connexion, ignorez cet email.\n\nNatura Lodge`,
    subjects: { PENDING: 'Demande reçue', AWAITING_PAYMENT: 'Demande acceptée — acompte à régler', CONFIRMED: 'Réservation confirmée', REJECTED: 'Réponse à votre demande', EXPIRED: 'Délai de paiement expiré', CANCELLED: 'Réservation annulée' } as Record<string, string>,
    intros: {
      PENDING: 'Votre demande a bien été reçue. Elle doit encore être validée par notre équipe.',
      AWAITING_PAYMENT: 'Votre demande est acceptée. Merci de régler l’acompte selon les instructions ci-dessous.',
      CONFIRMED: 'Votre acompte a été vérifié. Votre réservation est confirmée.',
      REJECTED: 'Nous ne pouvons pas donner suite à votre demande.',
      EXPIRED: 'Le délai de paiement de votre demande est expiré. Les chambres ont été libérées ; vous pouvez faire une nouvelle demande.',
      CANCELLED: 'Votre réservation est annulée. Contactez-nous pour toute question.',
    } as Record<string, string>,
    fallbackSubject: 'Suivi de votre demande', fallbackIntro: 'Voici le suivi de votre demande.',
    hello: (name: string) => `Bonjour ${name},`,
    reference: 'Référence', stay: (a: string, b: string) => `Séjour : du ${a} au ${b}`, total: 'Total', deposit: 'Acompte',
    deadline: (d: string) => `À régler avant le ${d} (heure de Madagascar).`,
    view: 'Consulter ma réservation', signIn: 'Connectez-vous avec votre adresse email pour consulter toutes vos demandes.',
  },
  en: {
    loginSubject: 'Natura Lodge — Your sign-in link',
    login: (link: string) => `Hello,\n\nTo sign in or create your guest account, open this link:\n${link}\n\nThis link is valid for 15 minutes and can be used only once. Do not share it. If you did not request it, simply ignore this email.\n\nNatura Lodge`,
    subjects: { PENDING: 'Request received', AWAITING_PAYMENT: 'Request accepted — deposit due', CONFIRMED: 'Booking confirmed', REJECTED: 'About your request', EXPIRED: 'Payment deadline passed', CANCELLED: 'Booking cancelled' } as Record<string, string>,
    intros: {
      PENDING: 'We have received your request. Our team still needs to approve it.',
      AWAITING_PAYMENT: 'Your request has been accepted. Please pay the deposit following the instructions below.',
      CONFIRMED: 'Your deposit has been verified. Your booking is confirmed.',
      REJECTED: 'Unfortunately we cannot accept your request.',
      EXPIRED: 'The payment deadline for your request has passed. The rooms have been released; you are welcome to make a new request.',
      CANCELLED: 'Your booking has been cancelled. Please contact us if you have any question.',
    } as Record<string, string>,
    fallbackSubject: 'Your request', fallbackIntro: 'Here is an update on your request.',
    hello: (name: string) => `Hello ${name},`,
    reference: 'Reference', stay: (a: string, b: string) => `Stay: from ${a} to ${b}`, total: 'Total', deposit: 'Deposit',
    deadline: (d: string) => `Please pay before ${d} (Madagascar time).`,
    view: 'View my booking', signIn: 'Sign in with your email address to see all your requests.',
  },
};

export async function sendLoginMail(email: string, token: string, next = '/mes-reservations', lang: Lang = 'fr'): Promise<boolean> {
  if (!configured()) return false;
  try {
    const link = siteUrl(lang, '/connexion/');
    if (next === '/reservation') link.searchParams.set('next', '/reservation');
    link.hash = new URLSearchParams({ login: token }).toString();
    await transport().sendMail({ from: process.env.MAIL_FROM, to: email, subject: text[lang].loginSubject, text: text[lang].login(link.toString()) });
    return true;
  } catch { logger.error('Échec de l’envoi de l’email de connexion'); return false; }
}

// Notes written by the system (not by staff) have a fixed French wording.
const systemNotesEn: Record<string, string> = {
  'Annulée à votre demande.': 'Cancelled at your request.',
  'Le séjour a été annulé par l’hôtel.': 'The stay was cancelled by the hotel.',
};

type RequestMail = { reference: string; email: string; name: string; arrival: Date; departure: Date; totalAmount: number; depositAmount: number; status: string; paymentInstructions: string; decisionNote: string; expiresAt: Date | null; locale?: 'FR' | 'EN' };

export async function sendRequestMail(row: RequestMail): Promise<boolean> {
  if (!configured()) {
    logger.warn({ reference: row.reference }, 'Email réservation indisponible : configuration SMTP incomplète');
    return false;
  }
  const lang: Lang = row.locale === 'EN' ? 'en' : 'fr';
  const t = text[lang];
  const sep = lang === 'en' ? ':' : ' :';
  try {
    const body = [t.hello(row.name), t.intros[row.status] || t.fallbackIntro,
      `${t.reference}${sep} ${row.reference}`, t.stay(day(row.arrival, lang), day(row.departure, lang)),
      `${t.total}${sep} ${amount(row.totalAmount, lang)}`, `${t.deposit}${sep} ${amount(row.depositAmount, lang)}`,
      row.status === 'AWAITING_PAYMENT' ? row.paymentInstructions : '',
      row.status === 'AWAITING_PAYMENT' && row.expiresAt ? t.deadline(row.expiresAt.toLocaleString(dateLocale(lang), { timeZone: 'Indian/Antananarivo', dateStyle: 'full', timeStyle: 'short' })) : '',
      row.status === 'REJECTED' || row.status === 'CANCELLED' ? (lang === 'en' ? systemNotesEn[row.decisionNote] ?? row.decisionNote : row.decisionNote) : '',
      `${t.view}${sep} ${siteUrl(lang, '/mes-reservations/').toString()}`, t.signIn, 'Natura Lodge',
    ].filter(Boolean).join('\n\n');
    await transport().sendMail({ from: process.env.MAIL_FROM, to: row.email, subject: `Natura Lodge — ${t.subjects[row.status] ?? t.fallbackSubject} — ${row.reference}`, text: body });
    return true;
  } catch {
    // Do not log SMTP credentials, recipient details or the private tracking link.
    logger.error({ reference: row.reference }, 'Échec de l’envoi de l’email de réservation');
    return false;
  }
}
