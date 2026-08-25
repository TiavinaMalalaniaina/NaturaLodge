import { ExtraPricing, InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { GenerateInvoiceInput, InvoiceListParams, PaymentInput, UpdateInvoiceInput } from '../validation/invoice.schema';
import * as ledgerService from './ledger.service';
import { resyncCheckoutPaymentStatus } from './booking.service';

type PrismaOrTx = Prisma.TransactionClient | typeof prisma;

type BookingForInvoiceItems = {
  rooms: {
    arrival:   Date;
    departure: Date;
    roomRate:  number;
    room:      { number: string; roomType: { name: string } };
    extras:    { quantity: number; unitPrice: number; pricing: ExtraPricing; extra: { name: string } }[];
  }[];
};

// Une ligne par chambre, suivie d'une ligne par supplément attaché à cette chambre. Utilisé par
// `generate()` (création) et `syncInvoiceWithBooking` (resynchronisation) — même calcul de nuits,
// pas de logique dupliquée.
function buildInvoiceItemsFromBooking(booking: BookingForInvoiceItems) {
  return booking.rooms.flatMap(br => {
    const nights = Math.max(1, Math.round((br.departure.getTime() - br.arrival.getTime()) / 86_400_000));
    const roomItem = {
      description: `${br.room.roomType.name} — Chambre ${br.room.number}`,
      quantity:    nights,
      unitPrice:   br.roomRate,
      total:       br.roomRate * nights,
    };
    const extraItems = br.extras.map(e => {
      const quantity = e.quantity * (e.pricing === 'PER_NIGHT' ? nights : 1);
      return {
        description: `${e.extra.name} — Chambre ${br.room.number}`,
        quantity,
        unitPrice: e.unitPrice,
        total:     quantity * e.unitPrice,
      };
    });
    return [roomItem, ...extraItems];
  });
}

const invoiceInclude = {
  items:    { orderBy: { id: 'asc' as const } },
  payments: {
    include: {
      processedBy: { select: { id: true, name: true, role: true } },
      account:     { select: { id: true, code: true, name: true } },
    },
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

// Forme liste (GET /invoices, paginée) : Invoices.tsx n'affiche que le nom du client et un total
// payé/restant dérivé des paiements — ni les lignes de facture (`items`) ni les chambres de la
// réservation (`booking.rooms`) ni les détails de traitement d'un paiement (`processedBy`,
// `account`) n'y sont lus. Ces champs restent dans `invoiceInclude` (détail, InvoiceView.tsx).
const invoiceListInclude = {
  payments: {
    select:  { id: true, amount: true, method: true, status: true, paidAt: true, reference: true, notes: true },
    orderBy: { paidAt: 'asc' as const },
  },
  booking: {
    select: {
      id: true, arrival: true, departure: true,
      guest: { select: { id: true, name: true, email: true } },
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
    prisma.invoice.findMany({ where, include: invoiceListInclude, orderBy: { issuedAt: 'desc' }, skip, take: limit }),
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
    const existing = await tx.invoice.findFirst({ where: { bookingId } });
    if (existing) {
      // Une facture existe déjà : on la resynchronise sur l'état actuel de la réservation
      // (chambres/suppléments ont pu changer depuis) plutôt que de renvoyer une copie périmée.
      await syncInvoiceWithBooking(tx, bookingId);
      const refreshed = await tx.invoice.findUnique({ where: { id: existing.id }, include: invoiceInclude });
      return { invoice: refreshed!, created: false as const };
    }

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: true,
        rooms: {
          include: {
            room:   { include: { roomType: true } },
            extras: { include: { extra: true } },
          },
        },
      },
    });
    if (!booking) throw new NotFoundError('Réservation');

    const items = buildInvoiceItemsFromBooking(booking);

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

    // Constate la créance client et le produit au moment de la facturation, pas de l'encaissement
    // (comptabilité d'engagement) — voir addPayment() pour l'écriture d'encaissement séparée.
    await ledgerService.postEntry({
      source:           'INVOICE',
      relatedInvoiceId: invoice.id,
      postedById:       issuedById,
      memo:             `Facture ${number}`,
      lines: [
        { accountCode: '411000', debit: totalAmount },
        { accountCode: '706000', credit: subtotal },
        ...(taxAmount > 0 ? [{ accountCode: '4457000', credit: taxAmount }] : []),
      ],
    }, tx);

    return { invoice, created: true as const };
  });
}

// Resynchronise les lignes et le total d'une facture déjà générée sur l'état actuel de la
// réservation (chambres/suppléments), appelée par booking.service.ts après toute mutation qui
// touche le montant (reassign, add/removeRoom, add/update/removeExtra). Ne touche pas aux
// factures CANCELLED/REFUNDED — chapitre clos, pas de resynchronisation silencieuse. La taxe
// (`taxAmount`) n'est jamais recalculée automatiquement : elle reste au montant déjà fixé (généré
// ou modifié manuellement via `update`), faute de taux stocké permettant de la rescaler proprement.
export async function syncInvoiceWithBooking(tx: PrismaOrTx, bookingId: string): Promise<void> {
  const invoice = await tx.invoice.findFirst({ where: { bookingId }, orderBy: { issuedAt: 'desc' } });
  if (!invoice || invoice.status === 'CANCELLED' || invoice.status === 'REFUNDED') return;

  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      rooms: {
        include: {
          room:   { include: { roomType: true } },
          extras: { include: { extra: true } },
        },
      },
    },
  });
  if (!booking) return;

  const items    = buildInvoiceItemsFromBooking(booking);
  const subtotal = items.reduce((s, i) => s + i.total, 0);

  const previousSubtotal = invoice.totalAmount - invoice.taxAmount;
  const delta            = subtotal - previousSubtotal;

  await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
  await tx.invoice.update({
    where: { id: invoice.id },
    data:  { totalAmount: subtotal + invoice.taxAmount, items: { create: items } },
  });

  // Le grand livre doit suivre le montant facturé même quand il change après coup (chambre/
  // supplément ajouté ou retiré) — on ajuste par le delta plutôt que de re-poser toute l'écriture,
  // pour ne jamais toucher aux lignes déjà postées (piste d'audit intacte).
  if (delta !== 0) {
    await ledgerService.postEntry({
      source:           'INVOICE',
      relatedInvoiceId: invoice.id,
      memo:             `Resynchronisation facture ${invoice.number}`,
      lines: delta > 0
        ? [{ accountCode: '411000', debit: delta }, { accountCode: '706000', credit: delta }]
        : [{ accountCode: '706000', debit: -delta }, { accountCode: '411000', credit: -delta }],
    }, tx);
  }

  await syncInvoiceStatus(invoice.id, tx);
}

export async function update(id: string, data: UpdateInvoiceInput) {
  if (data.taxAmount === undefined) {
    return prisma.invoice.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.dueAt !== undefined && { dueAt: data.dueAt ? new Date(data.dueAt) : null }),
      },
      include: invoiceInclude,
    });
  }

  // Un changement de taxAmount doit rester cohérent des deux côtés : le total facturé (qui inclut
  // la taxe) ET l'écriture 4457000 TVA collectée, sinon la facture affichée diverge du grand livre
  // (voir totalAmount = subtotal + taxAmount posé par generate()).
  const newTaxAmount = data.taxAmount;
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError('Facture');
    if (invoice.status === 'CANCELLED') throw new ConflictError('Cette facture est annulée, elle ne peut plus être modifiée.');

    const delta = newTaxAmount - invoice.taxAmount;

    const updated = await tx.invoice.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.dueAt !== undefined && { dueAt: data.dueAt ? new Date(data.dueAt) : null }),
        taxAmount:   newTaxAmount,
        totalAmount: invoice.totalAmount + delta,
      },
      include: invoiceInclude,
    });

    if (delta !== 0) {
      await ledgerService.postEntry({
        source:           'INVOICE',
        relatedInvoiceId: id,
        memo:             `Ajustement TVA facture ${invoice.number}`,
        lines: delta > 0
          ? [{ accountCode: '411000', debit: delta }, { accountCode: '4457000', credit: delta }]
          : [{ accountCode: '4457000', debit: -delta }, { accountCode: '411000', credit: -delta }],
      }, tx);
    }

    return updated;
  });
}

// Annule la facture : extourne dans le grand livre la part non encore encaissée (créance +
// produit + TVA correspondants), au prorata de ce qui reste dû. L'argent déjà réellement encaissé
// n'est pas touché ici — un remboursement de paiement passe par voidPayment(), pas par ce chemin.
// Accepte un `client` optionnel pour participer à une transaction déjà ouverte par l'appelant
// (voir cancelInvoiceForBooking, appelée depuis booking.service.ts: updateStatus).
export async function cancelInvoice(id: string, cancelledById?: string, client: PrismaOrTx = prisma) {
  const run = async (tx: PrismaOrTx) => {
    const invoice = await tx.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError('Facture');
    if (invoice.status === 'CANCELLED') throw new ConflictError('Cette facture est déjà annulée.');

    const payments = await tx.payment.findMany({ where: { invoiceId: id, status: 'COMPLETED' }, select: { amount: true } });
    const totalPaid   = payments.reduce((s, p) => s + p.amount, 0);
    const outstanding = invoice.totalAmount - totalPaid;

    if (outstanding > 0) {
      const reversalTax     = invoice.totalAmount > 0 ? Math.round(invoice.taxAmount * outstanding / invoice.totalAmount) : 0;
      const reversalRevenue = outstanding - reversalTax;

      await ledgerService.postEntry({
        source:           'INVOICE_CANCEL',
        relatedInvoiceId: id,
        postedById:       cancelledById,
        memo:             `Annulation facture ${invoice.number}`,
        lines: [
          ...(reversalRevenue > 0 ? [{ accountCode: '706000',  debit: reversalRevenue } as const] : []),
          ...(reversalTax     > 0 ? [{ accountCode: '4457000', debit: reversalTax }     as const] : []),
          { accountCode: '411000', credit: outstanding },
        ],
      }, tx);
    }

    return tx.invoice.update({ where: { id }, data: { status: 'CANCELLED' }, include: invoiceInclude });
  };

  return client === prisma ? prisma.$transaction(run) : run(client);
}

// No-op silencieux si la réservation n'a pas de facture ou si elle est déjà annulée — appelée
// depuis booking.service.ts au moment où une réservation passe en CANCELLED, pour ne jamais
// laisser une facture "orpheline" continuer à porter du revenu/une créance qui ne se réalisera
// jamais (voir la discussion sur la facturation anticipée d'un acompte avant confirmation).
export async function cancelInvoiceForBooking(bookingId: string, cancelledById?: string, client: PrismaOrTx = prisma) {
  const invoice = await client.invoice.findFirst({ where: { bookingId }, orderBy: { issuedAt: 'desc' } });
  if (!invoice || invoice.status === 'CANCELLED') return null;
  return cancelInvoice(invoice.id, cancelledById, client);
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

    const payment = await tx.payment.create({
      data: {
        invoiceId,
        processedById,
        amount:    data.amount,
        method:    data.method,
        accountId: data.accountId,
        reference: data.reference ?? null,
        notes:     data.notes ?? null,
        status:    'COMPLETED',
      },
    });

    // L'argent quitte la créance client pour entrer dans le compte de trésorerie choisi — c'est
    // cette écriture, pas la facturation, qui fait bouger le solde "où est l'argent".
    await ledgerService.postEntry({
      source:           'PAYMENT',
      relatedPaymentId: payment.id,
      relatedInvoiceId: invoiceId,
      postedById:       processedById,
      memo:             `Encaissement facture ${invoice.number}`,
      lines: [
        { accountId: data.accountId, debit: data.amount },
        { accountCode: '411000', credit: data.amount },
      ],
    }, tx);

    // Crédite le client de ce qui est réellement encaissé, au moment où ça l'est — pas d'un
    // montant coté figé au check-out (voir booking.service.ts: updateStatus).
    await tx.guest.update({
      where: { id: invoice.guestId },
      data:  { lifetimeValue: { increment: data.amount } },
    });

    await syncInvoiceStatus(invoiceId, tx);
    await resyncCheckoutPaymentStatus(invoice.bookingId, tx);

    return tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  });
}

export async function voidPayment(invoiceId: string, paymentId: string, voidedById?: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.invoiceId !== invoiceId) throw new NotFoundError('Paiement');
    if (payment.status !== 'COMPLETED') throw new ConflictError('Ce paiement a déjà été annulé ou n\'est pas encaissé.');

    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Facture');

    await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });

    // Contre-écriture de addPayment : l'argent ressort du compte de trésorerie qui l'avait reçu,
    // la créance client est rouverte. Jamais de suppression de l'écriture PAYMENT d'origine.
    await ledgerService.postEntry({
      source:           'PAYMENT_VOID',
      relatedPaymentId: payment.id,
      relatedInvoiceId: invoiceId,
      postedById:       voidedById,
      memo:             `Annulation paiement — facture ${invoice.number}`,
      lines: [
        { accountCode: '411000', debit: payment.amount },
        { accountId: payment.accountId, credit: payment.amount },
      ],
    }, tx);

    // Symétrique de addPayment : l'argent est rendu, on le retire de la valeur cumulée du client.
    await tx.guest.update({
      where: { id: invoice.guestId },
      data:  { lifetimeValue: { decrement: payment.amount } },
    });

    await syncInvoiceStatus(invoiceId, tx);
    await resyncCheckoutPaymentStatus(invoice.bookingId, tx);

    return tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  });
}
