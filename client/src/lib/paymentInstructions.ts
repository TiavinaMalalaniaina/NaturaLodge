import type { PaymentSheet, WebsiteRequest } from '../api/websiteRequests';

export type InstructionsLang = 'fr' | 'en';
export const requestLang = (row: Pick<WebsiteRequest, 'locale'>): InstructionsLang => (row.locale === 'EN' ? 'en' : 'fr');

const words = {
  fr: {
    sep: ' :', deposit: 'Acompte à régler', methods: 'Moyens de paiement', holder: 'titulaire',
    reference: 'Référence à indiquer dans le motif du paiement',
    proof: 'Après le paiement, déposez la preuve (capture ou reçu) dans votre espace client, rubrique « Mes réservations ».',
    whatsapp: (n: string) => ` Vous pouvez aussi l’envoyer par WhatsApp au ${n}.`,
  },
  en: {
    sep: ':', deposit: 'Deposit to pay', methods: 'Payment methods', holder: 'account name',
    reference: 'Reference to quote with your payment',
    proof: 'Once paid, upload the proof (screenshot or receipt) in your guest account, under “My bookings”.',
    whatsapp: (n: string) => ` You can also send it on WhatsApp to ${n}.`,
  },
};

// Text sent to the guest (email + guest account), in their language. It is shown below the greeting and
// the payment deadline, which the server adds itself.
export function buildInstructions(sheet: PaymentSheet, methodIds: string[], note: string, row: Pick<WebsiteRequest, 'depositAmount' | 'reference'>, lang: InstructionsLang) {
  const w = words[lang];
  const amount = `${row.depositAmount.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} Ar`;
  const methods = sheet.methods.filter(method => methodIds.includes(method.id));
  const hotelNote = lang === 'en' ? sheet.noteEn.trim() || sheet.noteFr.trim() : sheet.noteFr.trim();
  return [
    `${w.deposit}${w.sep} ${amount}`,
    methods.length ? `${w.methods}${w.sep}\n${methods.map(m => `- ${m.label}${w.sep} ${m.account}${m.holder ? ` (${w.holder}${w.sep} ${m.holder})` : ''}`).join('\n')}` : '',
    `${w.reference}${w.sep} ${row.reference}`,
    w.proof + (sheet.whatsapp ? w.whatsapp(sheet.whatsapp) : ''),
    hotelNote,
    note.trim(),
  ].filter(Boolean).join('\n\n');
}
