import type { Lang } from '../i18n';

// Les contenus de la vitrine se modifient ici. Aucun accès à la base de gestion.
export const hotel = {
  name: 'Natura Lodge Manambato',
  location: 'Manambato, Madagascar',
  phone: '+261 034 98 894 84',
  phoneLink: '+261 034 98 894 84',
  whatsappNumber: '261323763499',
  facebook: 'https://www.facebook.com/p/Natura-Lodge-Manambato-61574327443486/',
  // Recherche par nom : le point précis du code 65Q2+V7 Manambolo reste à confirmer.
  maps: 'https://www.google.com/maps/search/?api=1&query=Natura%20Lodge%20Manambato',
  // Carte intégrée, chargée seulement au clic du visiteur (requête envoyée à Google, voir la politique de confidentialité).
  mapsEmbed: 'https://www.google.com/maps?q=Natura%20Lodge%20Manambato&output=embed',
  // Lien « Voir tous nos avis » (fiche Google Business, onglet Avis). Vide : le lien n'est pas affiché.
  googleReviews: '',
  description: {
    fr: 'Une maison moderne, une ambiance conviviale et le lac tout près. Découvrez Natura Lodge Manambato pour vos vacances en famille.',
    en: 'A modern house, a friendly atmosphere and the lake close by. Discover Natura Lodge Manambato for your family holidays.',
  } satisfies Record<Lang, string>,
  currency: 'Ar',
  // Aperçu des liens partagés (WhatsApp, Facebook). Une photo 1200 × 630 serait idéale pour Facebook.
  shareImage: { path: '/images/house.png', width: 565, height: 565 },
};

// Informations légales de l'exploitant, affichées dans les mentions légales et la politique de
// confidentialité. Tant qu'un champ est vide, la page affiche « [à compléter] » et le build l'avertit.
// « pending » = numéro pas encore attribué : affiché « en cours d'attribution », toujours signalé au build.
export const legal = {
  company: 'Natura Lodge', // Raison sociale ou nom de l'exploitant
  legalForm: 'pending', // Forme juridique (SARL, entreprise individuelle…) — « pending » : immatriculation en cours
  nif: 'pending',       // Numéro d'identification fiscale
  stat: 'pending',      // Numéro statistique
  rcs: 'pending',       // Registre du commerce (si applicable)
  address: 'Manambato, Brickaville, Madagascar', // Adresse du siège / de l'établissement
  publisher: 'Tiavina Malalaniaina RAMIANDRISOA', // Directeur ou directrice de la publication
  privacyEmail: 'naturalodge.manambato@gmail.com', // Adresse dédiée à l'hôtel (pas une adresse personnelle) pour les demandes liées aux données
  host: 'Contabo GmbH, Aschauer Straße 32a, 81549 Munich, Allemagne', // Hébergeur du site : nom et adresse
  emailProvider: 'Google (Gmail)', // Service d'envoi des emails
  updatedAt: '2026-11-18', // Date de dernière mise à jour des pages légales
};

// Règles de réservation, reprises dans les conditions, le formulaire et les instructions de paiement.
export const policy = {
  refundDaysBeforeArrival: 3, // Acompte remboursé si l'annulation intervient au moins N jours avant l'arrivée
  proofRetention: { fr: '1 an après la date de départ prévue', en: '1 year after the scheduled departure date' },
};

// `roomType` = nom exact du type de chambre dans l’admin (RoomType.name) : la page d’accueil y lit le
// tarif et la capacité réels au chargement. `price`/`capacity` ne servent que de repli (API injoignable)
// et pour le HTML statique indexé par les moteurs de recherche.
export const rooms: { roomType: string; capacity: number; price: number; image: string; name: Record<Lang, string>; description: Record<Lang, string>; alt: Record<Lang, string> }[] = [
  {
    roomType: 'Standard',
    capacity: 5,
    price: 130000,
    image: '/images/interior.png',
    name: { fr: 'Standard', en: 'Standard' },
    description: {
      fr: 'Retrouver les siens, se reposer et profiter de vacances ensemble. Un hébergement pour accueillir votre famille jusqu’à cinq personnes.',
      en: 'Get together, rest and enjoy your holidays. A room that welcomes your family of up to five.',
    },
    alt: {
      fr: 'Intérieur d’une chambre de Natura Lodge, avec un lit double et un lit simple',
      en: 'Inside a Natura Lodge room, with a double bed and a single bed',
    },
  },
  {
    roomType: 'Standard Sup',
    capacity: 6,
    price: 150000,
    image: '/images/interior-2.png',
    name: { fr: 'Standard supérieur', en: 'Superior Standard' },
    description: {
      fr: 'Le plaisir de partir avec toute la famille. Une capacité jusqu’à six personnes pour préparer votre prochaine parenthèse à Manambato.',
      en: 'The joy of travelling with the whole family. Room for up to six for your next break in Manambato.',
    },
    alt: {
      fr: 'Intérieur d’une chambre de Natura Lodge, avec un lit double et une fenêtre',
      en: 'Inside a Natura Lodge room, with a double bed and a window',
    },
  },
];

// Prix par personne à pleine capacité, arrondi à la centaine supérieure (« dès … par personne »).
export const pricePerPerson = (price: number, capacity: number) => Math.ceil(price / Math.max(capacity, 1) / 100) * 100;

// Avis réels uniquement, recopiés avec l’accord du client (prénom + ville, jamais le nom complet).
// `month` au format AAAA-MM. `lang` = langue d’origine de l’avis, affiché tel quel dans les deux versions.
// Tant que la liste est vide (et `googleReviews` aussi), la section avis n’est pas affichée.
export const reviews: { name: string; city: string; month: string; lang: Lang; text: string }[] = [];

// Comment venir. Durées indicatives, à ajuster selon l’expérience de l’hôtel.
export const access: { from: string; duration: Record<Lang, string>; route: Record<Lang, string> }[] = [
  {
    from: 'Antananarivo',
    duration: { fr: 'Environ 6 h de route', en: 'About 6 hours by road' },
    route: { fr: 'Par la RN2 jusqu’à Brickaville, puis la piste jusqu’à Manambato.', en: 'Via the RN2 to Brickaville, then the dirt road to Manambato.' },
  },
  {
    from: 'Toamasina (Tamatave)',
    duration: { fr: 'Environ 2 h 30 de route', en: 'About 2.5 hours by road' },
    route: { fr: 'Par la RN2 vers le sud jusqu’à Brickaville, puis la piste jusqu’à Manambato.', en: 'South on the RN2 to Brickaville, then the dirt road to Manambato.' },
  },
];

// Galerie : photos réelles de l’hôtel dans public/images/. Ajouter une entrée par photo (15 à 20 idéalement).
export const gallery: { src: string; width: number; height: number; alt: Record<Lang, string> }[] = [
  { src: '/images/house.png', width: 565, height: 565, alt: { fr: 'La maison et le jardin au coucher du soleil', en: 'The house and garden at sunset' } },
  { src: '/images/house-2.png', width: 480, height: 640, alt: { fr: 'La façade, les terrasses et le jardin en journée', en: 'The front, terraces and garden by day' } },
  { src: '/images/interior.png', width: 480, height: 360, alt: { fr: 'Une chambre avec un lit double et un lit simple', en: 'A room with a double bed and a single bed' } },
  { src: '/images/interior-2.png', width: 480, height: 360, alt: { fr: 'Une chambre avec un lit double et une fenêtre', en: 'A room with a double bed and a window' } },
  { src: '/images/plage.png', width: 565, height: 565, alt: { fr: 'La plage et le bord de l’eau à Manambato', en: 'The beach and waterside in Manambato' } },
];

export const whatsappLink = (message: string) => `https://wa.me/${hotel.whatsappNumber}?text=${encodeURIComponent(message)}`;
