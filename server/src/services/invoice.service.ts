import { BookingStatus, ExtraPricing, InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../errors/AppError';
import {
  GenerateInvoiceInput, InvoiceDiscountInput, InvoiceItemInput, InvoiceListParams, PaymentInput,
  UpdateInvoiceInput, UpdateInvoiceItemInput,
} from '../validation/invoice.schema';
import * as ledgerService from './ledger.service';
import { assertCanViewCashAccount } from '../lib/treasuryAccess';
import { resyncCheckoutPaymentStatus, computeEffectiveStatus } from './booking.service';

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
      source:      'BOOKING' as const,
    };
    const extraItems = br.extras.map(e => {
      const quantity = e.quantity * (e.pricing === 'PER_NIGHT' ? nights : 1);
      return {
        description: `${e.extra.name} — Chambre ${br.room.number}`,
        quantity,
        unitPrice: e.unitPrice,
        total:     quantity * e.unitPrice,
        source:    'BOOKING' as const,
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
      id: true, arrival: true, departure: true, status: true,
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

  const enriched = invoices.map(invoice => ({
    ...invoice,
    booking: { ...invoice.booking, effectiveStatus: computeEffectiveStatus(invoice.booking) },
  }));

  return {
    data: enriched,
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

// Base de calcul des remises en pourcentage : somme des lignes à total positif (chambres +
// suppléments + charges manuelles positives). Les remises elles-mêmes en sont exclues — plusieurs
// remises % portent donc toutes sur le même montant brut, sans cumul en cascade.
function positiveBaseOf(items: { total: number }[]): number {
  return items.reduce((s, i) => (i.total > 0 ? s + i.total : s), 0);
}

// Resynchronise les lignes et le total d'une facture déjà générée sur l'état actuel de la
// réservation (chambres/suppléments), appelée par booking.service.ts après toute mutation qui
// touche le montant (reassign, add/removeRoom, add/update/removeExtra). Ne touche pas aux
// factures CANCELLED/REFUNDED — chapitre clos, pas de resynchronisation silencieuse. La taxe
// (`taxAmount`) n'est jamais recalculée automatiquement : elle reste au montant déjà fixé (généré
// ou modifié manuellement via `update`), faute de taux stocké permettant de la rescaler proprement.
//
// Lignes MANUAL (dépenses flexibles / remises, voir addManualItem / addDiscount) :
//  - montant figé (`discountRate` null) → conservées telles quelles ;
//  - remise en pourcentage (`discountRate` renseigné) → `total` recalculé sur la base du moment.
// Le grand livre est ajusté par deux écritures distinctes : la variation côté réservation touche le
// produit 706000, la variation des remises % touche le contra-produit 709000.
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

  const bookingItems    = buildInvoiceItemsFromBooking(booking);
  const bookingSubtotal = bookingItems.reduce((s, i) => s + i.total, 0);

  const manualItems  = await tx.invoiceItem.findMany({ where: { invoiceId: invoice.id, source: 'MANUAL' } });
  const fixedManual  = manualItems.filter(i => i.discountRate === null);
  const pctDiscounts = manualItems.filter(i => i.discountRate !== null);

  const fixedManualSubtotal = fixedManual.reduce((s, i) => s + i.total, 0);

  // La base des remises % : lignes réservation + charges manuelles positives, hors remises.
  const pctBase = bookingSubtotal + positiveBaseOf(fixedManual);

  let pctDiscountOld = 0;
  let pctDiscountNew = 0;
  for (const d of pctDiscounts) {
    const newTotal = -Math.round(pctBase * d.discountRate! / 100);
    pctDiscountOld += d.total;
    pctDiscountNew += newTotal;
    if (newTotal !== d.total) {
      await tx.invoiceItem.update({ where: { id: d.id }, data: { unitPrice: newTotal, total: newTotal } });
    }
  }

  const previousSubtotal = invoice.totalAmount - invoice.taxAmount;
  const newSubtotal      = bookingSubtotal + fixedManualSubtotal + pctDiscountNew;
  // previousSubtotal = ancienBooking + fixedManual + pctDiscountOld → on en déduit l'ancienne part
  // "réservation" pour isoler chaque variation sur le bon compte de produit.
  const deltaBooking  = bookingSubtotal - (previousSubtotal - fixedManualSubtotal - pctDiscountOld);
  const deltaDiscount = pctDiscountNew - pctDiscountOld;

  await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id, source: 'BOOKING' } });
  await tx.invoice.update({
    where: { id: invoice.id },
    data:  { totalAmount: newSubtotal + invoice.taxAmount, items: { create: bookingItems } },
  });

  // Le grand livre suit le montant facturé même quand il change après coup — on ajuste par le delta
  // plutôt que de re-poser toute l'écriture, pour ne jamais toucher aux lignes déjà postées.
  if (deltaBooking !== 0) {
    await ledgerService.postEntry({
      source:           'INVOICE',
      relatedInvoiceId: invoice.id,
      memo:             `Resynchronisation facture ${invoice.number}`,
      lines: deltaBooking > 0
        ? [{ accountCode: '411000', debit: deltaBooking }, { accountCode: '706000', credit: deltaBooking }]
        : [{ accountCode: '706000', debit: -deltaBooking }, { accountCode: '411000', credit: -deltaBooking }],
    }, tx);
  }
  // deltaDiscount < 0 : la remise a grossi (base en hausse) → 709000 débité, créance réduite.
  if (deltaDiscount !== 0) {
    await ledgerService.postEntry({
      source:           'INVOICE',
      relatedInvoiceId: invoice.id,
      memo:             `Resynchronisation remise facture ${invoice.number}`,
      lines: deltaDiscount < 0
        ? [{ accountCode: '709000', debit: -deltaDiscount }, { accountCode: '411000', credit: -deltaDiscount }]
        : [{ accountCode: '411000', debit: deltaDiscount }, { accountCode: '709000', credit: deltaDiscount }],
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

export async function addPayment(invoiceId: string, data: PaymentInput, processedById: string, processedByRole?: string) {
  if (processedByRole) {
    // Le compte de trésorerie qui reçoit l'encaissement doit être accessible au rôle de l'opérateur.
    await assertCanViewCashAccount(processedByRole, data.accountId);
  }
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

// ─── Lignes personnalisées : dépenses flexibles & remises ────────────────────
// Lignes `InvoiceItem.source = MANUAL` ajoutées à la main sur une facture existante :
//  - charge libre (casse, service exceptionnel…) → total positif ;
//  - remise en montant fixe → total négatif, `discountRate` null ;
//  - remise en pourcentage → `discountRate` renseigné, total recalculé à chaque resynchronisation.
// Elles échappent à syncInvoiceWithBooking (qui ne réécrit que les lignes BOOKING). La TVA n'est
// jamais recalculée — cohérent avec le reste du domaine ; ajuster `taxAmount` via `update` si besoin.
// Comptes de contrepartie de la créance 411000 : produit 706000 pour une charge, contra-produit
// 709000 (Rabais, remises et ristournes accordés) pour une remise.

type ContraAccount = '706000' | '709000';

// Une ligne à total négatif ou portant un taux de remise est une remise → contra-produit 709000.
function contraAccountFor(line: { total: number; discountRate: number | null }): ContraAccount {
  return line.discountRate !== null || line.total < 0 ? '709000' : '706000';
}

function assertInvoiceItemsEditable(invoiceStatus: InvoiceStatus, bookingStatus: BookingStatus): void {
  if (invoiceStatus === 'CANCELLED' || invoiceStatus === 'REFUNDED') {
    throw new ConflictError('Cette facture est annulée, ses lignes ne peuvent plus être modifiées.');
  }
  if (bookingStatus === 'CLOSED') {
    throw new ConflictError('La réservation est clôturée, sa facture ne peut plus être modifiée.');
  }
}

// Répercute une variation de montant d'une ligne (ajout / modification / suppression) sur le total
// facturé ET sur le grand livre — créance client 411000 vs `contra` (706000 ou 709000), même
// mécanique de delta que syncInvoiceWithBooking — puis resynchronise le statut de la facture et
// celui de la réservation liée. `delta > 0` = la facture augmente. Écriture omise si le delta est nul.
async function applyInvoiceItemDelta(
  tx: Prisma.TransactionClient,
  invoice: { id: string; number: string; totalAmount: number; bookingId: string },
  delta: number,
  contra: ContraAccount,
  memo: string,
  postedById: string,
): Promise<void> {
  if (delta !== 0) {
    await tx.invoice.update({ where: { id: invoice.id }, data: { totalAmount: invoice.totalAmount + delta } });
    await ledgerService.postEntry({
      source:           'INVOICE',
      relatedInvoiceId: invoice.id,
      postedById,
      memo,
      lines: delta > 0
        ? [{ accountCode: '411000', debit: delta }, { accountCode: contra, credit: delta }]
        : [{ accountCode: contra, debit: -delta }, { accountCode: '411000', credit: -delta }],
    }, tx);
  }
  await syncInvoiceStatus(invoice.id, tx);
  await resyncCheckoutPaymentStatus(invoice.bookingId, tx);
}

async function loadEditableInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { booking: { select: { status: true } }, items: { select: { total: true } } },
  });
  if (!invoice) throw new NotFoundError('Facture');
  assertInvoiceItemsEditable(invoice.status, invoice.booking.status);
  return invoice;
}

export async function addManualItem(invoiceId: string, data: InvoiceItemInput, postedById: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await loadEditableInvoice(tx, invoiceId);

    const total = data.quantity * data.unitPrice;
    await tx.invoiceItem.create({
      data: {
        invoiceId,
        description: data.description,
        quantity:   data.quantity,
        unitPrice:  data.unitPrice,
        total,
        source:     'MANUAL',
      },
    });

    await applyInvoiceItemDelta(tx, invoice, total, contraAccountFor({ total, discountRate: null }), `Ligne ajoutée « ${data.description} » — facture ${invoice.number}`, postedById);
    return tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  });
}

// Applique une remise : `mode: 'fixed'` → montant en Ariary figé ; `mode: 'percent'` → pourcentage
// entier 1–100 dont le montant se recalcule à chaque resynchronisation (voir syncInvoiceWithBooking)
// sur la base des lignes à total positif du moment. `value` est reçue en positif, portée en négatif.
export async function addDiscount(invoiceId: string, data: InvoiceDiscountInput, postedById: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await loadEditableInvoice(tx, invoiceId);

    let amount: number;
    let description: string;
    let discountRate: number | null = null;

    if (data.mode === 'percent') {
      const base = positiveBaseOf(invoice.items);
      if (base <= 0) throw new ConflictError('Aucun montant à remiser sur cette facture.');
      discountRate = data.value;
      amount       = -Math.round(base * data.value / 100);
      description  = data.label ?? `Remise ${data.value} %`;
    } else {
      amount      = -data.value;
      description = data.label ?? 'Remise';
    }

    const currentSubtotal = invoice.totalAmount - invoice.taxAmount;
    if (currentSubtotal + amount < 0) {
      throw new ConflictError('La remise dépasse le montant de la facture.');
    }

    await tx.invoiceItem.create({
      data: { invoiceId, description, quantity: 1, unitPrice: amount, total: amount, source: 'MANUAL', discountRate },
    });

    await applyInvoiceItemDelta(tx, invoice, amount, '709000', `${description} — facture ${invoice.number}`, postedById);
    return tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  });
}

export async function updateManualItem(invoiceId: string, itemId: string, data: UpdateInvoiceItemInput, postedById: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await loadEditableInvoice(tx, invoiceId);

    const item = await tx.invoiceItem.findUnique({ where: { id: itemId } });
    if (!item || item.invoiceId !== invoiceId) throw new NotFoundError('Ligne de facture');
    if (item.source !== 'MANUAL') {
      throw new ConflictError('Cette ligne est dérivée de la réservation, elle se modifie via la réservation.');
    }
    if (item.discountRate !== null) {
      throw new ConflictError('Cette remise est en pourcentage : retirez-la et ré-appliquez-la pour changer le taux.');
    }

    const quantity  = data.quantity  ?? item.quantity;
    const unitPrice = data.unitPrice ?? item.unitPrice;
    const newTotal  = quantity * unitPrice;
    const delta     = newTotal - item.total;

    await tx.invoiceItem.update({
      where: { id: itemId },
      data: {
        ...(data.description !== undefined && { description: data.description }),
        quantity,
        unitPrice,
        total: newTotal,
      },
    });

    await applyInvoiceItemDelta(tx, invoice, delta, contraAccountFor({ total: newTotal, discountRate: null }), `Ligne modifiée « ${data.description ?? item.description} » — facture ${invoice.number}`, postedById);
    return tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  });
}

export async function removeManualItem(invoiceId: string, itemId: string, postedById: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await loadEditableInvoice(tx, invoiceId);

    const item = await tx.invoiceItem.findUnique({ where: { id: itemId } });
    if (!item || item.invoiceId !== invoiceId) throw new NotFoundError('Ligne de facture');
    if (item.source !== 'MANUAL') {
      throw new ConflictError('Cette ligne est dérivée de la réservation, elle se retire via la réservation.');
    }

    await tx.invoiceItem.delete({ where: { id: itemId } });
    await applyInvoiceItemDelta(tx, invoice, -item.total, contraAccountFor(item), `Ligne retirée « ${item.description} » — facture ${invoice.number}`, postedById);
    return tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  });
}
