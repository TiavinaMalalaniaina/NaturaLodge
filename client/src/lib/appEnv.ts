export type AppEnv = 'development' | 'preprod' | 'production';

const raw = import.meta.env.VITE_APP_ENV;

export const APP_ENV: AppEnv =
  raw === 'development' || raw === 'preprod' || raw === 'production'
    ? raw
    : import.meta.env.DEV ? 'development' : 'production';
