import { api } from '../api/client';

// Web Push needs a registered service worker: production build only (vite-plugin-pwa does not
// register it in `npm run dev`), over HTTPS or localhost. On iPhone/iPad the admin must first be
// installed on the home screen (iOS 16.4+).
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const keyBytes = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('no-service-worker');
  return reg;
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription() ?? null;
}

export async function enablePush() {
  const { publicKey } = (await api.get<{ publicKey: string | null }>('/website-requests/push/public-key')).data;
  if (!publicKey) throw new Error('server-not-configured');
  if (await Notification.requestPermission() !== 'granted') throw new Error('permission-denied');
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await api.post('/website-requests/push/subscribe', subscription.toJSON());
  return subscription;
}

// Best effort: also called on logout so a shared device stops receiving the previous user's alerts.
export async function disablePush() {
  const subscription = await currentPushSubscription().catch(() => null);
  if (!subscription) return;
  await api.post('/website-requests/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
}
