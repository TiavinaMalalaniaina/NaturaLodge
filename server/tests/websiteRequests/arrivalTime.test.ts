import { describe, expect, it } from 'vitest';
import { requestSchema } from '../../src/validation/websiteRequest.schema';

const arrival = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const departure = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
const body = (arrivalTime?: string) => ({
  arrival, departure, guests: 2, name: 'Rakoto', email: 'rakoto@example.com', phone: '+261 34 00 000 00',
  conditionsAccepted: true, lines: [{ roomTypeId: 'type', quantity: 1, unitPrice: 100_000 }],
  ...(arrivalTime === undefined ? {} : { arrivalTime }),
});

describe('Demande du site — heure d’arrivée estimée', () => {
  it('est facultative', () => {
    expect(requestSchema.parse(body()).arrivalTime).toBe('');
    expect(requestSchema.parse(body('')).arrivalTime).toBe('');
  });

  it('accepte une heure HH:MM', () => {
    expect(requestSchema.parse(body('14:30')).arrivalTime).toBe('14:30');
    expect(requestSchema.parse(body('00:00')).arrivalTime).toBe('00:00');
  });

  it('refuse une heure invalide', () => {
    for (const value of ['24:00', '9:30', '14h30', '12:60', '14:30:00']) {
      expect(requestSchema.safeParse(body(value)).success).toBe(false);
    }
  });
});
