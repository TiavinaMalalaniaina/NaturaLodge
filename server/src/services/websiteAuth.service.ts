import { createHash, randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { sendLoginMail } from './websiteMail.service';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const cookieName = 'naturalodge_customer';
const sessionDuration = 7 * 86400000;
// Le site appelle l'API via sa propre origine (nginx du site : /api/public → serveur) : cookie de
// premier niveau, Lax suffit et n'est pas bloqué comme cookie tiers (Safari, Firefox, Chrome).
// SameSite=None ne fonctionnerait plus de façon fiable si le site et l'API étaient sur deux sites distincts.
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/public' });

export function checkWebsiteOrigin(req: Request) {
  const origin = process.env.WEBSITE_URL || 'http://localhost:4321';
  if (req.headers.origin !== new URL(origin).origin) throw new ForbiddenError('Origine non autorisée');
}

function sessionToken(req: Request) {
  const value = req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : '';
}

export async function currentCustomer(req: Request) {
  const token = sessionToken(req);
  if (!token) throw new UnauthorizedError('Connectez-vous pour accéder à votre espace client.');
  const session = await prisma.websiteSession.findUnique({ where: { tokenHash: hash(token) }, include: { customer: true } });
  if (!session || session.expiresAt <= new Date()) throw new UnauthorizedError('Votre session a expiré. Reconnectez-vous.');
  return { id: session.customer.id, email: session.customer.email };
}

export async function requestLogin(email: string, next = '/mes-reservations', locale: 'fr' | 'en' = 'fr') {
  const now = new Date();
  await prisma.websiteLogin.deleteMany({ where: { expiresAt: { lte: now } } });
  await prisma.websiteSession.deleteMany({ where: { expiresAt: { lte: now } } });
  const token = randomBytes(32).toString('hex');
  await prisma.websiteLogin.create({ data: { tokenHash: hash(token), email, expiresAt: new Date(Date.now() + 15 * 60000) } });
  if (!await sendLoginMail(email, token, next, locale)) {
    await prisma.websiteLogin.deleteMany({ where: { tokenHash: hash(token) } });
    throw new ForbiddenError('L’email de connexion n’a pas pu être envoyé. Réessayez plus tard ou contactez l’hôtel.');
  }
}

export async function login(token: string, req: Request, res: Response) {
  const session = randomBytes(32).toString('hex');
  const customer = await prisma.$transaction(async tx => {
    const challenge = await tx.websiteLogin.findUnique({ where: { tokenHash: hash(token) } });
    if (!challenge || challenge.expiresAt <= new Date()) throw new UnauthorizedError('Ce lien est invalide ou expiré. Demandez un nouveau lien.');
    const consumed = await tx.websiteLogin.deleteMany({ where: { tokenHash: hash(token), expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw new UnauthorizedError('Ce lien a déjà été utilisé.');
    const account = await tx.websiteCustomer.upsert({ where: { email: challenge.email }, create: { email: challenge.email }, update: {} });
    // Email ownership has just been verified; recover legacy website requests only.
    await tx.websiteRequest.updateMany({ where: { customerId: null, email: account.email }, data: { customerId: account.id } });
    const previous = sessionToken(req);
    if (previous) await tx.websiteSession.deleteMany({ where: { tokenHash: hash(previous) } });
    await tx.websiteSession.create({ data: { tokenHash: hash(session), customerId: account.id, expiresAt: new Date(Date.now() + sessionDuration) } });
    return { id: account.id, email: account.email };
  });
  res.cookie(cookieName, session, { ...cookieOptions(), maxAge: sessionDuration });
  return customer;
}

export async function logout(req: Request, res: Response) {
  const token = sessionToken(req);
  if (token) await prisma.websiteSession.deleteMany({ where: { tokenHash: hash(token) } });
  res.clearCookie(cookieName, cookieOptions());
}
