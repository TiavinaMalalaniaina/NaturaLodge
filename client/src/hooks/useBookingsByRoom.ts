import { useMemo } from 'react';
import { RichBooking } from '../api/bookings';

/** Pré-indexe les réservations par chambre pour éviter un scan O(chambres × réservations) à chaque rendu. */
export function useBookingsByRoom(bookings: RichBooking[]): Map<string, RichBooking[]> {
  return useMemo(() => {
    const map = new Map<string, RichBooking[]>();
    for (const b of bookings) {
      if (b.status === 'cancelled' || b.status === 'checked-out') continue;
      for (const br of b.rooms) {
        const existing = map.get(br.room.id);
        if (existing) existing.push(b);
        else map.set(br.room.id, [b]);
      }
    }
    return map;
  }, [bookings]);
}
