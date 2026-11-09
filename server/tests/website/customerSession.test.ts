import { createHash, randomBytes } from 'crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';

const ORIGIN = process.env.WEBSITE_URL!;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// Lien de connexion valide pour `email`, comme s'il venait d'être envoyé par email.
async function loginLink(email: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await prisma.websiteLogin.create({ data: { tokenHash: sha256(token), email, expiresAt: new Date(Date.now() + 15 * 60000) } });
  return token;
}

describe('Espace client — cookie de session', () => {
  beforeEach(resetDb);

  // En production : c'est là que SameSite=None était posé (cookie tiers bloqué par les navigateurs).
  it('en production, pose un cookie de premier niveau : Secure, HttpOnly, SameSite=Lax, limité à /api/public', async () => {
    const token = await loginLink('client@example.com');

    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let res;
    try {
      res = await request(app).post('/api/public/auth/verify').set('Origin', ORIGIN).send({ token }).expect(200);
    } finally {
      process.env.NODE_ENV = previous;
    }

    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0] ?? '';
    expect(cookie).toMatch(/^naturalodge_customer=[a-f0-9]{64};/);
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    expect(cookie).toMatch(/;\s*Path=\/api\/public/i);
    expect(cookie).not.toMatch(/SameSite=None/i);

    const session = cookie.split(';')[0];
    const me = await request(app).get('/api/public/auth/me').set('Cookie', session).expect(200);
    expect(me.body.email).toBe('client@example.com');
  });

  it('refuse une connexion initiée depuis une autre origine que le site', async () => {
    const token = await loginLink('client@example.com');

    await request(app).post('/api/public/auth/verify').set('Origin', 'https://evil.example').send({ token }).expect(403);
    expect(await prisma.websiteSession.count()).toBe(0);
  });
});
