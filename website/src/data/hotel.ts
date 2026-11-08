import type { Lang } from '../i18n';

// Les contenus de la vitrine se modifient ici. Aucun accès à la base de gestion.
export const hotel = {
  name: 'Natura Lodge Manambato',
  location: 'Manambato, Madagascar',
  phone: '+261 32 37 634 99',
  phoneLink: '+261323763499',
  whatsappNumber: '261323763499',
  facebook: 'https://www.facebook.com/p/Natura-Lodge-Manambato-61574327443486/',
  // Recherche par nom : le point précis du code 65Q2+V7 Manambolo reste à confirmer.
  maps: 'https://www.google.com/maps/search/?api=1&query=Natura%20Lodge%20Manambato',
  description: {
    fr: 'Une maison moderne, une ambiance conviviale et le lac tout près. Découvrez Natura Lodge Manambato pour vos vacances en famille.',
    en: 'A modern house, a friendly atmosphere and the lake close by. Discover Natura Lodge Manambato for your family holidays.',
  } satisfies Record<Lang, string>,
  currency: 'Ar',
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
  updatedAt: '2026-11-08', // Date de dernière mise à jour des pages légales
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

export const whatsappLink = (message: string) => `https://wa.me/${hotel.whatsappNumber}?text=${encodeURIComponent(message)}`;
