import nodemailer from 'nodemailer';
import { logger } from '../lib/logger';

export async function sendLoginMail(email: string, token: string, next = '/mes-reservations'): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM || !process.env.WEBSITE_URL) return false;
  try {
    const link = new URL('/connexion/', process.env.WEBSITE_URL);
    if (next === '/reservation') link.searchParams.set('next', '/reservation');
    link.hash = new URLSearchParams({ login: token }).toString();
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
    await transport.sendMail({ from: process.env.MAIL_FROM, to: email, subject: 'Natura Lodge — Votre connexion',
      text: `Bonjour,\n\nPour vous connecter ou créer votre espace client, ouvrez ce lien :\n${link.toString()}\n\nCe lien est valable 15 minutes et utilisable une seule fois. Ne le partagez pas. Si vous n’avez pas demandé cette connexion, ignorez cet email.\n\nNatura Lodge`,
    });
    return true;
  } catch { logger.error('Échec de l’envoi de l’email de connexion'); return false; }
}

type RequestMail = { reference: string; email: string; name: string; arrival: Date; departure: Date; totalAmount: number; depositAmount: number; status: string; paymentInstructions: string; decisionNote: string; expiresAt: Date | null };

export async function sendRequestMail(row: RequestMail): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM || !process.env.WEBSITE_URL) {
    logger.warn({ reference: row.reference }, 'Email réservation indisponible : configuration SMTP incomplète');
    return false;
  }
  try {
    const link = new URL('/mes-reservations/', process.env.WEBSITE_URL);
    const statuses: Record<string, string> = {
      PENDING: 'Votre demande a bien été reçue. Elle doit encore être validée par notre équipe.',
      AWAITING_PAYMENT: 'Votre demande est acceptée. Merci de régler l’acompte selon les instructions ci-dessous.',
      CONFIRMED: 'Votre acompte a été vérifié. Votre réservation est confirmée.',
      REJECTED: 'Nous ne pouvons pas donner suite à votre demande.',
      EXPIRED: 'Le délai de paiement de votre demande est expiré.',
    };
    const text = [`Bonjour ${row.name},`, statuses[row.status] || 'Voici le lien de suivi de votre demande.',
      `Référence : ${row.reference}`, `Séjour : ${row.arrival.toISOString().slice(0, 10)} au ${row.departure.toISOString().slice(0, 10)}`,
      `Total : ${row.totalAmount.toLocaleString('fr-FR')} Ar`, `Acompte : ${row.depositAmount.toLocaleString('fr-FR')} Ar`,
      row.status === 'AWAITING_PAYMENT' ? row.paymentInstructions : '',
      row.status === 'AWAITING_PAYMENT' && row.expiresAt ? `À régler avant le ${row.expiresAt.toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo' })} (Madagascar).` : '',
      row.decisionNote, `Consulter ma réservation : ${link.toString()}`, 'Connectez-vous avec votre adresse email pour consulter toutes vos demandes.', 'Natura Lodge',
    ].filter(Boolean).join('\n\n');
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
    await transport.sendMail({ from: process.env.MAIL_FROM, to: row.email, subject: `Natura Lodge — ${row.reference} — ${row.status === 'CONFIRMED' ? 'Réservation confirmée' : 'Suivi de votre demande'}`, text });
    return true;
  } catch {
    // Do not log SMTP credentials, recipient details or the private tracking link.
    logger.error({ reference: row.reference }, 'Échec de l’envoi de l’email de réservation');
    return false;
  }
}
