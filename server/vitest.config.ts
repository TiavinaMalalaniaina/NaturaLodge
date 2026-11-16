import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Les tests vident la base à chaque lancement : ils ne doivent JAMAIS pouvoir viser server/.env
// (qui peut pointer vers une base distante/partagée). URL explicite et nom de base en `_test` exigés.
const fileEnv = config({ path: '.env.test', processEnv: {} }).parsed ?? {};
const databaseUrl = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL manquant : copier server/.env.test.example en server/.env.test');
}
const dbName = new URL(databaseUrl).pathname.slice(1);
if (!dbName.endsWith('_test')) {
  throw new Error(`TEST_DATABASE_URL doit viser une base dont le nom finit par "_test" (reçu : "${dbName}")`);
}

// Posées avant tout import applicatif : dotenv (server/.env) ne réécrit jamais une variable déjà
// définie, même vide — c'est ce qui neutralise ici SMTP, push et la vraie DATABASE_URL.
const env = {
  APP_ENV: 'development',
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  DATABASE_SSL: 'false',
  JWT_SECRET: 'test-secret-not-used-anywhere-else-0123456789',
  LOG_LEVEL: 'silent',
  FRONTEND_URL: 'http://localhost:3000',
  WEBSITE_URL: 'http://localhost:4321',
  SMTP_HOST: '',
  MAIL_FROM: '',
  VAPID_PUBLIC_KEY: '',
  VAPID_PRIVATE_KEY: '',
  VAPID_SUBJECT: '',
};
Object.assign(process.env, env);

export default defineConfig({
  test: {
    env,
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // Une seule base partagée : les fichiers s'exécutent l'un après l'autre, dans un seul process
    // (l'app et le client Prisma ne sont chargés qu'une fois pour toute la suite).
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    isolate: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
