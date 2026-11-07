type Customer = { id: string; email: string };
const base = (import.meta.env.PUBLIC_API_URL || 'http://localhost:4000/api/public').replace(/\/$/, '');

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${base}/auth${path}`, { credentials: 'include', cache: 'no-store', method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorText(value.error, 'Connexion indisponible. Réessayez.'));
  return value;
}

// The API returns either a message string or a flattened Zod error ({ formErrors, fieldErrors }).
export function errorText(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const { formErrors = [], fieldErrors = {} } = error as { formErrors?: unknown[]; fieldErrors?: Record<string, unknown[] | undefined> };
    const messages = [...formErrors, ...Object.values(fieldErrors).flat()].filter((m): m is string => typeof m === 'string' && m.length > 0);
    if (messages.length) return [...new Set(messages)].join(' · ');
  }
  return fallback;
}

function destination() {
  return new URLSearchParams(location.search).get('next') === '/reservation' ? '/reservation' : '/mes-reservations';
}

export async function initAccount(required = true): Promise<Customer | null> {
  const form = document.querySelector<HTMLFormElement>('#login-form');
  const error = document.querySelector('[data-error]');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button')!;
    button.disabled = true;
    if (error) error.textContent = '';
    try {
      const value = await request<{ message: string }>('/email', { email: new FormData(form).get('email'), next: destination() });
      document.querySelector('[data-success]')!.textContent = value.message;
    } catch (err) { if (error) error.textContent = err instanceof Error ? err.message : 'Connexion indisponible.'; }
    finally { button.disabled = false; }
  });
  const login = new URLSearchParams(location.hash.slice(1)).get('login');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  if (login && form) {
    // Consume only after a deliberate click so email scanners do not sign in for the guest.
    const confirm = document.querySelector<HTMLButtonElement>('#confirm-login')!;
    confirm.hidden = false;
    form.hidden = true;
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      try {
        await request<Customer>('/verify', { token: login });
        location.replace(destination());
      } catch (err) { if (error) error.textContent = err instanceof Error ? err.message : 'Lien invalide.'; }
      finally { confirm.disabled = false; }
    });
  }
  let customer: Customer;
  try { customer = await request<Customer>('/me'); }
  catch {
    if (!form && required) location.replace('/connexion/?next=' + encodeURIComponent(location.pathname.replace(/\/$/, '')));
    return null;
  }
  const account = document.querySelector<HTMLAnchorElement>('[data-account]');
  if (account) { account.textContent = customer.email; account.href = '/mes-reservations'; }
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
        location.replace('/connexion/');
      } catch { if (error) error.textContent = 'La déconnexion a échoué. Réessayez.'; logout.disabled = false; }
    });
  }
  if (form && !login) location.replace(destination());
  document.querySelectorAll<HTMLElement>('[data-customer-content]').forEach(element => { element.hidden = false; });
  return customer;
}
