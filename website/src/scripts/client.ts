import { formatPrice } from '../data/hotel';
import { errorText, initAccount } from './account';

type Room = { id: string; name: string; price: number; capacity: number; available: number };
type RequestView = { reference: string; name: string; arrival: string; departure: string; guests: number; status: string; totalAmount: number; depositAmount: number; paymentInstructions: string; decisionNote: string; expiresAt: string | null; lines: { name: string; quantity: number }[] };
type Draft = { arrival: string; departure: string; guests: string; quantities: Record<string, number>; name?: string; phone?: string; notes?: string; savedAt: number };
const base = (import.meta.env.PUBLIC_API_URL || 'http://localhost:4000/api/public').replace(/\/$/, '');
const draftKey = 'naturalodge-draft';
const fail = (message: string) => { const el = document.querySelector('[data-error]'); if (el) el.textContent = message; };
async function api<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { credentials: 'include', method: body ? 'POST' : 'GET', headers: { ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !location.pathname.startsWith('/connexion')) { location.replace('/connexion/?next=' + encodeURIComponent(location.pathname.replace(/\/$/, ''))); throw new Error('Connectez-vous pour continuer.'); }
  if (!res.ok) throw new Error(errorText(data.error, 'La demande a échoué. Réessayez.'));
  return data;
}
const message = (err: unknown) => err instanceof Error ? err.message : 'Service indisponible. Réessayez.';
function readDraft(): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || 'null') as Draft | null;
    return draft && Date.now() - draft.savedAt < 86400000 ? draft : null;
  } catch { return null; }
}
async function start() {
  const search = document.querySelector<HTMLFormElement>('#availability-form');
  const form = document.querySelector<HTMLFormElement>('#booking-form');
  const customer = await initAccount(!search);
  if (!customer && !search && !location.pathname.startsWith('/connexion')) return;
  if (search && form) {
    const email = form.elements.namedItem('email') as HTMLInputElement;
    if (customer) { email.value = customer.email; email.readOnly = true; }
    const input = (name: string) => search.elements.namedItem(name) as HTMLInputElement;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
    const choices = document.querySelector<HTMLFieldSetElement>('#room-options')!;
    const details = document.querySelector<HTMLFieldSetElement>('#guest-details')!;
    const loginBox = document.querySelector<HTMLElement>('#login-required')!;
    const container = document.querySelector('#live-room-options')!;
    let rooms: Room[] = [];
    let version = 0;
    let searching = false;
    let sending = false;
    let retry: { payload: string; token: string } | null = null;
    // Room type chosen from the homepage card: preselected until the guest edits a quantity.
    let wantedType = new URLSearchParams(location.search).get('type')?.trim().toLowerCase() ?? '';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    input('arrival').min = today;
    const quantityInputs = () => [...container.querySelectorAll<HTMLInputElement>('input')];
    const selected = () => quantityInputs().map((el, i) => ({ room: rooms[i], quantity: Number(el.value) })).filter(x => x.quantity > 0);
    const saveDraft = () => {
      const draft: Draft = { arrival: input('arrival').value, departure: input('departure').value, guests: input('guests').value,
        quantities: Object.fromEntries(selected().map(x => [x.room.id, x.quantity])),
        name: field('name').value, phone: field('phone').value, notes: field('notes').value, savedAt: Date.now() };
      try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* storage unavailable: selection is simply not kept */ }
    };
    function update() {
      const lines = selected();
      const nights = (Date.parse(input('departure').value) - Date.parse(input('arrival').value)) / 86400000;
      const nightly = lines.reduce((sum, x) => sum + x.quantity * x.room.price, 0);
      const capacity = lines.reduce((sum, x) => sum + x.quantity * x.room.capacity, 0);
      const quantity = lines.reduce((sum, x) => sum + x.quantity, 0);
      const valid = lines.length > 0 && capacity >= Number(input('guests').value) && quantity <= Number(input('guests').value) && quantityInputs().every(el => el.validity.valid);
      details.hidden = details.disabled = !valid || !customer;
      loginBox.hidden = !valid || !!customer;
      const values: Record<string, string> = { 'summary-room': `${quantity} chambre(s)`, 'summary-dates': `${input('arrival').value} → ${input('departure').value} · ${input('guests').value} voyageur(s)`, 'summary-nights': `${nights > 0 ? nights : 0} nuit(s)`, 'summary-price': `${formatPrice(nightly)} Ar`, 'summary-total': `${formatPrice(nightly * (nights > 0 ? nights : 0))} Ar`, 'summary-deposit': `${formatPrice(nightly)} Ar`, 'summary-balance': `${formatPrice(nightly * Math.max(0, nights - 1))} Ar` };
      for (const [id, value] of Object.entries(values)) document.getElementById(id)!.textContent = value;
      document.querySelector('#selection-status')!.textContent = valid ? `${capacity} places pour votre groupe.` : 'Choisissez des chambres avec assez de places et au moins un voyageur par chambre.';
      document.querySelector('#summary-lines')!.replaceChildren(...lines.map(x => { const p = document.createElement('p'); p.textContent = `${x.quantity} × ${x.room.name} · ${formatPrice(x.room.price)} Ar / nuit`; return p; }));
    }
    async function runSearch(quantities: Record<string, number> = {}) {
      if (searching || sending) return;
      const current = ++version;
      searching = true; fail('');
      const status = document.querySelector('#availability-status')!;
      status.textContent = 'Recherche des disponibilités…';
      try {
        const data = await api<Room[]>(`/availability?${new URLSearchParams(new FormData(search!) as unknown as Record<string, string>)}`);
        if (current !== version) return;
        rooms = data;
        container.replaceChildren(...rooms.map(room => {
          const label = document.createElement('label'); label.className = 'room-choice';
          const text = document.createElement('span'); text.textContent = `${room.name} · ${room.capacity} personnes · ${formatPrice(room.price)} Ar / nuit · ${room.available} disponible(s)`;
          const max = Math.min(50, room.available);
          const number = document.createElement('input'); number.type = 'number'; number.min = '0'; number.max = String(max); number.step = '1'; number.value = String(Math.min(quantities[room.id] ?? (room.name.trim().toLowerCase() === wantedType ? 1 : 0), max)); number.required = true; number.setAttribute('aria-label', `Quantité : ${room.name}`); number.addEventListener('input', () => { wantedType = ''; update(); });
          label.append(text, number); return label;
        }));
        choices.hidden = choices.disabled = !rooms.length;
        status.textContent = rooms.length ? 'Choisissez vos chambres.' : 'Aucune chambre disponible à ces dates.';
        update();
      } catch (err) { status.textContent = ''; fail(message(err)); } finally { searching = false; }
    }
    search.addEventListener('input', () => { version++; rooms = []; container.replaceChildren(); choices.hidden = choices.disabled = details.hidden = details.disabled = loginBox.hidden = true; update(); });
    search.addEventListener('submit', event => { event.preventDefault(); void runSearch(); });
    document.querySelector('#login-to-book')!.addEventListener('click', () => { saveDraft(); location.assign('/connexion/?next=/reservation'); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!customer || sending || details.disabled || !form.reportValidity()) return;
      const data = new FormData(form);
      const payload = JSON.stringify({ arrival: input('arrival').value, departure: input('departure').value, guests: Number(input('guests').value), name: data.get('name'), email: data.get('email'), phone: data.get('phone'), notes: data.get('notes'), conditionsAccepted: data.get('conditions') === 'on', lines: selected().map(x => ({ roomTypeId: x.room.id, quantity: x.quantity, unitPrice: x.room.price })) });
      try {
        // Persist the retry credential before sending so a network interruption cannot lose the request.
        const pending = JSON.parse(localStorage.getItem('naturalodge-pending-request') || 'null');
        if (!retry || retry.payload !== payload) retry = pending?.payload === payload ? pending : { payload, token: Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('') };
        localStorage.setItem('naturalodge-pending-request', JSON.stringify(retry));
        saveDraft();
        sending = true; details.disabled = true; search.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el => { el.disabled = true; }); fail('');
        await api<RequestView>('/reservation-requests', JSON.parse(payload), retry!.token);
        localStorage.removeItem('naturalodge-pending-request'); localStorage.removeItem(draftKey); location.assign('/mes-reservations/');
      } catch (err) { fail(message(err)); } finally { sending = false; details.disabled = false; search.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el => { el.disabled = false; }); }
    });
    const draft = readDraft();
    if (draft && draft.arrival >= today) {
      input('arrival').value = draft.arrival; input('departure').value = draft.departure; input('guests').value = draft.guests;
      if (draft.name) field('name').value = draft.name;
      if (draft.phone) field('phone').value = draft.phone;
      if (draft.notes) field('notes').value = draft.notes;
      await runSearch(draft.quantities);
    }
  }
  const list = document.querySelector('#reservations-list');
  if (list) {
    const labels: Record<string, string> = { PENDING: 'En attente de validation', AWAITING_PAYMENT: 'Acompte à régler', CONFIRMED: 'Réservation confirmée', REJECTED: 'Demande refusée', EXPIRED: 'Délai expiré', CANCELLED: 'Séjour annulé' };
    const help: Record<string, string> = {
      PENDING: 'L’hôtel vérifie la disponibilité de vos chambres. Vous recevrez un email dès sa réponse.',
      AWAITING_PAYMENT: 'Vos chambres sont bloquées. Réglez l’acompte avant l’échéance pour confirmer votre séjour.',
      CONFIRMED: 'Votre acompte est vérifié. À bientôt à Natura Lodge !',
      REJECTED: 'L’hôtel n’a pas pu donner suite à cette demande.',
      EXPIRED: 'L’acompte n’a pas été reçu à temps et les chambres ont été libérées. Vous pouvez refaire une demande.',
      CANCELLED: 'Ce séjour a été annulé par l’hôtel. Contactez-nous pour toute question.',
    };
    // Stay dates are stored at UTC midnight: format in UTC so they never shift by a day.
    const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    const deadline = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const remaining = (iso: string) => {
      const minutes = Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 60000));
      const hours = Math.floor(minutes / 60);
      return hours >= 24 ? `${Math.floor(hours / 24)} j ${hours % 24} h` : hours ? `${hours} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`;
    };
    const el = (tag: string, className: string, text = '') => { const node = document.createElement(tag); if (className) node.className = className; node.textContent = text; return node; };
    let rows: RequestView[] = [];
    function render() {
      if (!rows.length) { list!.textContent = 'Aucune demande de réservation pour le moment.'; return; }
      list!.replaceChildren(...rows.map(row => {
        const card = el('article', 'reservation-card');
        const nights = Math.round((Date.parse(row.departure) - Date.parse(row.arrival)) / 86400000);
        card.append(
          el('span', `badge status-${row.status.toLowerCase().replace('_', '-')}`, labels[row.status] || row.status),
          el('h3', '', `Du ${day(row.arrival)} au ${day(row.departure)}`),
          el('p', 'muted', `${nights} nuit(s) · ${row.guests} voyageur(s) · ${row.lines.map(x => `${x.quantity} × ${x.name}`).join(', ')}`),
          el('p', '', `Total du séjour : ${formatPrice(row.totalAmount)} Ar · Acompte : ${formatPrice(row.depositAmount)} Ar`),
          el('p', 'muted', help[row.status] ?? ''),
        );
        if (row.status === 'AWAITING_PAYMENT') {
          const box = el('div', 'payment-box');
          box.append(el('p', 'payment-title', 'Instructions de paiement'), el('p', 'payment-instructions', row.paymentInstructions));
          if (row.expiresAt) box.append(el('p', 'payment-deadline', `À régler avant le ${deadline(row.expiresAt)} (heure de Madagascar) — il reste ${remaining(row.expiresAt)}.`));
          card.append(box);
        }
        if ((row.status === 'REJECTED' || row.status === 'CANCELLED') && row.decisionNote) card.append(el('p', 'payment-instructions', `Message de l’hôtel : ${row.decisionNote}`));
        card.append(el('p', 'reference', `Référence à rappeler à l’hôtel : ${row.reference}`));
        return card;
      }));
    }
    let refreshing = false;
    async function refresh() {
      if (refreshing) return; refreshing = true;
      try { rows = await api<RequestView[]>('/reservation-requests'); render(); }
      catch (err) { fail(message(err)); } finally { refreshing = false; }
    }
    void refresh();
    setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
  }

}
void start().catch(err => fail(message(err)));
