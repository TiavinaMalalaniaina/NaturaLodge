import 'dotenv/config';
import { z } from 'zod';

const PLACEHOLDER_SECRET = 'change-this-to-a-random-secret-min-32-chars';

const APP_ENVS = ['development', 'preprod', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const baseSchema = z.object({
  APP_ENV: z.enum(APP_ENVS).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET est obligatoire'),
  MAIL_REDIRECT_TO: z.string().email().optional().or(z.literal('').transform(() => undefined)),
});

// Hors développement, une variable oubliée dans Coolify doit empêcher le démarrage plutôt que de
// retomber silencieusement sur un défaut localhost (CORS cassé, liens d'email vers localhost…).
const deployedSchema = baseSchema.extend({
  NODE_ENV: z.literal('production', { errorMap: () => ({ message: 'NODE_ENV doit valoir "production" en preprod/production' }) }),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit faire au moins 32 caractères')
    .refine(v => v !== PLACEHOLDER_SECRET, 'JWT_SECRET est encore la valeur d’exemple'),
  FRONTEND_URL: z.string({ required_error: 'FRONTEND_URL est obligatoire' }).url().startsWith('https://', 'FRONTEND_URL doit être en https'),
  WEBSITE_URL: z.string({ required_error: 'WEBSITE_URL est obligatoire' }).url().startsWith('https://', 'WEBSITE_URL doit être en https'),
});

function load() {
  const appEnv = baseSchema.shape.APP_ENV.safeParse(process.env.APP_ENV);
  const schema = appEnv.success && appEnv.data !== 'development' ? deployedSchema : baseSchema;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`Configuration invalide (APP_ENV=${process.env.APP_ENV ?? 'development'}) :\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = load();
export const appEnv: AppEnv = env.APP_ENV;
export const isProduction = appEnv === 'production';
export const isPreprod = appEnv === 'preprod';
