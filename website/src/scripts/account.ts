import { localePath, pageLang, stripLang } from '../i18n';
import { translateServer } from '../i18n/server';
import { scriptText } from '../i18n/ui';

type Customer = { id: string; email: string };
const base = (import.meta.env.PUBLIC_API_URL || 'http://localhost:4000/api/public').replace(/\/$/, '');
export const lang = pageLang();
export const s = scriptText[lang];

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${base}/auth${path}`, { credentials: 'include', cache: 'no-store', method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(errorText(value.error, s.loginUnavailable), response.status);
  return value;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

// The API returns either a message string or a flattened Zod error ({ formErrors, fieldErrors }), in French.
export function errorText(error: unknown, fallback: string): string {
  if (typeof error === 'string') return translateServer(error, lang);
  if (error && typeof error === 'object') {
    const { formErrors = [], fieldErrors = {} } = error as { formErrors?: unknown[]; fieldErrors?: Record<string, unknown[] | undefined> };
    const messages = [...formErrors, ...Object.values(fieldErrors).flat()].filter((m): m is string => typeof m === 'string' && m.length > 0);
    if (messages.length) return [...new Set(messages)].map(m => translateServer(m, lang)).join(' · ');
  }
  return fallback;
}

// Path of the login page that sends the guest back to `from` (a language-neutral path such as /reservation).
export const loginUrl = (from: string) => `${localePath(lang, '/connexion/')}?next=${encodeURIComponent(stripLang(from).replace(/\/$/, ''))}`;
// The server only accepts these two language-neutral values; the email link keeps the page language.
const nextParam = () => (new URLSearchParams(location.search).get('next') === '/reservation' ? '/reservation' : '/mes-reservations');
const destination = () => localePath(lang, `${nextParam()}/`);

type Mode = 'checking' | 'login' | 'register' | 'forgot' | 'reset' | 'verify' | 'sent' | 'expired';
type BusyLabel = 'signingIn' | 'sending' | 'saving' | 'confirming' | 'redirecting';

// Shows a busy label on a button while `run` is pending. The label stays after success when the page
// navigates away, so the guest never sees the idle button flash back before the redirect.
async function withBusy(button: HTMLButtonElement, run: () => Promise<void>) {
  const idle = button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = s[(button.dataset.busy as BusyLabel) || 'sending'];
  try { await run(); }
  finally {
    if (!button.dataset.navigating) {
      button.removeAttribute('aria-busy');
      button.textContent = idle;
      button.disabled = false;
    }
  }
}

const resendDelay = 60;

// Login page: one panel, several modes (elements carry data-for="mode …"). Starts in "checking"
// until the session is known; `reveal` then shows the form matching the URL.
function initLoginPage(panel: HTMLElement) {
  const error = panel.querySelector('[data-error]')!;
  const success = panel.querySelector('[data-success]')!;
  const form = (id: string) => panel.querySelector<HTMLFormElement>(`#${id}`)!;
  let googleEnabled = false;
  const show = (mode: Mode, { focus = true } = {}) => {
    const changed = panel.dataset.mode !== mode;
    panel.dataset.mode = mode;
    panel.querySelectorAll<HTMLElement>('[data-for]').forEach(el => { el.hidden = !el.dataset.for!.split(' ').includes(mode) || (el.hasAttribute('data-google') && !googleEnabled); });
    if (!changed) return;
    error.textContent = '';
    success.textContent = '';
    if (!focus) return;
    const target = panel.querySelector<HTMLElement>(`form[data-for~="${mode}"] input`) ?? panel.querySelector<HTMLElement>(`h2[data-for~="${mode}"]`);
    target?.focus();
  };
  const fail = (err: unknown) => { error.textContent = err instanceof Error ? err.message : s.loginUnavailable; };

  // Typing again clears the previous error, which no longer describes the field.
  panel.addEventListener('input', () => { error.textContent = ''; });

  let lastEmailMode: Mode = 'login';
  panel.querySelectorAll<HTMLButtonElement>('[data-show]').forEach(button => button.addEventListener('click', () => {
    const current = panel.querySelector<HTMLInputElement>(`form[data-for~="${panel.dataset.mode}"] input[name="email"]`)?.value;
    show(button.dataset.show as Mode);
    const email = panel.querySelector<HTMLInputElement>(`form[data-for~="${button.dataset.show}"] input[name="email"]`);
    if (email && current && !email.value) email.value = current;
  }));

  const google = panel.querySelector<HTMLAnchorElement>('#google-login')!;
  const googleLabel = google.querySelector('[data-label]')!;
  const googleIdle = googleLabel.textContent;
  google.href = `${base}/auth/google?${new URLSearchParams({ next: nextParam(), locale: lang })}`;
  google.addEventListener('click', event => {
    if (google.getAttribute('aria-busy') === 'true') { event.preventDefault(); return; }
    google.setAttribute('aria-busy', 'true');
    google.setAttribute('aria-disabled', 'true');
    googleLabel.textContent = s.redirecting;
  });
  // Back button from Google restores the page from the back/forward cache with the busy label.
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    google.removeAttribute('aria-busy');
    google.removeAttribute('aria-disabled');
    googleLabel.textContent = googleIdle;
  });
  request<{ google: boolean }>('/providers').then(value => {
    googleEnabled = value.google;
    if (googleEnabled) show(panel.dataset.mode as Mode, { focus: false });
  }).catch(() => undefined);

  const submit = (id: string, run: (data: FormData) => Promise<void>) => form(id).addEventListener('submit', event => {
    event.preventDefault();
    error.textContent = '';
    success.textContent = '';
    const button = form(id).querySelector<HTMLButtonElement>('button:not([type="button"])')!;
    void withBusy(button, () => run(new FormData(form(id)))).catch(fail);
  });
  const navigate = () => {
    panel.querySelectorAll<HTMLButtonElement>('[aria-busy="true"]').forEach(b => { b.dataset.navigating = '1'; });
    location.replace(destination());
  };

  // "Email sent" state, shared by sign-up and forgotten password. Resend replays the same request
  // once the server's one-minute limit has passed.
  const sentEmail = panel.querySelector('[data-sent-email]')!;
  const sentMessage = panel.querySelector('[data-sent-message]')!;
  const resend = panel.querySelector<HTMLButtonElement>('#resend-mail')!;
  let resendRequest: (() => Promise<{ message: string }>) | null = null;
  let countdown: number | undefined;
  const startCountdown = () => {
    window.clearInterval(countdown);
    let left = resendDelay;
    resend.disabled = true;
    resend.textContent = s.resendIn(left);
    countdown = window.setInterval(() => {
      left -= 1;
      if (left > 0) { resend.textContent = s.resendIn(left); return; }
      window.clearInterval(countdown);
      resend.disabled = false;
      resend.textContent = resend.dataset.labelDefault ?? '';
    }, 1000);
  };
  const sent = (email: string, value: { message: string }, from: Mode, again: () => Promise<{ message: string }>) => {
    lastEmailMode = from;
    resendRequest = again;
    show('sent');
    sentEmail.textContent = email;
    sentMessage.textContent = translateServer(value.message, lang);
    startCountdown();
  };
  resend.addEventListener('click', () => {
    if (!resendRequest) return;
    const again = resendRequest;
    error.textContent = '';
    success.textContent = '';
    void withBusy(resend, async () => {
      await again();
      success.textContent = s.resent;
    }).then(startCountdown, fail);
  });
  panel.querySelector('#change-email')!.addEventListener('click', () => {
    window.clearInterval(countdown);
    show(lastEmailMode);
  });

  submit('login-form', async data => {
    await request<Customer>('/login', { email: data.get('email'), password: data.get('password') });
    navigate();
  });
  submit('register-form', async data => {
    const body = { email: data.get('email'), password: data.get('password'), next: nextParam(), locale: lang };
    const again = () => request<{ message: string }>('/register', body);
    sent(String(body.email), await again(), 'register', again);
    form('register-form').reset();
  });
  submit('forgot-form', async data => {
    const body = { email: data.get('email'), next: nextParam(), locale: lang };
    const again = () => request<{ message: string }>('/password/forgot', body);
    sent(String(body.email), await again(), 'forgot', again);
  });

  // Invalid, expired or already used email link: offer a new one from the matching form.
  const newLink = panel.querySelector<HTMLButtonElement>('#new-link')!;
  const expired = (err: unknown, retry: Mode) => {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    show('expired');
    newLink.onclick = () => show(retry);
  };

  const params = new URLSearchParams(location.hash.slice(1));
  const verify = params.get('verify');
  const reset = params.get('reset');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  const googleFailed = new URLSearchParams(location.search).get('error') === 'google';
  if (googleFailed) {
    const url = new URL(location.href);
    url.searchParams.delete('error');
    history.replaceState(null, '', url.pathname + url.search);
  }
  if (reset) {
    submit('reset-form', async data => {
      try { await request<Customer>('/password/reset', { token: reset, password: data.get('password') }); }
      catch (err) { expired(err, 'forgot'); return; }
      navigate();
    });
  } else if (verify) {
    // Consume only after a deliberate click so email scanners do not confirm for the guest.
    const confirm = panel.querySelector<HTMLButtonElement>('#confirm-login')!;
    confirm.addEventListener('click', () => {
      error.textContent = '';
      void withBusy(confirm, async () => {
        try { await request<Customer>('/verify', { token: verify }); }
        catch (err) { expired(err, 'register'); return; }
        navigate();
      }).catch(fail);
    });
  }

  const reveal = () => {
    show(reset ? 'reset' : verify ? 'verify' : 'login', { focus: false });
    if (googleFailed) error.textContent = s.googleFailed;
  };
  return { token: reset ?? verify, reveal };
}

export async function initAccount(required = true): Promise<Customer | null> {
  const panel = document.querySelector<HTMLElement>('#auth');
  const error = document.querySelector('[data-error]');
  // Keep ?next= when switching language on the login page.
  const switcher = document.querySelector<HTMLAnchorElement>('[data-lang-switch]');
  if (switcher && location.search) switcher.href += location.search;
  const page = panel ? initLoginPage(panel) : null;
  let customer: Customer;
  try { customer = await request<Customer>('/me'); }
  catch {
    page?.reveal();
    if (!panel && required) location.replace(loginUrl(location.pathname));
    return null;
  }
  const account = document.querySelector<HTMLAnchorElement>('[data-account]');
  if (account) { account.textContent = customer.email; account.href = localePath(lang, '/mes-reservations/'); }
  const logout = document.querySelector<HTMLButtonElement>('[data-logout]');
  if (logout) {
    logout.hidden = false;
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      try {
        await request('/logout', {});
        localStorage.removeItem('naturalodge-requests');
        localStorage.removeItem('naturalodge-pending-request');
        localStorage.removeItem('naturalodge-draft');
        location.replace(localePath(lang, '/connexion/'));
      } catch { if (error) error.textContent = s.logoutFailed; logout.disabled = false; }
    });
  }
  // Already signed in: stay on "checking" while leaving, unless the page carries an email link.
  if (page?.token) page.reveal();
  else if (page) location.replace(destination());
  document.querySelectorAll<HTMLElement>('[data-customer-content]').forEach(element => { element.hidden = false; });
  return customer;
}
