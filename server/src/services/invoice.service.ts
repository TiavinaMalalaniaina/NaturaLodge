import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { GenerateInvoiceInput, InvoiceListParams, PaymentInput, UpdateInvoiceInput } from '../validation/invoice.schema';

type PrismaOrTx = Prisma.TransactionClient | typeof prisma;

const invoiceInclude = {
  items:    { orderBy: { id: 'asc' as const } },
  payments: {
    include: { processedBy: { select: { id: true, name: true, role: true } } },
    orderBy: { paidAt: 'asc' as const },
  },
  booking: {
    select: {
      id: true, arrival: true, departure: true,
      guest: { select: { id: true, name: true, email: true } },
      rooms: {
        include: {
          room: {
            select: {
              id: true, number: true, rateOverride: true,
              roomType: { select: { name: true } },
            },
          },
        },
      },
    },
  },
};

async function generateInvoiceNumber(client: PrismaOrTx): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await client.invoice.count();
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function syncInvoiceStatus(invoiceId: string, client: PrismaOrTx = prisma): Promise<void> {
  const invoice = await client.invoice.findUnique({ where: { id: invoiceId }, select: { totalAmount: true } });
  if (!invoice) return;

  const payments = await client.payment.findMany({
    where: { invoiceId, status: 'COMPLETED' },
    select: { amount: true },
  });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  let status: InvoiceStatus = 'PENDING';
  let paidAt: Date | null   = null;
  if (totalPaid >= invoice.totalAmount) {
    status = 'PAID';
    paidAt = new Date();
  } else if (totalPaid > 0) {
    status = 'PARTIALLY_PAID';
  }

  await client.invoice.update({ where: { id: invoiceId }, data: { status, paidAt } });
}

export async function list(params: InvoiceListParams) {
  const { bookingId, guestId, status, page, limit } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(bookingId ? { bookingId } : {}),
    ...(guestId   ? { guestId }   : {}),
    ...(status    ? { status: status.toUpperCase() as InvoiceStatus } : {}),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({ where, include: invoiceInclude, orderBy: { issuedAt: 'desc' }, skip, take: limit }),
    prisma.invoice.count({ where }),
  ]);

  return {
    data: invoices,
    meta: {
      total, page, limit,
      totalPages:  Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

export async function getByBookingId(bookingId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { bookingId },
    include: invoiceInclude,
    orderBy: { issuedAt: 'desc' },
  });
  if (!invoice) throw new NotFoundError('Facture pour cette réservation');
  return invoice;
}

export async function getById(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) throw new NotFoundError('Facture');
  return invoice;
}

export async function generate(data: GenerateInvoiceInput, issuedById: string) {
  const { bookingId, taxRate, notes, dueAt } = data;

  // Vérification d'existence + génération du numéro + création dans une seule transaction :
  // ferme la race de génération concurrente sur le même numéro de facture (idempotent).
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({ where: { bookingId }, include: invoiceInclude });
    if (existing) return { invoice: existing, created: false as const };

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: true,
        rooms: { include: { room: { include: { roomType: true } } } },
      },
    });
    if (!booking) throw new NotFoundError('Réservation');

    const items = booking.rooms.map(br => {
      const nights    = Math.max(1, Math.round((br.departure.getTime() - br.arrival.getTime()) / 86_400_000));
      const unitPrice = br.roomRate;
      const total     = unitPrice * nights;
      return {
        description: `${br.room.roomType.name} — Chambre ${br.room.number}`,
        quantity:    nights,
        unitPrice,
        total,
      };
    });

    const subtotal    = items.reduce((s, i) => s + i.total, 0);
    const taxAmount   = Math.round(subtotal * taxRate / 100);
    const totalAmount = subtotal + taxAmount;
    const number      = await generateInvoiceNumber(tx);

    const invoice = await tx.invoice.create({
      data: {
        number,
        bookingId,
        guestId:    booking.guestId,
        issuedById,
        totalAmount,
        taxAmount,
        notes:      notes ?? null,
        dueAt:      dueAt ? new Date(dueAt) : null,
        items:      { create: items },
      },
      include: invoiceInclude,
    });

    return { invoice, created: true as const };
  });
}

export function update(id: string, data: UpdateInvoiceInput) {
  return prisma.invoice.update({
    where: { id },
    data: {
      ...(data.notes     !== undefined && { notes: data.notes }),
      ...(data.dueAt     !== undefined && { dueAt: data.dueAt ? new Date(data.dueAt) : null }),
      ...(data.taxAmount !== undefined && { taxAmount: data.taxAmount }),
      ...(data.status    !== undefined && { status: data.status }),
    },
    include: invoiceInclude,
  });
}

export async function addPayment(invoiceId: string, data: PaymentInput, processedById: string) {
  // Enregistrement du paiement + resynchronisation du statut de la facture dans une seule
  // transaction : évite qu'une facture reste dans un statut périmé si le process meurt entre les deux.
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Facture');
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new ConflictError('Cette facture ne peut plus recevoir de paiement.');
    }

    await tx.payment.create({
      data: {
        invoiceId,
        processedById,
        amount:    data.amount,
        method:    data.method,
        reference: data.reference ?? null,
        notes:     data.notes ?? null,
        status:    'COMPLETED',
      },
    });

    // Crédite le client de ce qui est réellement encaissé, au moment où ça l'est — pas d'un
    // montant coté figé au check-out (voir booking.service.ts: updateStatus).
    await tx.guest.update({
      where: { id: invoice.guestId },
      data:  { lifetimeValue: { increment: data.amount } },
    });

    await syncInvoiceStatus(invoiceId, tx);

    return tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  });
}

export async function voidPayment(invoiceId: string, paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.invoiceId !== invoiceId) throw new NotFoundError('Paiement');
    if (payment.status !== 'COMPLETED') throw new ConflictError('Ce paiement a déjà été annulé ou n\'est pas encaissé.');

    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { guestId: true } });
    if (!invoice) throw new NotFoundError('Facture');

    await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });

    // Symétrique de addPayment : l'argent est rendu, on le retire de la valeur cumulée du client.
    await tx.guest.update({
      where: { id: invoice.guestId },
      data:  { lifetimeValue: { decrement: payment.amount } },
    });

    await syncInvoiceStatus(invoiceId, tx);

    return tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  });
}
