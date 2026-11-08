import { hotel, legal, policy } from '../data/hotel';
import type { Lang } from './index';

export type LegalKind = 'notice' | 'privacy' | 'terms';
type Section = { title: string; paragraphs: string[] };
export type LegalPage = { title: string; eyebrow: string; intro: string; sections: Section[] };

export const legalSlugs: Record<LegalKind, string> = { notice: '/mentions-legales/', privacy: '/confidentialite/', terms: '/conditions/' };

// Empty fields are shown as a visible placeholder so an incomplete page is never mistaken for a final one.
const missing = (lang: Lang) => (lang === 'en' ? '[to be completed]' : '[à compléter]');
const pending = (lang: Lang) => (lang === 'en' ? 'being assigned' : 'en cours d’attribution');
const registration = (lang: Lang) => (lang === 'en' ? 'registration in progress' : 'immatriculation en cours');
const form = (lang: Lang) => (legal.legalForm.trim() === 'pending' ? registration(lang) : v(legal.legalForm, lang));
const v = (value: string, lang: Lang) => (value.trim() === 'pending' ? pending(lang) : value.trim() || missing(lang));
export const missingLegalFields = () => Object.entries(legal)
  .filter(([, value]) => !String(value).trim() || value === 'pending')
  .map(([key, value]) => (value === 'pending' ? `${key} (en cours)` : key));

const days = policy.refundDaysBeforeArrival;
const date = (lang: Lang) => new Date(`${legal.updatedAt}T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });

export function legalPage(kind: LegalKind, lang: Lang): LegalPage {
  const company = v(legal.company, lang);
  const contact = v(legal.privacyEmail, lang);
  if (lang === 'en') return en(kind, company, contact);
  return fr(kind, company, contact);
}

function fr(kind: LegalKind, company: string, contact: string): LegalPage {
  const updated = `Dernière mise à jour : ${date('fr')}.`;
  if (kind === 'notice') return {
    title: 'Mentions légales', eyebrow: 'Informations légales', intro: updated,
    sections: [
      { title: 'Éditeur du site', paragraphs: [
        `${company} — ${form('fr')}`,
        `NIF : ${v(legal.nif, 'fr')} · STAT : ${v(legal.stat, 'fr')} · RCS : ${v(legal.rcs, 'fr')}`,
        `Adresse : ${v(legal.address, 'fr')}`,
        `Téléphone : ${hotel.phone} · Email : ${contact}`,
        `Directeur ou directrice de la publication : ${v(legal.publisher, 'fr')}`,
      ] },
      { title: 'Hébergement', paragraphs: [v(legal.host, 'fr')] },
      { title: 'Propriété intellectuelle', paragraphs: ['Les textes, photographies et le logo de Natura Lodge Manambato sont la propriété de l’exploitant. Toute reproduction sans autorisation écrite est interdite.'] },
      { title: 'Informations publiées', paragraphs: ['Les tarifs et disponibilités affichés sont communiqués par l’hôtel pour les dates choisies. Une demande envoyée depuis le site ne vaut réservation qu’après validation par l’hôtel et vérification de l’acompte, selon les conditions de réservation.'] },
    ],
  };
  if (kind === 'privacy') return {
    title: 'Politique de confidentialité', eyebrow: 'Vos données personnelles',
    intro: `${updated} Cette page explique quelles données le site collecte, pourquoi, combien de temps elles sont conservées et comment exercer vos droits, conformément à la loi n° 2014-038 du 9 janvier 2015 sur la protection des données à caractère personnel.`,
    sections: [
      { title: 'Responsable du traitement', paragraphs: [`${company}, ${v(legal.address, 'fr')}. Contact pour vos données : ${contact}.`] },
      { title: 'Données collectées', paragraphs: [
        'Compte client : votre adresse email, qui sert à vous connecter par un lien envoyé par email (sans mot de passe).',
        'Demande de réservation : nom, adresse email, téléphone, message facultatif, dates, nombre de voyageurs et chambres choisies.',
        'Paiement : les preuves que vous envoyez (capture d’écran ou reçu, pouvant contenir un nom et un numéro de téléphone) et la note facultative associée.',
        'Données techniques : un cookie de session strictement nécessaire à la connexion, l’adresse IP et la page demandée dans les journaux du serveur, et un brouillon de votre sélection enregistré dans votre propre navigateur.',
      ] },
      { title: 'Pourquoi nous les utilisons', paragraphs: [
        'Traiter votre demande, préparer et confirmer votre séjour, vous envoyer les emails de suivi et vérifier votre paiement (mesures précontractuelles et exécution de la réservation).',
        'Protéger le site contre les abus, par exemple en limitant le nombre de requêtes (intérêt légitime).',
        'Respecter nos obligations comptables et fiscales pour les séjours facturés (obligation légale).',
        'Aucune donnée n’est vendue ni utilisée à des fins publicitaires. Le site n’utilise ni cookie publicitaire ni outil de mesure d’audience.',
      ] },
      { title: 'Qui y a accès', paragraphs: [
        'Le personnel habilité de l’hôtel, chacun selon ses fonctions.',
        `Nos prestataires techniques, uniquement pour faire fonctionner le service : l’hébergeur du site (${v(legal.host, 'fr')}) et le service d’envoi des emails (${v(legal.emailProvider, 'fr')}).`,
        'Les polices de caractères du site sont chargées depuis Google Fonts : votre navigateur transmet alors votre adresse IP à Google.',
      ] },
      { title: 'Durées de conservation', paragraphs: [
        'Lien de connexion : 15 minutes, utilisable une seule fois. Session : 7 jours, ou jusqu’à la déconnexion.',
        'Brouillon de sélection dans votre navigateur : 24 heures.',
        'Journaux techniques du serveur (adresse IP, page demandée) : 15 jours.',
        `Preuves de paiement : supprimées automatiquement ${policy.proofRetention.fr}.`,
        'Demandes, coordonnées et séjours : conservés pendant la gestion de vos réservations, puis le temps exigé par nos obligations comptables pour les séjours facturés. Le reste est supprimé sur simple demande.',
      ] },
      { title: 'Vos droits', paragraphs: [
        `Vous pouvez demander l’accès à vos données, leur rectification, leur suppression ou vous opposer à leur traitement en écrivant à ${contact}, depuis l’adresse email de votre compte. Nous répondons dans un délai d’un mois. Les données liées à une obligation légale (factures) ne peuvent être supprimées avant la fin de la durée imposée.`,
        'Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la Commission Malagasy sur l’Informatique et des Libertés (CMIL).',
      ] },
      { title: 'Sécurité', paragraphs: ['Les échanges avec le site sont chiffrés (HTTPS). Le cookie de session n’est pas accessible aux scripts de la page. L’accès aux données dans l’outil de gestion de l’hôtel est réservé au personnel authentifié.'] },
    ],
  };
  return {
    title: 'Conditions de réservation', eyebrow: 'Réserver en toute clarté', intro: updated,
    sections: [
      { title: 'Demande et validation', paragraphs: [
        'Une demande envoyée depuis le site ne constitue pas une réservation. L’hôtel vérifie la disponibilité de l’ensemble des chambres puis accepte ou refuse la demande ; vous êtes informé par email et dans votre espace client.',
        'Les prix sont indiqués en ariary (Ar), par chambre et par nuit.',
      ] },
      { title: 'Acompte et confirmation', paragraphs: [
        'Après acceptation, un acompte équivalent à une nuit pour l’ensemble des chambres est demandé. Les instructions et le délai de paiement vous sont communiqués ; les chambres sont bloquées pendant ce délai.',
        'Sans paiement dans le délai, la demande expire et les chambres sont libérées.',
        'Le séjour est confirmé dès que l’hôtel a vérifié l’acompte. Le solde est réglé auprès de l’hôtel.',
      ] },
      { title: 'Annulation par le client', paragraphs: [
        'Avant tout paiement : vous pouvez annuler librement votre demande depuis votre espace client.',
        `Après paiement de l’acompte : l’acompte est remboursé si l’annulation intervient au moins ${days} jours avant la date d’arrivée. En deçà, ou en cas de non-présentation, l’acompte reste acquis à l’hôtel.`,
        'Pour annuler après paiement, contactez l’hôtel par téléphone, WhatsApp ou email en indiquant la référence de votre demande.',
      ] },
      { title: 'Annulation par l’hôtel', paragraphs: ['Si l’hôtel doit annuler un séjour confirmé, l’acompte versé est intégralement remboursé.'] },
      { title: 'Modification', paragraphs: ['Pour modifier vos dates ou vos chambres, contactez l’hôtel. Toute modification dépend des disponibilités ; un changement de chambres ou de prix nécessite votre accord.'] },
      { title: 'Contact', paragraphs: [`${hotel.name} · ${hotel.phone} · ${contact}`] },
    ],
  };
}

function en(kind: LegalKind, company: string, contact: string): LegalPage {
  const updated = `Last updated: ${date('en')}.`;
  if (kind === 'notice') return {
    title: 'Legal notice', eyebrow: 'Legal information', intro: updated,
    sections: [
      { title: 'Website publisher', paragraphs: [
        `${company} — ${form('en')}`,
        `Tax ID (NIF): ${v(legal.nif, 'en')} · STAT: ${v(legal.stat, 'en')} · Trade register (RCS): ${v(legal.rcs, 'en')}`,
        `Address: ${v(legal.address, 'en')}`,
        `Phone: ${hotel.phone} · Email: ${contact}`,
        `Publication director: ${v(legal.publisher, 'en')}`,
      ] },
      { title: 'Hosting', paragraphs: [v(legal.host, 'en')] },
      { title: 'Intellectual property', paragraphs: ['The texts, photographs and logo of Natura Lodge Manambato belong to the operator. Any reproduction without written permission is prohibited.'] },
      { title: 'Published information', paragraphs: ['Prices and availability shown are provided by the hotel for the selected dates. A request sent from the website is only a booking once the hotel has approved it and verified the deposit, under the booking terms.'] },
    ],
  };
  if (kind === 'privacy') return {
    title: 'Privacy policy', eyebrow: 'Your personal data',
    intro: `${updated} This page explains what data the website collects, why, how long it is kept and how to exercise your rights, in accordance with Malagasy Law No. 2014-038 of 9 January 2015 on the protection of personal data.`,
    sections: [
      { title: 'Data controller', paragraphs: [`${company}, ${v(legal.address, 'en')}. Contact for your data: ${contact}.`] },
      { title: 'Data collected', paragraphs: [
        'Guest account: your email address, used to sign in with a link sent by email (no password).',
        'Booking request: name, email address, phone number, optional message, dates, number of guests and chosen rooms.',
        'Payment: the proofs you send (screenshot or receipt, which may contain a name and phone number) and the optional note.',
        'Technical data: a session cookie strictly necessary to stay signed in, the IP address and requested page in the server logs, and a draft of your selection stored in your own browser.',
      ] },
      { title: 'Why we use it', paragraphs: [
        'To process your request, prepare and confirm your stay, send you follow-up emails and check your payment (pre-contractual steps and performance of the booking).',
        'To protect the website against abuse, for example by limiting the number of requests (legitimate interest).',
        'To meet our accounting and tax obligations for invoiced stays (legal obligation).',
        'No data is sold or used for advertising. The website uses no advertising cookies and no audience measurement tools.',
      ] },
      { title: 'Who can access it', paragraphs: [
        'Authorised hotel staff, each according to their role.',
        `Our technical providers, only to run the service: the website host (${v(legal.host, 'en')}) and the email delivery service (${v(legal.emailProvider, 'en')}).`,
        'The website fonts are loaded from Google Fonts: your browser then sends your IP address to Google.',
      ] },
      { title: 'How long we keep it', paragraphs: [
        'Sign-in link: 15 minutes, single use. Session: 7 days, or until you sign out.',
        'Selection draft in your browser: 24 hours.',
        'Server technical logs (IP address, requested page): 15 days.',
        `Payment proofs: automatically deleted ${policy.proofRetention.en}.`,
        'Requests, contact details and stays: kept while your bookings are handled, then for as long as our accounting obligations require for invoiced stays. Everything else is deleted on request.',
      ] },
      { title: 'Your rights', paragraphs: [
        `You may request access to your data, its correction or deletion, or object to its processing by writing to ${contact} from your account’s email address. We reply within one month. Data subject to a legal obligation (invoices) cannot be deleted before the required period ends.`,
        'If you believe your rights are not respected, you may contact the Malagasy data protection authority (CMIL, Commission Malagasy sur l’Informatique et des Libertés).',
      ] },
      { title: 'Security', paragraphs: ['Exchanges with the website are encrypted (HTTPS). The session cookie cannot be read by page scripts. Access to data in the hotel’s management tool is restricted to authenticated staff.'] },
    ],
  };
  return {
    title: 'Booking terms', eyebrow: 'Booking made clear', intro: updated,
    sections: [
      { title: 'Request and approval', paragraphs: [
        'A request sent from the website is not a booking. The hotel checks the availability of all rooms, then accepts or declines the request; you are informed by email and in your guest account.',
        'Prices are in ariary (Ar), per room and per night.',
      ] },
      { title: 'Deposit and confirmation', paragraphs: [
        'Once accepted, a deposit equal to one night for all rooms is required. Payment instructions and the deadline are sent to you; the rooms are held during that time.',
        'Without payment within the deadline, the request expires and the rooms are released.',
        'Your stay is confirmed as soon as the hotel has verified the deposit. The balance is paid to the hotel.',
      ] },
      { title: 'Cancellation by the guest', paragraphs: [
        'Before any payment: you can cancel your request freely from your guest account.',
        `After paying the deposit: the deposit is refunded if you cancel at least ${days} days before the arrival date. Later than that, or in case of no-show, the deposit is kept by the hotel.`,
        'To cancel after payment, contact the hotel by phone, WhatsApp or email, quoting your request reference.',
      ] },
      { title: 'Cancellation by the hotel', paragraphs: ['If the hotel has to cancel a confirmed stay, the deposit paid is refunded in full.'] },
      { title: 'Changes', paragraphs: ['To change your dates or rooms, contact the hotel. Any change depends on availability; a change of rooms or price requires your consent.'] },
      { title: 'Contact', paragraphs: [`${hotel.name} · ${hotel.phone} · ${contact}`] },
    ],
  };
}
