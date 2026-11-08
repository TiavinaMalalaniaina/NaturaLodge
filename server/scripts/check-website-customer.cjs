// Run after npm run build. Uses local PostgreSQL and never sends an email.
require('dotenv/config');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const express = require('express');
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) {
  throw Error('These integration checks require a local database.');
}
process.env.NODE_ENV = 'test';
const mail = require('../dist/services/websiteMail.service');
const delivered = new Map();
mail.sendLoginMail = async (email, token) => { delivered.set(email, token); return true; };
const { prisma } = require('../dist/lib/prisma');
const service = require('../dist/services/websiteRequest.service');
const { publicRequestsRouter } = require('../dist/routes/websiteRequests');
const { errorHandler } = require('../dist/middleware/errorHandler');
const prefix = randomBytes(12).toString('hex');
const emails = [`${prefix}-a@example.invalid`, `${prefix}-b@example.invalid`];
const origin = new URL(process.env.WEBSITE_URL || 'http://localhost:4321').origin;
const app = express();
app.use(express.json(), publicRequestsRouter, errorHandler);
const server = app.listen(0, '127.0.0.1');
let base;
const hash = token => createHash('sha256').update(token).digest('hex');
async function call(path, body, cookie, requestOrigin = origin) {
  return fetch(base + path, { method: body ? 'POST' : 'GET', headers: {
    Origin: requestOrigin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function connect(email) {
  assert.equal((await call('/auth/email', { email })).status, 200);
  const token = delivered.get(email);
  const response = await call('/auth/verify', { token });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.equal((await response.json()).email, email);
  return { cookie: cookie.split(';')[0], token };
}
(async () => {
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await call('/auth/me')).status, 401);
    assert.equal((await call('/reservation-requests')).status, 401);
    assert.equal((await call('/reservation-requests', {})).status, 401);
    assert.equal((await call('/auth/email', { email: emails[0] }, undefined, 'https://other.invalid')).status, 403);
    for (const email of emails) {
      await prisma.websiteRequest.create({ data: {
        reference: `${prefix}-${email === emails[0] ? 'a' : 'b'}`, idempotencyKeyHash: hash(email), payloadHash: hash(email),
        email, name: 'Integration check', phone: '+261000000000', arrival: new Date('2030-01-01'), departure: new Date('2030-01-02'),
        guests: 1, lines: [], totalAmount: 100, depositAmount: 100,
      } });
    }
    const first = await connect(emails[0]);
    assert.equal((await call('/auth/verify', { token: first.token })).status, 401);
    assert.equal((await call('/auth/email', { email: emails[0] })).status, 429);
    const second = await connect(emails[1]);
    for (const [index, session] of [first, second].entries()) {
      const response = await call('/reservation-requests', undefined, session.cookie);
      assert.equal(response.status, 200);
      const rows = await response.json();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].reference, `${prefix}-${index ? 'b' : 'a'}`);
      assert.equal(rows[0].idempotencyKeyHash, undefined);
    }
    const expired = randomBytes(32).toString('hex');
    await prisma.websiteLogin.create({ data: { tokenHash: hash(expired), email: emails[0], expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call('/auth/verify', { token: expired })).status, 401);
    assert.equal((await call('/auth/verify', { token: 'a'.repeat(64) })).status, 401);
    const originalSubmit = service.submit;
    service.submit = async (input, key, customerId) => {
      assert.equal(input.email, emails[0]);
      assert.ok(customerId);
      return { success: true };
    };
    const response = await fetch(base + '/reservation-requests', { method: 'POST', headers: {
      Origin: origin, Cookie: first.cookie, 'Content-Type': 'application/json', 'Idempotency-Key': 'b'.repeat(64),
    }, body: JSON.stringify({ email: emails[1], name: 'Client', phone: '+261000000000', arrival: '2030-01-01', departure: '2030-01-02', guests: 1,
      conditionsAccepted: true, lines: [{ roomTypeId: 'test', quantity: 1, unitPrice: 100 }] }) });
    assert.equal(response.status, 201);
    service.submit = originalSubmit;
    assert.equal((await call('/auth/logout', {}, first.cookie, 'https://other.invalid')).status, 403);
    assert.equal((await call('/auth/logout', {}, first.cookie)).status, 200);
    assert.equal((await call('/auth/me', undefined, first.cookie)).status, 401);
    await prisma.websiteSession.updateMany({ where: { customer: { email: emails[1] } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call('/auth/me', undefined, second.cookie)).status, 401);
    assert.equal((await call('/reservation-requests/legacy')).status, 404);
    console.log('Passed: login, one-time and expired links, cookie, ownership, isolation, enforced account email, CSRF, logout, session expiry.');
  } finally {
    await prisma.websiteRequest.deleteMany({ where: { email: { in: emails } } });
    await prisma.websiteLogin.deleteMany({ where: { email: { in: emails } } });
    await prisma.websiteCustomer.deleteMany({ where: { email: { in: emails } } });
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
