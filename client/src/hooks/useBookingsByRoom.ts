import { useMemo } from 'react';
import { BookingRoomEntry, RichBooking } from '../api/bookings';

export interface RoomBookingEntry {
  booking: RichBooking;
  room: BookingRoomEntry;
}

/**
 * Pré-indexe les réservations par chambre pour éviter un scan O(chambres × réservations) à chaque
 * rendu. Renvoie la ligne `BookingRoomEntry` (pas la réservation entière) : sa `arrival`/`departure`
 * peut différer de celle de la réservation globale (réassignation en cours de séjour) — c'est elle
 * qui doit positionner le bloc sur la grille, jamais les dates de `RichBooking`.
 */
export function useBookingsByRoom(bookings: RichBooking[]): Map<string, RoomBookingEntry[]> {
  return useMemo(() => {
    const map = new Map<string, RoomBookingEntry[]>();
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      for (const br of b.rooms) {
        const entry = { booking: b, room: br };
        const existing = map.get(br.room.id);
        if (existing) existing.push(entry);
        else map.set(br.room.id, [entry]);
      }
    }
    return map;
  }, [bookings]);
}
