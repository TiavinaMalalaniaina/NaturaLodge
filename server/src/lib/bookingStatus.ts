import { BookingStatus } from '@prisma/client';

// États terminaux d'une réservation — plus aucune chambre occupée, plus aucun conflit possible.
// `CHECKED_OUT` (legacy) reste listé par sécurité même si plus aucune écriture ne le produit
// depuis le passage à CHECKED_OUT_UNPAID/CHECKED_OUT_PAID/CLOSED.
export const TERMINAL_STATUSES: BookingStatus[] = [
  'CANCELLED',
  'CHECKED_OUT',
  'CHECKED_OUT_UNPAID',
  'CHECKED_OUT_PAID',
  'CLOSED',
];
