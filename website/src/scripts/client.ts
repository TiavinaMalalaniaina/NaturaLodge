import { dateLocale, formatPrice, localePath, stripLang } from '../i18n';
import { translateServer } from '../i18n/server';
import { errorText, initAccount, lang, loginUrl, s } from './account';

type Room = { id: string; name: string; price: number; capacity: number; available: number };
type Proof = { id: string; fileName: string; size: number; note: string; createdAt: string };
type RequestView = { proofs: Proof[]; id: string; reference: string; name: string; arrival: string; departure: string; guests: number; status: string; totalAmount: number; depositAmount: number; paymentInstructions: string; decisionNote: string; expiresAt: string | null; lines: { name: string; quantity: number }[] };
type Draft = { arrival: string; departure: string; guests: string; quantities: Record<string, number>; name?: string; phone?: string; arrivalTime?: string; notes?: string; savedAt: number };
const base = (import.meta.env.PUBLIC_API_URL || 'http://localhost:4000/api/public').replace(/\/$/, '');
const draftKey = 'naturalodge-draft';
const price = (value: number) => formatPrice(value, lang);
const onLoginPage = () => stripLang(location.pathname).startsWith('/connexion');
const fail = (message: string) => { const el = document.querySelector('[data-error]'); if (el) el.textContent = message; };
async function api<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { credentials: 'include', method: body ? 'POST' : 'GET', headers: { ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !onLoginPage()) { location.replace(loginUrl(location.pathname)); throw new Error(s.loginToContinue); }
  if (!res.ok) throw new Error(errorText(data.error, s.requestFailed));
  return data;
}
const message = (err: unknown) => err instanceof Error ? err.message : s.unavailable;
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
  if (!customer && !search && !onLoginPage()) return;
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
        name: field('name').value, phone: field('phone').value, arrivalTime: field('arrivalTime').value, notes: field('notes').value, savedAt: Date.now() };
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
      const values: Record<string, string> = { 'summary-room': s.rooms(quantity), 'summary-dates': `${input('arrival').value} → ${input('departure').value} · ${s.guests(input('guests').value)}`, 'summary-nights': s.nights(nights > 0 ? nights : 0), 'summary-price': `${price(nightly)} Ar`, 'summary-total': `${price(nightly * (nights > 0 ? nights : 0))} Ar`, 'summary-deposit': `${price(nightly)} Ar`, 'summary-balance': `${price(nightly * Math.max(0, nights - 1))} Ar` };
      for (const [id, value] of Object.entries(values)) document.getElementById(id)!.textContent = value;
      document.querySelector('#selection-status')!.textContent = valid ? s.places(capacity) : s.selectionHint;
      document.querySelector('#summary-lines')!.replaceChildren(...lines.map(x => { const p = document.createElement('p'); p.textContent = `${x.quantity} × ${x.room.name} · ${price(x.room.price)} ${s.perNight}`; return p; }));
    }
    async function runSearch(quantities: Record<string, number> = {}) {
      if (searching || sending) return;
      const current = ++version;
      searching = true; fail('');
      const status = document.querySelector('#availability-status')!;
      status.textContent = s.searching;
      try {
        const data = await api<Room[]>(`/availability?${new URLSearchParams(new FormData(search!) as unknown as Record<string, string>)}`);
        if (current !== version) return;
        rooms = data;
        container.replaceChildren(...rooms.map(room => {
          const label = document.createElement('label'); label.className = 'room-choice';
          const text = document.createElement('span'); text.textContent = s.roomLine(room.name, room.capacity, price(room.price), room.available);
          const max = Math.min(50, room.available);
          const number = document.createElement('input'); number.type = 'number'; number.min = '0'; number.max = String(max); number.step = '1'; number.value = String(Math.min(quantities[room.id] ?? (room.name.trim().toLowerCase() === wantedType ? 1 : 0), max)); number.required = true; number.setAttribute('aria-label', s.quantity(room.name)); number.addEventListener('input', () => { wantedType = ''; update(); });
          label.append(text, number); return label;
        }));
        choices.hidden = choices.disabled = !rooms.length;
        status.textContent = rooms.length ? s.chooseRooms : s.noRooms;
        update();
      } catch (err) { status.textContent = ''; fail(message(err)); } finally { searching = false; }
    }
    search.addEventListener('input', () => { version++; rooms = []; container.replaceChildren(); choices.hidden = choices.disabled = details.hidden = details.disabled = loginBox.hidden = true; update(); });
    search.addEventListener('submit', event => { event.preventDefault(); void runSearch(); });
    document.querySelector('#login-to-book')!.addEventListener('click', () => { saveDraft(); location.assign(loginUrl('/reservation')); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!customer || sending || details.disabled || !form.reportValidity()) return;
      const data = new FormData(form);
      const payload = JSON.stringify({ arrival: input('arrival').value, departure: input('departure').value, guests: Number(input('guests').value), name: data.get('name'), email: data.get('email'), phone: data.get('phone'), arrivalTime: data.get('arrivalTime') ?? '', notes: data.get('notes'), locale: lang, conditionsAccepted: data.get('conditions') === 'on', lines: selected().map(x => ({ roomTypeId: x.room.id, quantity: x.quantity, unitPrice: x.room.price })) });
      try {
        // Persist the retry credential before sending so a network interruption cannot lose the request.
        const pending = JSON.parse(localStorage.getItem('naturalodge-pending-request') || 'null');
        if (!retry || retry.payload !== payload) retry = pending?.payload === payload ? pending : { payload, token: Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('') };
        localStorage.setItem('naturalodge-pending-request', JSON.stringify(retry));
        saveDraft();
        sending = true; details.disabled = true; search.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el => { el.disabled = true; }); fail('');
        await api<RequestView>('/reservation-requests', JSON.parse(payload), retry!.token);
        localStorage.removeItem('naturalodge-pending-request'); localStorage.removeItem(draftKey); location.assign(localePath(lang, '/mes-reservations/'));
      } catch (err) { fail(message(err)); } finally { sending = false; details.disabled = false; search.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el => { el.disabled = false; }); }
    });
    const draft = readDraft();
    if (draft && draft.arrival >= today) {
      input('arrival').value = draft.arrival; input('departure').value = draft.departure; input('guests').value = draft.guests;
      if (draft.name) field('name').value = draft.name;
      if (draft.phone) field('phone').value = draft.phone;
      if (draft.arrivalTime) field('arrivalTime').value = draft.arrivalTime;
      if (draft.notes) field('notes').value = draft.notes;
      await runSearch(draft.quantities);
    }
  }
  const list = document.querySelector('#reservations-list');
  if (list) {
    // Stay dates are stored at UTC midnight: format in UTC so they never shift by a day.
    const day = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(lang), { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    const deadline = (iso: string) => new Date(iso).toLocaleString(dateLocale(lang), { timeZone: 'Indian/Antananarivo', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const remaining = (iso: string) => {
      const minutes = Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 60000));
      const hours = Math.floor(minutes / 60);
      return hours >= 24 ? s.remaining(Math.floor(hours / 24), hours % 24, 0) : s.remaining(0, hours, minutes % 60);
    };
    const el = (tag: string, className: string, text = '') => { const node = document.createElement(tag); if (className) node.className = className; node.textContent = text; return node; };
    let rows: RequestView[] = [];
    // Set while the guest prepares or sends a proof: the 30 s refresh must not wipe the chosen file.
    let editingProof = false;
    const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    async function sendProof(row: RequestView, file: File, note: string, status: HTMLElement, button: HTMLButtonElement) {
      if (!PROOF_TYPES.includes(file.type)) { status.textContent = s.proofType; return; }
      if (file.size > 5 * 1024 * 1024) { status.textContent = s.proofTooBig; return; }
      button.disabled = true; status.textContent = s.proofSending;
      try {
        const query = new URLSearchParams({ name: file.name.slice(0, 200), note: note.slice(0, 200) });
        const res = await fetch(`${base}/reservation-requests/${encodeURIComponent(row.id)}/proofs?${query}`, { method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': file.type }, body: file });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) { location.replace(loginUrl(location.pathname)); return; }
        if (!res.ok) throw new Error(errorText(data.error, s.requestFailed));
        editingProof = false; await refresh();
      } catch (err) { status.textContent = message(err); button.disabled = false; }
    }
    async function deleteProof(row: RequestView, proof: Proof, button: HTMLButtonElement) {
      if (!window.confirm(s.proofDeleteConfirm)) return;
      button.disabled = true; fail('');
      try {
        const res = await fetch(`${base}/reservation-requests/${encodeURIComponent(row.id)}/proofs/${encodeURIComponent(proof.id)}`, { method: 'DELETE', credentials: 'include', cache: 'no-store' });
        if (res.status === 401) { location.replace(loginUrl(location.pathname)); return; }
        if (!res.ok) throw new Error(errorText((await res.json().catch(() => ({}))).error, s.requestFailed));
        await refresh();
      } catch (err) { fail(message(err)); button.disabled = false; }
    }
    function proofList(row: RequestView, removable: boolean) {
      const wrap = el('div', 'proof-list');
      wrap.append(el('p', 'payment-title', s.proofsSent(row.proofs.length)));
      for (const proof of row.proofs) {
        const item = el('p', 'proof-item', `📎 ${proof.fileName} · ${new Date(proof.createdAt).toLocaleString(dateLocale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${proof.note ? ` · « ${proof.note} »` : ''}`);
        if (removable) {
          const del = el('button', 'proof-delete', s.proofDelete) as HTMLButtonElement;
          del.type = 'button';
          del.addEventListener('click', () => { void deleteProof(row, proof, del); });
          item.append(' ', del);
        }
        wrap.append(item);
      }
      return wrap;
    }
    function proofForm(row: RequestView) {
      const form = document.createElement('form'); form.className = 'proof-form';
      const noteLabel = el('label', '', s.proofNote);
      const note = document.createElement('input'); note.type = 'text'; note.maxLength = 200; note.placeholder = s.proofNotePlaceholder;
      noteLabel.append(note);
      const file = document.createElement('input'); file.type = 'file'; file.accept = PROOF_TYPES.join(','); file.hidden = true;
      const button = el('button', 'button button-green', s.proofImport) as HTMLButtonElement; button.type = 'button';
      const status = el('p', 'proof-status'); status.setAttribute('role', 'status');
      note.addEventListener('input', () => { editingProof = true; status.textContent = ''; });
      button.addEventListener('click', () => { editingProof = true; status.textContent = ''; file.click(); });
      file.addEventListener('change', () => {
        const chosen = file.files?.[0];
        file.value = '';
        if (chosen) void sendProof(row, chosen, note.value.trim(), status, button);
      });
      form.addEventListener('submit', event => event.preventDefault());
      form.append(el('p', 'payment-title', s.proofTitle), el('p', 'muted', s.proofHelp), noteLabel, button, file, status);
      return form;
    }
    async function cancel(row: RequestView, button: HTMLButtonElement) {
      if (!window.confirm(s.cancelConfirm)) return;
      button.disabled = true; fail('');
      try { await api(`/reservation-requests/${encodeURIComponent(row.id)}/cancel`, {}); await refresh(); }
      catch (err) { fail(message(err)); button.disabled = false; }
    }
    function render() {
      if (!rows.length) { list!.textContent = s.empty; return; }
      list!.replaceChildren(...rows.map(row => {
        const card = el('article', 'reservation-card');
        const nights = Math.round((Date.parse(row.departure) - Date.parse(row.arrival)) / 86400000);
        card.append(
          el('span', `badge status-${row.status.toLowerCase().replace('_', '-')}`, s.labels[row.status] || row.status),
          el('h3', '', s.stayRange(day(row.arrival), day(row.departure))),
          el('p', 'muted', `${s.nights(nights)} · ${s.guests(row.guests)} · ${row.lines.map(x => `${x.quantity} × ${x.name}`).join(', ')}`),
          el('p', '', s.totals(price(row.totalAmount), price(row.depositAmount))),
          el('p', 'muted', s.help[row.status] ?? ''),
        );
        if (row.status === 'AWAITING_PAYMENT') {
          const box = el('div', 'payment-box');
          box.append(el('p', 'payment-title', s.paymentTitle), el('p', 'payment-instructions', row.paymentInstructions));
          if (row.expiresAt) box.append(el('p', 'payment-deadline', s.payBefore(deadline(row.expiresAt), remaining(row.expiresAt))));
          if (row.proofs.length) box.append(proofList(row, true));
          if (row.proofs.length < 5) box.append(proofForm(row));
          card.append(box);
        } else if (row.proofs.length) {
          card.append(proofList(row, false));
        }
        if ((row.status === 'REJECTED' || row.status === 'CANCELLED') && row.decisionNote) card.append(el('p', 'payment-instructions', s.hotelMessage(translateServer(row.decisionNote, lang))));
        card.append(el('p', 'reference', s.reference(row.reference)));
        if (row.status === 'PENDING' || row.status === 'AWAITING_PAYMENT') {
          const button = el('button', 'cancel-request', s.cancel) as HTMLButtonElement;
          button.type = 'button';
          button.addEventListener('click', () => { void cancel(row, button); });
          card.append(button);
        }
        return card;
      }));
    }
    let refreshing = false;
    async function refresh() {
      if (refreshing) return; refreshing = true;
      try { rows = await api<RequestView[]>('/reservation-requests'); if (!editingProof) render(); }
      catch (err) { fail(message(err)); } finally { refreshing = false; }
    }
    void refresh();
    setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
  }
}
void start().catch(err => fail(message(err)));
