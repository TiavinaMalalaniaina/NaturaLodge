import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';
import { computeEffectiveStatus } from '../../src/services/booking.service';

// Test unitaire pur (aucune base) : l'horloge est figée pour que le résultat ne dépende pas du jour
// où la suite tourne. Séjour du 10 au 13 juin, stocké à minuit UTC comme dans l'application.
const arrival = new Date('2026-06-10T00:00:00Z');
const departure = new Date('2026-06-13T00:00:00Z');
const at = (iso: string) => vi.setSystemTime(new Date(iso));
const status = (s: BookingStatus) => computeEffectiveStatus({ arrival, departure, status: s });

describe('computeEffectiveStatus', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('statuts terminaux, quelle que soit la date', () => {
    at('2026-06-11T12:00:00');
    expect(status('CANCELLED')).toBe('cancelled');
    expect(status('CLOSED')).toBe('closed');
    expect(status('CHECKED_OUT_PAID')).toBe('checked_out_paid');
    expect(status('CHECKED_OUT_UNPAID')).toBe('checked_out_unpaid');
    expect(status('CHECKED_OUT')).toBe('checked_out_unpaid');
    expect(status('AWAITING')).toBe('awaiting');
  });

  it('CONFIRMED : à venir, puis arrivée attendue', () => {
    at('2026-06-01T12:00:00');
    expect(status('CONFIRMED')).toBe('upcoming');
    at('2026-06-11T12:00:00');
    expect(status('CONFIRMED')).toBe('due_checkin');
  });

  it('CONFIRMED après la date de départ sans check-in → overdue', () => {
    at('2026-06-20T12:00:00');
    expect(status('CONFIRMED')).toBe('overdue');
  });

  it('CHECKED_IN : en séjour, puis en retard après le départ', () => {
    at('2026-06-11T12:00:00');
    expect(status('CHECKED_IN')).toBe('in_progress');
    at('2026-06-15T12:00:00');
    expect(status('CHECKED_IN')).toBe('overdue');
  });
});
