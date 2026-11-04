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
  description: 'Une maison moderne, une ambiance conviviale et le lac tout près. Découvrez Natura Lodge Manambato pour vos vacances en famille.',
  currency: 'Ar',
  deposit: 'Un acompte équivalent à une nuit est demandé pour confirmer votre réservation. Les modalités sont à convenir directement avec nous.',
};

// Tarifs et capacités provisoires communiqués par l’hôtel, indépendants de l’API.
export const rooms = [
  {
    name: 'Standard',
    capacity: 5,
    price: 130000,
    description: 'Retrouver les siens, se reposer et profiter de vacances ensemble. Un hébergement pour accueillir votre famille jusqu’à cinq personnes.',
    image: '/images/interior.png',
    alt: 'Intérieur d’une chambre de Natura Lodge, avec un lit double et un lit simple',
  },
  {
    name: 'Standard supérieur',
    capacity: 6,
    price: 150000,
    description: 'Le plaisir de partir avec toute la famille. Une capacité jusqu’à six personnes pour préparer votre prochaine parenthèse à Manambato.',
    image: '/images/interior-2.png',
    alt: 'Intérieur d’une chambre de Natura Lodge, avec un lit double et une fenêtre',
  },
];

export function whatsappLink(message = 'Bonjour Natura Lodge ! Je souhaite connaître vos disponibilités pour un séjour en famille.') {
  return `https://wa.me/${hotel.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const formatPrice = (price: number) => new Intl.NumberFormat('fr-FR').format(price);
