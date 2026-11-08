import { prisma } from '../lib/prisma';
import { PaymentSheet } from '../validation/websiteRequest.schema';

// The hotel's payment details, entered once. When accepting a request the manager ticks the methods
// to offer; the admin client turns the sheet into the instructions sent to the guest (in their language).
const KEY = 'paymentSheet';
const EMPTY: PaymentSheet = { methods: [], whatsapp: '', noteFr: '', noteEn: '' };

export async function paymentSheet() {
  const row = await prisma.websiteSetting.findUnique({ where: { key: KEY }, include: { updatedBy: { select: { name: true } } } });
  let sheet = EMPTY;
  try { if (row) sheet = { ...EMPTY, ...(JSON.parse(row.value) as PaymentSheet) }; } catch { /* corrupted value: start from an empty sheet */ }
  return { ...sheet, updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy?.name ?? null };
}

export async function savePaymentSheet(sheet: PaymentSheet, userId: string) {
  const value = JSON.stringify(sheet);
  await prisma.websiteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedById: userId }, update: { value, updatedById: userId } });
  return paymentSheet();
}
