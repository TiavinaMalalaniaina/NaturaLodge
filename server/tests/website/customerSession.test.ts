import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';

const mails = vi.hoisted(() => [] as { kind: 'verify' | 'reset'; email: string; token: string }[]);
vi.mock('../../src/services/websiteMail.service', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/services/websiteMail.service')>(),
  sendAccountMail: vi.fn(async (kind: 'verify' | 'reset', email: string, token: string) => { mails.push({ kind, email, token }); return true; }),
}));

const ORIGIN = process.env.WEBSITE_URL!;
const PASSWORD = 'motdepasse-solide';
let seq = 0;
// Les limites (1 email/min, 5 échecs) sont en mémoire par adresse : une adresse neuve par test.
const freshEmail = () => `client${++seq}-${Date.now()}@example.com`;
const post = (path: string, body: object, cookie?: string) => {
  const req = request(app).post(`/api/public/auth${path}`).set('Origin', ORIGIN);
  return (cookie ? req.set('Cookie', cookie) : req).send(body);
};
const setCookies = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? []);
const sessionCookie = (res: request.Response) => setCookies(res).find(c => c.startsWith('naturalodge_customer='))!.split(';')[0];
const lastMail = (email: string) => [...mails].reverse().find(m => m.email === email)!;

async function registeredAccount(email = freshEmail(), password = PASSWORD) {
  await prisma.websiteCustomer.create({ data: { email, passwordHash: await bcrypt.hash(password, 4) } });
  return email;
}

describe('Espace client — inscription par email et mot de passe', () => {
  beforeEach(async () => { await resetDb(); mails.length = 0; });

  it('ne crée le compte qu’après confirmation de l’adresse, puis ouvre une session', async () => {
    const email = freshEmail();
    await post('/register', { email, password: PASSWORD }).expect(200);
    expect(await prisma.websiteCustomer.count()).toBe(0);

    const res = await post('/verify', { token: lastMail(email).token }).expect(200);
    expect(res.body.email).toBe(email);
    const me = await request(app).get('/api/public/auth/me').set('Cookie', sessionCookie(res)).expect(200);
    expect(me.body.email).toBe(email);

    await post('/login', { email, password: PASSWORD }).expect(200);
  });

  it('en production, pose un cookie de premier niveau : Secure, HttpOnly, SameSite=Lax, limité à /api/public', async () => {
    const email = await registeredAccount();
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let res;
    try { res = await post('/login', { email, password: PASSWORD }).expect(200); }
    finally { process.env.NODE_ENV = previous; }

    const cookie = setCookies(res)[0] ?? '';
    expect(cookie).toMatch(/^naturalodge_customer=[a-f0-9]{64};/);
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    expect(cookie).toMatch(/;\s*Path=\/api\/public/i);
    expect(cookie).not.toMatch(/SameSite=None/i);
  });

  it('un lien de confirmation ne sert qu’une fois', async () => {
    const email = freshEmail();
    await post('/register', { email, password: PASSWORD }).expect(200);
    const { token } = lastMail(email);
    await post('/verify', { token }).expect(200);
    await post('/verify', { token }).expect(401);
  });

  it('refuse un mot de passe trop court', async () => {
    await post('/register', { email: freshEmail(), password: 'court' }).expect(422);
    expect(mails).toHaveLength(0);
  });

  it('se réinscrire avec une adresse déjà enregistrée remplace le mot de passe seulement après confirmation, et ferme les autres sessions', async () => {
    const email = await registeredAccount();
    const oldSession = sessionCookie(await post('/login', { email, password: PASSWORD }).expect(200));

    await post('/register', { email, password: 'nouveau-mot-de-passe' }).expect(200);
    await post('/login', { email, password: PASSWORD }).expect(200);

    await post('/verify', { token: lastMail(email).token }).expect(200);
    await post('/login', { email, password: PASSWORD }).expect(401);
    await post('/login', { email, password: 'nouveau-mot-de-passe' }).expect(200);
    await request(app).get('/api/public/auth/me').set('Cookie', oldSession).expect(401);
  });

  it('refuse une connexion initiée depuis une autre origine que le site', async () => {
    const email = await registeredAccount();
    await request(app).post('/api/public/auth/login').set('Origin', 'https://evil.example').send({ email, password: PASSWORD }).expect(403);
    expect(await prisma.websiteSession.count()).toBe(0);
  });
});

describe('Espace client — connexion par mot de passe', () => {
  beforeEach(async () => { await resetDb(); mails.length = 0; });

  it('même réponse pour un mauvais mot de passe et une adresse inconnue', async () => {
    const email = await registeredAccount();
    const wrong = await post('/login', { email, password: 'mauvais-mot-de-passe' }).expect(401);
    const unknown = await post('/login', { email: freshEmail(), password: PASSWORD }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(setCookies(wrong)).toHaveLength(0);
  });

  it('un compte sans mot de passe (Google, ancien lien magique) ne se connecte pas par mot de passe', async () => {
    const email = freshEmail();
    await prisma.websiteCustomer.create({ data: { email } });
    await post('/login', { email, password: PASSWORD }).expect(401);
  });

  it('bloque l’adresse après 5 échecs, même avec le bon mot de passe ensuite', async () => {
    const email = await registeredAccount();
    for (let i = 0; i < 5; i++) await post('/login', { email, password: 'mauvais-mot-de-passe' }).expect(401);
    await post('/login', { email, password: PASSWORD }).expect(429);
  });
});

describe('Espace client — mot de passe oublié', () => {
  beforeEach(async () => { await resetDb(); mails.length = 0; });

  it('n’envoie rien pour une adresse inconnue, avec la même réponse', async () => {
    const email = await registeredAccount();
    const known = await post('/password/forgot', { email }).expect(200);
    const unknown = await post('/password/forgot', { email: freshEmail() }).expect(200);
    expect(known.body).toEqual(unknown.body);
    expect(mails.map(m => m.email)).toEqual([email]);
  });

  it('remplace le mot de passe, connecte, et ferme les sessions existantes', async () => {
    const email = await registeredAccount();
    const oldSession = sessionCookie(await post('/login', { email, password: PASSWORD }).expect(200));
    await post('/password/forgot', { email }).expect(200);

    const res = await post('/password/reset', { token: lastMail(email).token, password: 'tout-nouveau-secret' }).expect(200);
    await request(app).get('/api/public/auth/me').set('Cookie', sessionCookie(res)).expect(200);
    await request(app).get('/api/public/auth/me').set('Cookie', oldSession).expect(401);
    await post('/login', { email, password: PASSWORD }).expect(401);
    await post('/login', { email, password: 'tout-nouveau-secret' }).expect(200);
  });

  it('permet à un compte sans mot de passe d’en définir un', async () => {
    const email = freshEmail();
    await prisma.websiteCustomer.create({ data: { email } });
    await post('/password/forgot', { email }).expect(200);
    await post('/password/reset', { token: lastMail(email).token, password: PASSWORD }).expect(200);
    await post('/login', { email, password: PASSWORD }).expect(200);
  });

  it('un lien de confirmation d’inscription ne permet pas de réinitialiser', async () => {
    const email = freshEmail();
    await post('/register', { email, password: PASSWORD }).expect(200);
    await post('/password/reset', { token: lastMail(email).token, password: 'autre-mot-de-passe' }).expect(401);
  });
});

describe('Espace client — connexion Google', () => {
  const CLIENT_ID = 'test-client.apps.googleusercontent.com';
  const idToken = (claims: Record<string, unknown>) => `x.${Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com', aud: CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 300, email_verified: true, ...claims,
  })).toString('base64url')}.sig`;
  const stubGoogle = (claims: Record<string, unknown>) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 })));

  async function startFlow(query = '') {
    const res = await request(app).get(`/api/public/auth/google${query}`).expect(303);
    const location = new URL(res.headers.location);
    const cookie = setCookies(res).find(c => c.startsWith('naturalodge_oauth='))!.split(';')[0];
    return { location, cookie, state: location.searchParams.get('state')! };
  }
  const callback = (cookie: string, state: string) => request(app).get(`/api/public/auth/google/callback?code=abc&state=${state}`).set('Cookie', cookie).expect(303);

  beforeEach(async () => {
    await resetDb();
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  });
  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('n’est proposée que si le client OAuth est configuré', async () => {
    expect((await request(app).get('/api/public/auth/providers').expect(200)).body).toEqual({ google: true });
    delete process.env.GOOGLE_CLIENT_ID;
    expect((await request(app).get('/api/public/auth/providers').expect(200)).body).toEqual({ google: false });
    const res = await request(app).get('/api/public/auth/google').expect(303);
    expect(res.headers.location).toBe(`${ORIGIN}/connexion/?error=google`);
  });

  it('redirige vers Google avec state et PKCE, puis crée le compte et ouvre la session au retour', async () => {
    const { location, cookie, state } = await startFlow('?next=/reservation&locale=en');
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');

    stubGoogle({ sub: 'google-1', email: 'Voyageur@Example.com' });
    const res = await callback(cookie, state);
    expect(res.headers.location).toBe(`${ORIGIN}/en/reservation/`);
    const me = await request(app).get('/api/public/auth/me').set('Cookie', sessionCookie(res)).expect(200);
    expect(me.body.email).toBe('voyageur@example.com');
  });

  it('rattache le compte existant de même adresse', async () => {
    const email = await registeredAccount();
    const { cookie, state } = await startFlow();
    stubGoogle({ sub: 'google-2', email });
    await callback(cookie, state);
    expect(await prisma.websiteCustomer.findMany({ select: { email: true, googleId: true } })).toEqual([{ email, googleId: 'google-2' }]);
  });

  it('refuse un retour dont le state ne correspond pas au navigateur', async () => {
    const { cookie } = await startFlow();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await callback(cookie, 'f'.repeat(64));
    expect(res.headers.location).toBe(`${ORIGIN}/connexion/?error=google`);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.websiteSession.count()).toBe(0);
  });

  it('refuse un compte Google dont l’email n’est pas vérifié', async () => {
    const { cookie, state } = await startFlow();
    stubGoogle({ sub: 'google-3', email: 'pasverifie@example.com', email_verified: false });
    const res = await callback(cookie, state);
    expect(res.headers.location).toBe(`${ORIGIN}/connexion/?error=google`);
    expect(await prisma.websiteCustomer.count()).toBe(0);
  });

  it('refuse un id_token émis pour une autre application', async () => {
    const { cookie, state } = await startFlow();
    stubGoogle({ sub: 'google-4', email: 'autre@example.com', aud: 'autre-client' });
    await callback(cookie, state);
    expect(await prisma.websiteCustomer.count()).toBe(0);
  });
});
