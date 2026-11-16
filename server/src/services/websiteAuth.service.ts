import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { Prisma, WebsiteTokenPurpose } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { UnauthorizedError, ForbiddenError, TooManyRequestsError } from '../errors/AppError';
import { sendAccountMail } from './websiteMail.service';

type Next = '/reservation' | '/mes-reservations';
type Locale = 'fr' | 'en';
type Tx = Prisma.TransactionClient;

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const cookieName = 'naturalodge_customer';
const oauthCookieName = 'naturalodge_oauth';
const sessionDuration = 7 * 86400000;
const emailTokenDuration = 60 * 60000;
const bcryptRounds = 12;
// Le site appelle l'API via sa propre origine (nginx du site : /api/public → serveur) : cookie de
// premier niveau, Lax suffit et n'est pas bloqué comme cookie tiers (Safari, Firefox, Chrome).
// SameSite=None ne fonctionnerait plus de façon fiable si le site et l'API étaient sur deux sites distincts.
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/public' });
const oauthCookieOptions = () => ({ ...cookieOptions(), path: '/api/public/auth/google' });

export function checkWebsiteOrigin(req: Request) {
  const origin = process.env.WEBSITE_URL || 'http://localhost:4321';
  if (req.headers.origin !== new URL(origin).origin) throw new ForbiddenError('Origine non autorisée');
}

function readCookie(req: Request, name: string) {
  return req.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}

function sessionToken(req: Request) {
  const value = readCookie(req, cookieName);
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}

export async function currentCustomer(req: Request) {
  const token = sessionToken(req);
  if (!token) throw new UnauthorizedError('Connectez-vous pour accéder à votre espace client.');
  const session = await prisma.websiteSession.findUnique({ where: { tokenHash: hash(token) }, include: { customer: true } });
  if (!session || session.expiresAt <= new Date()) throw new UnauthorizedError('Votre session a expiré. Reconnectez-vous.');
  return { id: session.customer.id, email: session.customer.email };
}

// Ouvre une session pour un compte dont l'email vient d'être prouvé, et rattache ses anciennes demandes.
async function openSession(tx: Tx, customer: { id: string; email: string }, req: Request) {
  await tx.websiteRequest.updateMany({ where: { customerId: null, email: customer.email }, data: { customerId: customer.id } });
  const previous = sessionToken(req);
  if (previous) await tx.websiteSession.deleteMany({ where: { tokenHash: hash(previous) } });
  const session = randomBytes(32).toString('hex');
  await tx.websiteSession.create({ data: { tokenHash: hash(session), customerId: customer.id, expiresAt: new Date(Date.now() + sessionDuration) } });
  return session;
}

function setSessionCookie(res: Response, session: string) {
  res.cookie(cookieName, session, { ...cookieOptions(), maxAge: sessionDuration });
}

async function purgeExpired() {
  const now = new Date();
  await prisma.websiteEmailToken.deleteMany({ where: { expiresAt: { lte: now } } });
  await prisma.websiteSession.deleteMany({ where: { expiresAt: { lte: now } } });
}

// --- Limites en mémoire (une instance serveur) ----------------------------------------------------

const mailLimits = new Map<string, number>();
function throttleMail(key: string) {
  const now = Date.now();
  for (const [k, until] of mailLimits) if (until <= now) mailLimits.delete(k);
  if (mailLimits.has(key) || mailLimits.size >= 10000) throw new TooManyRequestsError('Patientez une minute avant de demander un nouvel email.');
  mailLimits.set(key, now + 60000);
}

const maxFailures = 5;
const failureWindow = 15 * 60000;
const loginFailures = new Map<string, { count: number; until: number }>();
function checkLoginAllowed(email: string) {
  const now = Date.now();
  for (const [k, entry] of loginFailures) if (entry.until <= now) loginFailures.delete(k);
  if ((loginFailures.get(email)?.count ?? 0) >= maxFailures) throw new TooManyRequestsError('Trop de tentatives. Réessayez dans 15 minutes ou réinitialisez votre mot de passe.');
}
function recordLoginFailure(email: string) {
  const entry = loginFailures.get(email) ?? { count: 0, until: Date.now() + failureWindow };
  entry.count++;
  if (loginFailures.size < 10000 || loginFailures.has(email)) loginFailures.set(email, entry);
}

// --- Email + mot de passe -------------------------------------------------------------------------

async function issueEmailToken(purpose: WebsiteTokenPurpose, email: string, next: Next, locale: Locale, passwordHash?: string) {
  const token = randomBytes(32).toString('hex');
  await prisma.websiteEmailToken.create({ data: { tokenHash: hash(token), purpose, email, passwordHash, expiresAt: new Date(Date.now() + emailTokenDuration) } });
  const kind = purpose === 'VERIFY_EMAIL' ? 'verify' : 'reset';
  if (await sendAccountMail(kind, email, token, next, locale)) return true;
  await prisma.websiteEmailToken.deleteMany({ where: { tokenHash: hash(token) } });
  return false;
}

// Même réponse que l'adresse ait déjà un compte ou non : le lien prouve l'adresse, puis enregistre le
// mot de passe (création du compte, ou remplacement de l'ancien mot de passe).
export async function register(email: string, password: string, next: Next, locale: Locale) {
  throttleMail(`verify:${email}`);
  await purgeExpired();
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  if (!await issueEmailToken('VERIFY_EMAIL', email, next, locale, passwordHash)) {
    throw new ForbiddenError('L’email de confirmation n’a pas pu être envoyé. Réessayez plus tard ou contactez l’hôtel.');
  }
}

export async function requestPasswordReset(email: string, next: Next, locale: Locale) {
  throttleMail(`reset:${email}`);
  await purgeExpired();
  const customer = await prisma.websiteCustomer.findUnique({ where: { email } });
  // Pas d'erreur visible si l'envoi échoue : elle révélerait que l'adresse a un compte.
  if (customer && !await issueEmailToken('RESET_PASSWORD', email, next, locale)) logger.error('Échec de l’envoi de l’email de réinitialisation');
}

async function consumeEmailToken(tx: Tx, token: string, purpose: WebsiteTokenPurpose) {
  const row = await tx.websiteEmailToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.purpose !== purpose || row.expiresAt <= new Date()) throw new UnauthorizedError('Ce lien est invalide ou expiré. Demandez un nouveau lien.');
  const consumed = await tx.websiteEmailToken.deleteMany({ where: { tokenHash: hash(token), expiresAt: { gt: new Date() } } });
  if (consumed.count !== 1) throw new UnauthorizedError('Ce lien a déjà été utilisé.');
  await tx.websiteEmailToken.deleteMany({ where: { email: row.email, purpose } });
  return row;
}

export async function verifyEmail(token: string, req: Request, res: Response) {
  const { customer, session } = await prisma.$transaction(async tx => {
    const row = await consumeEmailToken(tx, token, 'VERIFY_EMAIL');
    const existing = await tx.websiteCustomer.findUnique({ where: { email: row.email } });
    const account = existing
      ? await tx.websiteCustomer.update({ where: { id: existing.id }, data: { passwordHash: row.passwordHash } })
      : await tx.websiteCustomer.create({ data: { email: row.email, passwordHash: row.passwordHash } });
    if (existing?.passwordHash) await tx.websiteSession.deleteMany({ where: { customerId: account.id } });
    return { customer: { id: account.id, email: account.email }, session: await openSession(tx, account, req) };
  });
  setSessionCookie(res, session);
  return customer;
}

export async function resetPassword(token: string, password: string, req: Request, res: Response) {
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  const { customer, session } = await prisma.$transaction(async tx => {
    const row = await consumeEmailToken(tx, token, 'RESET_PASSWORD');
    const existing = await tx.websiteCustomer.findUnique({ where: { email: row.email } });
    if (!existing) throw new UnauthorizedError('Ce lien est invalide ou expiré. Demandez un nouveau lien.');
    const account = await tx.websiteCustomer.update({ where: { id: existing.id }, data: { passwordHash } });
    await tx.websiteSession.deleteMany({ where: { customerId: account.id } });
    return { customer: { id: account.id, email: account.email }, session: await openSession(tx, account, req) };
  });
  loginFailures.delete(customer.email);
  setSessionCookie(res, session);
  return customer;
}

let dummyHash: Promise<string> | null = null;
export async function login(email: string, password: string, req: Request, res: Response) {
  checkLoginAllowed(email);
  const account = await prisma.websiteCustomer.findUnique({ where: { email } });
  // Comparaison même sans compte : le temps de réponse ne révèle pas si l'adresse existe.
  dummyHash ??= bcrypt.hash('naturalodge-dummy-password', bcryptRounds);
  const valid = await bcrypt.compare(password, account?.passwordHash ?? await dummyHash);
  if (!account?.passwordHash || !valid) {
    recordLoginFailure(email);
    throw new UnauthorizedError('Email ou mot de passe incorrect.');
  }
  loginFailures.delete(email);
  const session = await prisma.$transaction(tx => openSession(tx, account, req));
  setSessionCookie(res, session);
  return { id: account.id, email: account.email };
}

export async function logout(req: Request, res: Response) {
  const token = sessionToken(req);
  if (token) await prisma.websiteSession.deleteMany({ where: { tokenHash: hash(token) } });
  res.clearCookie(cookieName, cookieOptions());
}

// --- Google (OAuth 2.0 « authorization code » + PKCE, échange côté serveur) ------------------------

const google = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL('/api/public/auth/google/callback', process.env.WEBSITE_URL || 'http://localhost:4321').toString();
  return { clientId, clientSecret, redirectUri };
};

export const providers = () => ({ google: !!google() });

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');
const sitePath = (locale: Locale, path: string) => new URL(`${locale === 'en' ? '/en' : ''}${path}`, process.env.WEBSITE_URL || 'http://localhost:4321').toString();
const loginPage = (locale: Locale, next: Next) => {
  const url = new URL(sitePath(locale, '/connexion/'));
  if (next === '/reservation') url.searchParams.set('next', next);
  url.searchParams.set('error', 'google');
  return url.toString();
};

export function googleStart(next: Next, locale: Locale, res: Response) {
  const config = google();
  if (!config) { res.redirect(303, loginPage(locale, next)); return; }
  const state = randomBytes(32).toString('hex');
  const verifier = randomBytes(32).toString('base64url');
  res.cookie(oauthCookieName, base64url(JSON.stringify({ state, verifier, next, locale })), { ...oauthCookieOptions(), maxAge: 10 * 60000 });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'openid email',
    state, code_challenge: base64url(createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', prompt: 'select_account',
  }).toString();
  res.redirect(303, url.toString());
}

type OAuthState = { state: string; verifier: string; next: Next; locale: Locale };
function readOAuthState(req: Request): OAuthState | null {
  try {
    const value = JSON.parse(Buffer.from(readCookie(req, oauthCookieName), 'base64url').toString()) as Partial<OAuthState>;
    if (typeof value.state !== 'string' || typeof value.verifier !== 'string') return null;
    return { state: value.state, verifier: value.verifier, next: value.next === '/reservation' ? '/reservation' : '/mes-reservations', locale: value.locale === 'en' ? 'en' : 'fr' };
  } catch { return null; }
}

const sameString = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

type GoogleIdentity = { sub: string; email: string };
// L'id_token est reçu directement de Google (TLS + secret client) : la signature n'a pas à être
// revérifiée, mais l'émetteur, l'audience, l'expiration et la vérification de l'email si.
async function exchangeCode(code: string, verifier: string, config: NonNullable<ReturnType<typeof google>>): Promise<GoogleIdentity> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: verifier }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Google token endpoint: HTTP ${response.status}`);
  const { id_token: idToken } = await response.json() as { id_token?: string };
  const claims = JSON.parse(Buffer.from(idToken?.split('.')[1] ?? '', 'base64url').toString()) as Record<string, unknown>;
  const issuerOk = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  if (!issuerOk || claims.aud !== config.clientId || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) throw new Error('id_token Google invalide');
  if (claims.email_verified !== true || typeof claims.email !== 'string' || typeof claims.sub !== 'string') throw new Error('Email Google non vérifié');
  return { sub: claims.sub, email: claims.email.trim().toLowerCase() };
}

export async function googleCallback(req: Request, res: Response) {
  const saved = readOAuthState(req);
  res.clearCookie(oauthCookieName, oauthCookieOptions());
  const next = saved?.next ?? '/mes-reservations';
  const locale = saved?.locale ?? 'fr';
  const config = google();
  const { code, state } = req.query;
  if (!config || !saved || typeof code !== 'string' || typeof state !== 'string' || !sameString(state, saved.state)) {
    res.redirect(303, loginPage(locale, next));
    return;
  }
  try {
    const identity = await exchangeCode(code, saved.verifier, config);
    const session = await prisma.$transaction(async tx => {
      const account = await tx.websiteCustomer.findUnique({ where: { googleId: identity.sub } })
        ?? await tx.websiteCustomer.upsert({ where: { email: identity.email }, create: { email: identity.email, googleId: identity.sub }, update: { googleId: identity.sub } });
      return openSession(tx, account, req);
    });
    setSessionCookie(res, session);
    res.redirect(303, sitePath(locale, `${next}/`));
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : 'unknown' }, 'Connexion Google refusée');
    res.redirect(303, loginPage(locale, next));
  }
}
