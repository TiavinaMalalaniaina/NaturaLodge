import { AxiosError } from 'axios';

export function getApiErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (err instanceof AxiosError) {
    const message = (err.response?.data as { error?: unknown } | undefined)?.error;
    if (typeof message === 'string') return message;
  }
  return fallback;
}
