import { BookingStatus, ExtraPricing, InvoiceKind, InvoiceStatus, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError, ForbiddenError } from '../errors/AppError';
import {
  CreateDepositInput, GenerateInvoiceInput, InvoiceDiscountInput, InvoiceItemInput, InvoiceListParams, PaymentInput,
  UpdateInvoiceInput, UpdateInvoiceItemInput,
} from '../validation/invoice.schema';
import * as ledgerService from './ledger.service';
import { assertCanViewCashAccount } from '../lib/treasuryAccess';
import { LOCK_KEYS } from '../lib/advisoryLock';
import { nextDocumentNumber } from '../lib/documentNumber';
import { roleHasPermission } from '../lib/permissions';
import { resyncCheckoutPaymentStatus, computeEffectiveStatus } from './booking.service';

type PrismaOrTx = Prisma.TransactionClient | typeof prisma;

// Part du montant facturé rendue au client sur une annulation, quand la facture avait déjà été
// visée (donc réellement au grand livre) — le complément (30% par défaut) reste acquis à l'hôtel
// comme frais d'annulation. Pas de HotelConfig en base (voir CLAUDE.md) : ce défaut vit ici,
// overridable ponctuellement par le personnel au moment de l'annulation (voir cancelInvoice).
export const DEFAULT_CANCELLATION_REFUND_RATE = 70;

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
  // `payments` du document crédité : sert à borner un remboursement d'avoir à ce qui a réellement
  // été encaissé (on ne rembourse pas de l'argent jamais reçu) — voir addPayment / InvoiceDocument.
  // Les acomptes imputés sur une facture font partie de ce qui a été encaissé pour elle.
  relatesToInvoice: {
    select: {
      id: true, number: true, kind: true, totalAmount: true,
      payments: { where: { status: 'COMPLETED' as const }, select: { amount: true } },
      appliedDeposits: {
        select: { totalAmount: true, payments: { where: { status: 'COMPLETED' as const }, select: { amount: true } } },
      },
    },
  },
  // Avoirs et factures complémentaires rattachés ; `payments` = ce que chaque avoir a déjà rendu.
  creditedBy: {
    select: {
      id: true, number: true, kind: true, totalAmount: true, validatedAt: true,
      payments: { where: { status: 'COMPLETED' as const }, select: { amount: true } },
    },
  },
  appliedToInvoice:  { select: { id: true, number: true } },
  booking: {
    select: {
      id: true, arrival: true, departure: true,
      // Dates réelles du séjour, affichées sur la facture à la place d'arrival/departure (prévues)
      // dès qu'elles sont connues — voir InvoiceView.tsx/InvoiceDocument.tsx.
      checkedInAt: true, checkedOutAt: true,
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

// Préfixe de numérotation par type de document — chaque type a sa propre séquence annuelle, attribuée
// uniquement au visa pour ne jamais laisser de trou dans l'ordre d'émission réel : un brouillon
// abandonné (jamais visé) ne consomme aucun numéro.
const NUMBER_PREFIX: Record<InvoiceKind, string> = {
  STANDARD:    'INV',
  DEPOSIT:     'ACO',
  CREDIT_NOTE: 'AVO',
};


function generateInvoiceNumber(tx: Prisma.TransactionClient, kind: InvoiceKind): Promise<string> {
  return nextDocumentNumber(tx, 'Invoice', NUMBER_PREFIX[kind], LOCK_KEYS.invoiceNumber);
}

async function sumPayments(client: PrismaOrTx, where: Prisma.PaymentWhereInput): Promise<number> {
  const agg = await client.payment.aggregate({ where: { status: 'COMPLETED', ...where }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

// Encaissé net sur un document : ses paiements (un remboursement de trop-perçu y est un paiement
// négatif) + ceux des acomptes imputés sur lui.
function collectedOn(client: PrismaOrTx, invoiceId: string): Promise<number> {
  return sumPayments(client, { OR: [{ invoiceId }, { invoice: { appliedToInvoiceId: invoiceId } }] });
}

// Situation d'un document facturé : montant (acomptes imputés compris), ce qu'en retirent ses avoirs
// visés, ce qui a été encaissé, et le trop-perçu restant à rendre au client — ce qu'il a payé
// au-delà de ce qu'il doit après avoirs, moins ce que ces avoirs lui ont déjà rendu.
async function balanceOf(client: PrismaOrTx, invoiceId: string) {
  const invoice = await client.invoice.findUnique({
    where:  { id: invoiceId },
    select: { totalAmount: true, appliedDeposits: { select: { totalAmount: true } } },
  });
  if (!invoice) return null;
  const credits = await client.invoice.aggregate({
    where: { relatesToInvoiceId: invoiceId, kind: 'CREDIT_NOTE', validatedAt: { not: null } },
    _sum:  { totalAmount: true },
  });
  const gross     = invoice.totalAmount + invoice.appliedDeposits.reduce((s, d) => s + d.totalAmount, 0);
  const credited  = credits._sum.totalAmount ?? 0;
  const collected = await collectedOn(client, invoiceId);
  const refundedByCredits = await sumPayments(client, { invoice: { relatesToInvoiceId: invoiceId, kind: 'CREDIT_NOTE' } });
  return { gross, credited, collected, overpaid: Math.max(0, collected - (gross - credited) - refundedByCredits) };
}

// Ce qu'un avoir peut encore rendre en argent : au plus son propre montant, et jamais plus que le
// trop-perçu du document crédité. Le reste de l'avoir efface une créance jamais payée. Ex. séjour
// 240 000, 100 000 encaissés, avoir à 70 % (168 000) : 72 000 sont retenus, donc 28 000 à rendre.
async function refundableOn(
  client: PrismaOrTx,
  creditNote: { id: string; totalAmount: number; relatesToInvoiceId: string | null },
): Promise<number> {
  const own = Math.max(0, creditNote.totalAmount - await sumPayments(client, { invoiceId: creditNote.id }));
  if (!creditNote.relatesToInvoiceId) return own;
  const balance = await balanceOf(client, creditNote.relatesToInvoiceId);
  return balance ? Math.min(own, balance.overpaid) : 0;
}

async function syncInvoiceStatus(invoiceId: string, client: PrismaOrTx = prisma): Promise<void> {
  const invoice = await client.invoice.findUnique({
    where:  { id: invoiceId },
    select: { id: true, kind: true, totalAmount: true, status: true, relatesToInvoiceId: true },
  });
  if (!invoice) return;
  // CANCELLED/REFUNDED sont des états terminaux posés explicitement par cancelInvoice() : ne jamais
  // les recalculer à partir des seuls paiements. Sans ce garde, un voidPayment() postérieur sur la
  // facture annulée la ferait repasser en PENDING (« non payée » alors qu'elle est annulée).
  if (invoice.status === 'CANCELLED' || invoice.status === 'REFUNDED') return;

  const paid = await sumPayments(client, { invoiceId });
  let settled: boolean;
  if (invoice.kind === 'CREDIT_NOTE') {
    // Un avoir est soldé quand plus rien n'est à rendre, pas quand son montant entier a été rendu.
    settled = await refundableOn(client, invoice) === 0;
  } else {
    const credits = await client.invoice.aggregate({
      where: { relatesToInvoiceId: invoiceId, kind: 'CREDIT_NOTE', validatedAt: { not: null } },
      _sum:  { totalAmount: true },
    });
    settled = paid >= invoice.totalAmount - (credits._sum.totalAmount ?? 0);
  }

  const status: InvoiceStatus = settled ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
  await client.invoice.update({ where: { id: invoiceId }, data: { status, paidAt: settled ? new Date() : null } });
}

// Un mouvement sur un document change aussi la situation des documents liés : le statut d'un avoir
// dépend de ce qui a été encaissé sur la facture qu'il crédite, et inversement.
async function syncDocumentAndRelated(client: PrismaOrTx, invoiceId: string): Promise<void> {
  const invoice = await client.invoice.findUnique({ where: { id: invoiceId }, select: { kind: true, relatesToInvoiceId: true } });
  if (!invoice) return;
  const rootId = invoice.kind === 'CREDIT_NOTE' && invoice.relatesToInvoiceId ? invoice.relatesToInvoiceId : invoiceId;
  await syncInvoiceStatus(rootId, client);
  const credits = await client.invoice.findMany({
    where:  { relatesToInvoiceId: rootId, kind: 'CREDIT_NOTE', validatedAt: { not: null } },
    select: { id: true },
  });
  for (const credit of credits) await syncInvoiceStatus(credit.id, client);
}

// Taux de TVA effectif d'une facture (TVA / HT hors acomptes déduits), appliqué quand ses lignes de
// séjour suivent une modification de la réservation.
async function taxRatioOf(client: PrismaOrTx, invoiceId: string): Promise<number> {
  const invoice = await client.invoice.findUnique({
    where:  { id: invoiceId },
    select: { totalAmount: true, taxAmount: true, appliedDeposits: { select: { totalAmount: true } } },
  });
  if (!invoice) return 0;
  const net = invoice.totalAmount + invoice.appliedDeposits.reduce((s, d) => s + d.totalAmount, 0) - invoice.taxAmount;
  return net > 0 ? invoice.taxAmount / net : 0;
}

export async function list(params: InvoiceListParams) {
  const { bookingId, guestId, status, kind, draft, page, limit } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(bookingId ? { bookingId } : {}),
    ...(guestId   ? { guestId }   : {}),
    ...(status    ? { status: status.toUpperCase() as InvoiceStatus } : {}),
    ...(kind      ? { kind: kind.toUpperCase() as InvoiceKind } : {}),
    ...(draft !== undefined ? { validatedAt: draft ? null : { not: null } } : {}),
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

// La "facture" d'une réservation, au sens historique de l'app (une par booking, potentiellement
// entourée d'acomptes/avoirs). Filtre explicitement `kind: STANDARD` — sans ça, un acompte ou un
// avoir plus récent (issuedAt) remonterait à la place de la vraie facture.
export async function getByBookingId(bookingId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { bookingId, kind: 'STANDARD' },
    include: invoiceInclude,
    orderBy: { issuedAt: 'desc' },
  });
  if (!invoice) throw new NotFoundError('Facture pour cette réservation');
  return invoice;
}

// Accès par id de document — sert à afficher/imprimer un acompte ou un avoir (voir
// /invoices/document/:invoiceId côté client), peu importe son `kind`.
export async function getById(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) throw new NotFoundError('Facture');
  return invoice;
}

// « Acomptes en cours » : détail, réservation par réservation, du solde du compte 419100 au bilan.
// Un acompte y figure tant qu'il n'est ni imputé sur une facture (voir validateInTx) ni éteint par
// un avoir visé.
export async function getOutstandingDeposits() {
  return prisma.invoice.findMany({
    where: {
      kind: 'DEPOSIT', validatedAt: { not: null }, appliedToInvoiceId: null,
      creditedBy: { none: { validatedAt: { not: null } } },
    },
    select: {
      id: true, number: true, totalAmount: true, validatedAt: true, bookingId: true,
      guest: { select: { id: true, name: true } },
    },
    orderBy: { validatedAt: 'asc' },
  });
}

// Acompte attendu pour une réservation : une nuit pour l'ensemble des chambres (règle affichée sur
// le site). Une demande du site a figé ce montant à sa création — c'est lui qui fait foi. `received`
// ne compte que l'argent encore détenu (paiements non annulés, acomptes non annulés).
export async function getDepositStatus(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: {
      rooms:          { select: { roomRate: true } },
      websiteRequest: { select: { id: true, reference: true, status: true, depositAmount: true } },
    },
  });
  if (!booking) throw new NotFoundError('Réservation');

  const expected = booking.websiteRequest?.depositAmount ?? booking.rooms.reduce((s, r) => s + r.roomRate, 0);
  const paid = await prisma.payment.aggregate({
    where: { status: 'COMPLETED', invoice: { bookingId, kind: 'DEPOSIT', status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
    _sum:  { amount: true },
  });
  const received = paid._sum.amount ?? 0;
  const request  = booking.websiteRequest;
  return {
    expected, received, remaining: Math.max(0, expected - received),
    // Demande du site à confirmer à la main une fois l'acompte reçu (plus de confirmation automatique).
    websiteRequest: request ? { id: request.id, reference: request.reference, status: request.status } : null,
  };
}

// Sérialise, par réservation, l'encaissement d'un acompte et le visa de la facture : sans ce verrou,
// un acompte reçu pendant le visa échapperait à l'imputation et serait payé deux fois.
async function lockBooking(tx: Prisma.TransactionClient, bookingId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
}

// Crée (ou resynchronise) le brouillon de facture STANDARD d'une réservation. Ne poste plus rien
// au grand livre : tant qu'elle n'est pas visée (voir validateInvoice), c'est un brouillon
// librement modifiable, absent de la comptabilité.
export async function generate(data: GenerateInvoiceInput, issuedById: string) {
  const { bookingId, taxRate, notes, dueAt } = data;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({ where: { bookingId, kind: 'STANDARD' } });
    if (existing) {
      if (existing.validatedAt) {
        throw new ConflictError('La facture de cette réservation est déjà visée : elle suit le séjour et se modifie directement.');
      }
      // Brouillon existant : on le resynchronise sur l'état actuel de la réservation
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

    const invoice = await tx.invoice.create({
      data: {
        kind:       'STANDARD',
        number:     null,
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

// Encaisse un acompte. Un acompte, c'est de l'argent reçu : la facture d'acompte n'est émise
// (numérotée, postée au grand livre) qu'avec l'encaissement, dans la même transaction — il n'existe
// donc jamais d'acompte visé mais impayé. Une fois la facture de la réservation visée, il n'y a plus
// d'acompte possible : l'argent reçu est un paiement sur la facture.
export async function receiveDeposit(data: CreateDepositInput, processedById: string, processedByRole?: string) {
  if (processedByRole) await assertCanViewCashAccount(processedByRole, data.accountId);

  const id = await prisma.$transaction(async (tx) => {
    await lockBooking(tx, data.bookingId);
    const booking = await tx.booking.findUnique({ where: { id: data.bookingId } });
    if (!booking) throw new NotFoundError('Réservation');
    if (booking.status === 'CANCELLED' || booking.status === 'CLOSED') {
      throw new ConflictError('Cette réservation est annulée ou clôturée : elle ne peut plus recevoir d’acompte.');
    }
    const invoiced = await tx.invoice.findFirst({ where: { bookingId: data.bookingId, kind: 'STANDARD', validatedAt: { not: null } } });
    if (invoiced) {
      throw new ConflictError('La facture de cette réservation est déjà visée : enregistrez ce montant comme un paiement sur la facture.');
    }
    await assertPaymentAccount(tx, data.accountId, data.method);

    const deposit = await tx.invoice.create({
      data: {
        kind:        'DEPOSIT',
        number:      null,
        bookingId:   data.bookingId,
        guestId:     booking.guestId,
        issuedById:  processedById,
        totalAmount: data.amount,
        taxAmount:   0,
        notes:       data.notes ?? null,
        items: {
          create: [{ description: 'Acompte', quantity: 1, unitPrice: data.amount, total: data.amount }],
        },
      },
    });
    await validateInTx(tx, deposit.id, processedById);
    await recordPaymentInTx(tx, deposit.id, {
      amount: data.amount, method: data.method, accountId: data.accountId, reference: data.reference,
    }, processedById, processedByRole);
    return deposit.id;
  });
  return getById(id);
}

// Base de calcul des remises en pourcentage : somme des lignes à total positif (chambres +
// suppléments + charges manuelles positives). Les remises elles-mêmes en sont exclues — plusieurs
// remises % portent donc toutes sur le même montant brut, sans cumul en cascade.
function positiveBaseOf(items: { total: number }[]): number {
  return items.reduce((s, i) => (i.total > 0 ? s + i.total : s), 0);
}

// Resynchronise la facture STANDARD d'une réservation sur son état actuel (chambres/suppléments),
// appelée par booking.service.ts après toute mutation qui touche le montant (reassign,
// add/removeRoom, add/update/removeExtra). La facture suit toujours le séjour, même visée : sur une
// facture visée, la variation passe une écriture correctrice (séjour 706000, remises % 709000, TVA
// 4457000 contre la créance 411000). La TVA suit au taux effectif de la facture.
//
// Lignes MANUAL (dépenses flexibles / remises, voir addManualItem / addDiscount) :
//  - montant figé (`discountRate` null) → conservées telles quelles ;
//  - remise en pourcentage (`discountRate` renseigné) → `total` recalculé sur la base du moment.
// Seules les lignes de séjour (`source: BOOKING`, total positif) sont réécrites. Les déductions
// d'acompte des anciennes factures portent `source: BOOKING` avec un total négatif : jamais touchées.
export async function syncInvoiceWithBooking(tx: PrismaOrTx, bookingId: string): Promise<void> {
  const invoice = await tx.invoice.findFirst({ where: { bookingId, kind: 'STANDARD' }, orderBy: { issuedAt: 'desc' } });
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
  if (!booking || booking.status === 'CANCELLED') return;

  const bookingItems    = buildInvoiceItemsFromBooking(booking);
  const bookingSubtotal = bookingItems.reduce((s, i) => s + i.total, 0);

  const items        = await tx.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
  const stayLines    = items.filter(i => i.source === 'BOOKING' && i.total >= 0);
  const otherFixed   = items.filter(i => !stayLines.includes(i) && i.discountRate === null);
  const pctDiscounts = items.filter(i => i.discountRate !== null);

  const oldBookingSubtotal = stayLines.reduce((s, i) => s + i.total, 0);
  const oldPctTotal        = pctDiscounts.reduce((s, i) => s + i.total, 0);
  const otherFixedSubtotal = otherFixed.reduce((s, i) => s + i.total, 0);

  // La base des remises % : lignes réservation + charges manuelles positives, hors remises.
  const pctBase = bookingSubtotal + positiveBaseOf(otherFixed);

  let pctDiscountNew = 0;
  for (const d of pctDiscounts) {
    const newTotal = -Math.round(pctBase * d.discountRate! / 100);
    pctDiscountNew += newTotal;
    if (newTotal !== d.total) {
      await tx.invoiceItem.update({ where: { id: d.id }, data: { unitPrice: newTotal, total: newTotal } });
    }
  }

  const ratio       = await taxRatioOf(tx, invoice.id);
  const deductions  = invoice.totalAmount - invoice.taxAmount - (oldBookingSubtotal + oldPctTotal + otherFixedSubtotal);
  const newSubtotal = bookingSubtotal + pctDiscountNew + otherFixedSubtotal + deductions;
  const applied     = await tx.invoice.aggregate({ where: { appliedToInvoiceId: invoice.id }, _sum: { totalAmount: true } });
  const newTax      = Math.round((newSubtotal + (applied._sum.totalAmount ?? 0)) * ratio);

  await tx.invoiceItem.deleteMany({ where: { id: { in: stayLines.map(i => i.id) } } });
  await tx.invoice.update({
    where: { id: invoice.id },
    data:  { totalAmount: newSubtotal + newTax, taxAmount: newTax, items: { create: bookingItems } },
  });

  if (!invoice.validatedAt) return;
  const changes: [string, number][] = [
    ['706000', bookingSubtotal - oldBookingSubtotal],
    ['709000', pctDiscountNew - oldPctTotal],
    ['4457000', newTax - invoice.taxAmount],
  ];
  const delta = changes.reduce((s, [, amount]) => s + amount, 0);
  if (changes.every(([, amount]) => amount === 0)) return;
  await ledgerService.postEntry({
    source:           'INVOICE',
    relatedInvoiceId: invoice.id,
    memo:             `Séjour modifié — facture ${invoice.number}`,
    lines: [
      ...(delta > 0 ? [{ accountCode: '411000', debit: delta }] : delta < 0 ? [{ accountCode: '411000', credit: -delta }] : []),
      ...changes.filter(([, amount]) => amount !== 0).map(([accountCode, amount]) =>
        amount > 0 ? { accountCode, credit: amount } : { accountCode, debit: -amount }),
    ],
  }, tx);
  await syncDocumentAndRelated(tx, invoice.id);
  await resyncCheckoutPaymentStatus(invoice.bookingId, tx);
}

// Vise un brouillon : lui assigne son numéro définitif (séquence propre à son `kind`), fixe
// `issuedAt`/`validatedAt` à maintenant (la date d'émission légale EST la date du visa, pas celle
// de préparation du brouillon), et poste l'écriture comptable correspondante — seul et unique
// moment où un acompte, une facture ou un avoir touche le grand livre. Au-delà, le document est
// figé : `syncInvoiceWithBooking` l'ignorera désormais.
export async function validateInvoice(id: string, actingUserId?: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, select: { kind: true } });
    if (!invoice) throw new NotFoundError('Facture');
    // Anciens brouillons d'acompte (avant l'encaissement en un geste) : à supprimer puis ré-encaisser.
    if (invoice.kind === 'DEPOSIT') {
      throw new ConflictError('Un acompte s’émet au moment de l’encaissement : supprimez ce brouillon et encaissez l’acompte.');
    }
    await validateInTx(tx, id, actingUserId);
    return tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
  });
}

// Acomptes imputables au visa de la facture d'une réservation. Tout acompte de la réservation doit
// être soit entièrement encaissé (imputé), soit annulé : un brouillon ou un acompte impayé ferait
// passer la facture pour soldée alors que l'argent n'a jamais été reçu.
async function depositsToApply(tx: Prisma.TransactionClient, bookingId: string) {
  const deposits = await tx.invoice.findMany({
    where:   { bookingId, kind: 'DEPOSIT', appliedToInvoiceId: null, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    include: { payments: { where: { status: 'COMPLETED' }, select: { amount: true } } },
    orderBy: { validatedAt: 'asc' },
  });
  for (const d of deposits) {
    if (!d.validatedAt) {
      throw new ConflictError('Un brouillon d’acompte existe sur cette réservation : supprimez-le avant de viser la facture.');
    }
    if (d.payments.reduce((s, p) => s + p.amount, 0) < d.totalAmount) {
      throw new ConflictError(`L’acompte ${d.number} n’est pas entièrement encaissé : encaissez-le ou annulez-le avant de viser la facture.`);
    }
  }
  return deposits;
}

export async function validateInTx(tx: Prisma.TransactionClient, id: string, actingUserId?: string): Promise<void> {
  const invoice = await tx.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Facture');
  if (invoice.validatedAt) throw new ConflictError('Cette facture est déjà visée.');

  let deposits: Awaited<ReturnType<typeof depositsToApply>> = [];
  if (invoice.kind === 'STANDARD') {
    await lockBooking(tx, invoice.bookingId);
    deposits = await depositsToApply(tx, invoice.bookingId);
  }

  const number = await generateInvoiceNumber(tx, invoice.kind);
  const now    = new Date();

  await tx.invoice.update({ where: { id }, data: { number, validatedAt: now, issuedAt: now } });

  const subtotal = invoice.totalAmount - invoice.taxAmount;

  if (invoice.kind === 'STANDARD') {
    // Comptabilité d'engagement : la créance et le produit sont constatés au visa, pas à
    // l'encaissement (voir addPayment() pour l'écriture d'encaissement séparée).
    await ledgerService.postEntry({
      source:           'INVOICE',
      relatedInvoiceId: id,
      postedById:       actingUserId,
      memo:             `Facture ${number}`,
      lines: [
        { accountCode: '411000', debit: invoice.totalAmount },
        { accountCode: '706000', credit: subtotal },
        ...(invoice.taxAmount > 0 ? [{ accountCode: '4457000', credit: invoice.taxAmount }] : []),
      ],
    }, tx);

    // Chaque acompte reçu vient en déduction : ligne négative sur la facture + solde du passif
    // 419100 contre la créance qui vient d'être constatée. Rattaché à la facture, il ne sera plus
    // jamais imputé ni crédité séparément.
    if (deposits.length > 0) {
      await tx.invoice.updateMany({ where: { id: { in: deposits.map(d => d.id) } }, data: { appliedToInvoiceId: id } });
      const depositTotal = deposits.reduce((s, d) => s + d.totalAmount, 0);
      await tx.invoiceItem.createMany({
        data: deposits.map(d => ({
          invoiceId:   id,
          description: `Acompte facturé (${d.number})`,
          quantity:    1,
          unitPrice:   -d.totalAmount,
          total:       -d.totalAmount,
          source:      'MANUAL' as const,
        })),
      });
      await tx.invoice.update({ where: { id }, data: { totalAmount: invoice.totalAmount - depositTotal } });
      for (const deposit of deposits) {
        await ledgerService.postEntry({
          source:           'INVOICE',
          relatedInvoiceId: id,
          postedById:       actingUserId,
          memo:             `Acompte ${deposit.number} appliqué à la facture ${number}`,
          lines: [
            { accountCode: '419100', debit: deposit.totalAmount },
            { accountCode: '411000', credit: deposit.totalAmount },
          ],
        }, tx);
      }
    }
  } else if (invoice.kind === 'DEPOSIT') {
    // Encaissé avant la prestation : passif (avances reçues), pas encore du chiffre d'affaires.
    await ledgerService.postEntry({
      source:           'INVOICE',
      relatedInvoiceId: id,
      postedById:       actingUserId,
      memo:             `Acompte ${number}`,
      lines: [
        { accountCode: '411000', debit: invoice.totalAmount },
        { accountCode: '419100', credit: invoice.totalAmount },
      ],
    }, tx);
  } else {
    // CREDIT_NOTE : extourne la contrepartie du document crédité — laquelle dépend de son
    // `kind`. Un avoir sur FACTURE extourne créance/produit/TVA (706000/4457000), comme avant.
    // Un avoir sur ACOMPTE doit éteindre le passif 419100, PAS 706000 : un acompte n'a jamais
    // constaté de revenu (voir la branche DEPOSIT ci-dessus) — y extourner du 706000 fabriquerait
    // un revenu qui n'a jamais existé et laisserait 419100 bloqué au bilan indéfiniment.
    const relatesTo = invoice.relatesToInvoiceId
      ? await tx.invoice.findUnique({ where: { id: invoice.relatesToInvoiceId }, select: { kind: true, totalAmount: true } })
      : null;

    if (relatesTo?.kind === 'DEPOSIT') {
      // L'acompte n'a jamais constaté de revenu : son passif 419100 est soldé EN ENTIER ici.
      // La part remboursée (`invoice.totalAmount`) rouvre la créance client 411000 — payée ensuite
      // par un remboursement enregistré sur cet avoir (voir addPayment, sens inversé pour un
      // CREDIT_NOTE). La part retenue devient un produit (708500, frais d'annulation).
      const refunded = invoice.totalAmount;
      const retained = Math.max(0, relatesTo.totalAmount - refunded);
      if (refunded + retained > 0) {
        await ledgerService.postEntry({
          source:           'CREDIT_NOTE',
          relatedInvoiceId: id,
          postedById:       actingUserId,
          memo:             `Avoir sur acompte ${number}`,
          lines: [
            { accountCode: '419100', debit: refunded + retained },
            ...(refunded > 0 ? [{ accountCode: '411000', credit: refunded } as const] : []),
            ...(retained > 0 ? [{ accountCode: '708500', credit: retained } as const] : []),
          ],
        }, tx);
      }
    } else {
      await ledgerService.postEntry({
        source:           'CREDIT_NOTE',
        relatedInvoiceId: id,
        postedById:       actingUserId,
        memo:             `Avoir sur facture ${number}`,
        lines: [
          ...(subtotal > 0 ? [{ accountCode: '706000', debit: subtotal } as const] : []),
          ...(invoice.taxAmount > 0 ? [{ accountCode: '4457000', debit: invoice.taxAmount } as const] : []),
          { accountCode: '411000', credit: invoice.totalAmount },
        ],
      }, tx);
      // Annulation : la part retenue n'est plus du chiffre d'affaires séjour mais des frais
      // d'annulation. Sa TVA reste collectée.
      if (invoice.retainedAmount > 0) {
        await ledgerService.postEntry({
          source:           'CREDIT_NOTE',
          relatedInvoiceId: id,
          postedById:       actingUserId,
          memo:             `Frais d'annulation retenus — avoir ${number}`,
          lines: [
            { accountCode: '706000', debit: invoice.retainedAmount },
            { accountCode: '708500', credit: invoice.retainedAmount },
          ],
        }, tx);
      }
    }
  }

  await syncDocumentAndRelated(tx, id);
}

export async function update(id: string, data: UpdateInvoiceInput) {
  // Modification du montant : réservée à un brouillon d'ACOMPTE. Une facture STANDARD tient son
  // montant de la réservation ; un document visé est un fait comptable figé. On réécrit la ligne
  // unique de l'acompte pour qu'elle reste cohérente avec le total.
  if (data.amount !== undefined) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError('Facture');
    if (invoice.kind !== 'DEPOSIT' || invoice.validatedAt) {
      throw new ConflictError("Le montant ne peut être modifié que sur un brouillon d'acompte.");
    }
    return prisma.invoice.update({
      where: { id },
      data: {
        totalAmount: data.amount,
        ...(data.notes !== undefined && { notes: data.notes }),
        items: {
          deleteMany: {},
          create: [{ description: 'Acompte', quantity: 1, unitPrice: data.amount, total: data.amount }],
        },
      },
      include: invoiceInclude,
    });
  }

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
  // la taxe) ET, sur une facture visée, l'écriture 4457000 TVA collectée — sinon la facture affichée
  // diverge du grand livre. Un brouillon n'a aucune écriture à ajuster.
  const newTaxAmount = data.taxAmount;
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError('Facture');
    if (invoice.status === 'CANCELLED') throw new ConflictError('Cette facture est annulée, elle ne peut plus être modifiée.');

    const delta = newTaxAmount - invoice.taxAmount;
    await tx.invoice.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.dueAt !== undefined && { dueAt: data.dueAt ? new Date(data.dueAt) : null }),
        taxAmount:   newTaxAmount,
        totalAmount: invoice.totalAmount + delta,
      },
    });

    if (delta !== 0 && invoice.validatedAt) {
      await ledgerService.postEntry({
        source:           'INVOICE',
        relatedInvoiceId: id,
        memo:             `Ajustement TVA facture ${invoice.number}`,
        lines: delta > 0
          ? [{ accountCode: '411000', debit: delta }, { accountCode: '4457000', credit: delta }]
          : [{ accountCode: '4457000', debit: -delta }, { accountCode: '411000', credit: -delta }],
      }, tx);
      await syncDocumentAndRelated(tx, id);
      await resyncCheckoutPaymentStatus(invoice.bookingId, tx);
    }
    return tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
  });
}

export type CancelInvoiceResult =
  | { deleted: true }
  | { deleted: false; creditNote: Awaited<ReturnType<typeof getById>> };

// Annule une facture. Deux cas bien distincts :
//  - jamais visée (brouillon) : rien n'a jamais existé comptablement, on la supprime purement,
//    aucun document produit ;
//  - déjà visée : c'est un fait comptable réel, on ne la modifie jamais en place — un avoir en
//    BROUILLON est créé (`relatesToInvoiceId` pointe vers elle), pour `refundRatePercent` % de son
//    montant (défaut `DEFAULT_CANCELLATION_REFUND_RATE`, le reste reste acquis comme frais
//    d'annulation). Le personnel doit encore VISER cet avoir pour qu'il produise ses effets
//    comptables — cohérent avec la règle « rien ne touche le grand livre sans visa explicite », et
//    ça laisse une chance d'ajuster le taux au cas par cas avant validation.
// L'argent déjà réellement encaissé n'est pas touché ici — un remboursement de paiement passe par
// voidPayment(), pas par ce chemin (voir la limite documentée : voidPayment n'annule qu'un paiement
// entier, pas un montant partiel).
export async function cancelInvoice(
  id: string,
  cancelledById?: string,
  client: PrismaOrTx = prisma,
  refundRatePercent: number = DEFAULT_CANCELLATION_REFUND_RATE,
): Promise<CancelInvoiceResult> {
  const run = async (tx: PrismaOrTx): Promise<CancelInvoiceResult> => {
    const invoice = await tx.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError('Facture');
    if (invoice.status === 'CANCELLED') throw new ConflictError('Cette facture est déjà annulée.');

    if (!invoice.validatedAt) {
      await tx.invoice.delete({ where: { id } });
      return { deleted: true };
    }
    if (invoice.kind === 'CREDIT_NOTE') {
      throw new ConflictError('Un avoir visé ne s’annule pas.');
    }
    if (invoice.appliedToInvoiceId) {
      throw new ConflictError('Cet acompte est imputé sur la facture de la réservation : c’est elle qu’il faut annuler.');
    }

    // Une facture dont des acomptes ont été déduits porte un net à payer ; l'annulation porte sur
    // le séjour entier (net + acomptes imputés), l'argent des acomptes faisant partie de la facture.
    const applied = await tx.invoice.aggregate({ where: { appliedToInvoiceId: id }, _sum: { totalAmount: true } });
    const credits = await tx.invoice.aggregate({
      where: { relatesToInvoiceId: id, kind: 'CREDIT_NOTE' },
      _sum:  { totalAmount: true, taxAmount: true },
    });
    const base    = invoice.totalAmount + (applied._sum.totalAmount ?? 0) - (credits._sum.totalAmount ?? 0);
    const baseTax = invoice.taxAmount - (credits._sum.taxAmount ?? 0);
    if (base <= 0) throw new ConflictError('Cette facture est déjà entièrement créditée par des avoirs.');

    let refundAmount = Math.round(base * refundRatePercent / 100);
    // Un acompte ne retient de frais que sur l'argent réellement reçu : annuler un acompte dont le
    // paiement a été annulé ne doit pas créer une dette de frais pour le client.
    if (invoice.kind === 'DEPOSIT') {
      refundAmount = Math.max(refundAmount, base - await collectedOn(tx, id));
    }
    const refundTax = Math.round(baseTax * refundRatePercent / 100);
    // Frais d'annulation HT retenus sur une facture, reclassés en 708500 au visa de l'avoir. Un
    // acompte n'a jamais été du chiffre d'affaires : sa part retenue va déjà en 708500.
    const retainedAmount = invoice.kind === 'STANDARD'
      ? Math.max(0, (base - refundAmount) - (baseTax - refundTax))
      : 0;

    const creditNote = await tx.invoice.create({
      data: {
        kind:               'CREDIT_NOTE',
        number:             null,
        bookingId:          invoice.bookingId,
        guestId:            invoice.guestId,
        issuedById:         cancelledById,
        relatesToInvoiceId: invoice.id,
        totalAmount:        refundAmount,
        taxAmount:          refundTax,
        retainedAmount,
        notes:              `Annulation — ${refundAmount.toLocaleString('fr-FR')} Ar crédités, ${(base - refundAmount).toLocaleString('fr-FR')} Ar retenus comme frais d'annulation.`,
        items: {
          create: [{
            description: `Avoir sur annulation — facture ${invoice.number}`,
            quantity:    1,
            unitPrice:   refundAmount,
            total:       refundAmount,
            source:      'MANUAL',
          }],
        },
      },
    });

    await tx.invoice.update({ where: { id }, data: { status: 'CANCELLED' } });

    const withDetails = await tx.invoice.findUnique({ where: { id: creditNote.id }, include: invoiceInclude });
    return { deleted: false, creditNote: withDetails! };
  };

  return client === prisma ? prisma.$transaction(run) : run(client);
}

// Appelée depuis booking.service.ts au moment où une réservation passe en CANCELLED : résout
// TOUTES les factures non-terminales de la réservation (une réservation peut désormais porter un
// acompte ET une facture simultanément) et applique à chacune la logique brouillon/visée
// ci-dessus. Ne touche pas les avoirs déjà émis (rien à "annuler" une deuxième fois), ni les
// acomptes imputés : l'avoir de la facture les couvre déjà, un second avoir créditerait deux fois
// le même argent.
export async function cancelInvoiceForBooking(
  bookingId: string,
  cancelledById?: string,
  client: PrismaOrTx = prisma,
  refundRatePercent?: number,
): Promise<CancelInvoiceResult[]> {
  const invoices = await client.invoice.findMany({
    where: { bookingId, kind: { not: 'CREDIT_NOTE' }, appliedToInvoiceId: null, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
  });
  const results: CancelInvoiceResult[] = [];
  for (const invoice of invoices) {
    results.push(await cancelInvoice(invoice.id, cancelledById, client, refundRatePercent));
  }
  return results;
}

// Suppression sèche d'un brouillon jamais visé : aucune écriture n'a été posée, aucun numéro
// consommé, rien à extourner. Une facture visée n'est jamais supprimée — elle s'annule par un avoir
// (voir cancelInvoice).
export async function deleteDraftInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { validatedAt: true } });
  if (!invoice) throw new NotFoundError('Facture');
  if (invoice.validatedAt) {
    throw new ConflictError("Cette facture est visée : elle ne peut plus être supprimée, seul un avoir peut l'annuler.");
  }
  await prisma.invoice.delete({ where: { id } });
}

// Enregistre un mouvement d'argent lié à un document visé. Deux sens :
//  - facture / acompte : encaissement — l'argent entre dans un compte de trésorerie, la créance
//    411000 diminue, la lifetimeValue du client augmente ;
//  - avoir (CREDIT_NOTE) : remboursement — l'argent sort du compte choisi, la créance rouverte au
//    visa de l'avoir (411000 crédité) est soldée, la lifetimeValue diminue. Le paiement d'origine
//    de la facture/acompte crédité n'est jamais touché (il reste un fait historique).
// L'argent ne peut atterrir que sur un compte de trésorerie actif explicitement associé au moyen de
// paiement (ex. Mvola → compte Mvola). Un moyen sans compte dédié (carte, en ligne…) est refusé :
// associer d'abord un compte à ce moyen depuis l'écran Comptes.
async function assertPaymentAccount(tx: Prisma.TransactionClient, accountId: string, method: PaymentMethod): Promise<void> {
  const account = await tx.ledgerAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new NotFoundError('Compte de trésorerie');
  if (!account.isCashAccount || !account.isActive) {
    throw new ConflictError("Ce compte n'est pas un compte de trésorerie actif : il ne peut pas recevoir de paiement.");
  }
  if (!account.allowedMethods.includes(method)) {
    throw new ConflictError("Ce compte n'accepte pas ce moyen de paiement.");
  }
}

export async function addPayment(invoiceId: string, data: PaymentInput, processedById: string, processedByRole?: string) {
  if (processedByRole) {
    // Le compte de trésorerie qui reçoit (ou verse) le mouvement doit être accessible à l'opérateur.
    await assertCanViewCashAccount(processedByRole, data.accountId);
  }
  // Enregistrement du paiement + resynchronisation du statut de la facture dans une seule
  // transaction : évite qu'une facture reste dans un statut périmé si le process meurt entre les deux.
  return prisma.$transaction(async (tx) => {
    await recordPaymentInTx(tx, invoiceId, data, processedById, processedByRole);
    return tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  });
}

// L'encaissement d'un acompte ne confirme jamais une demande du site : le personnel la confirme
// lui-même (POST /website-requests/:id/confirm), voir getDepositStatus.
async function recordPaymentInTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  data: PaymentInput,
  processedById: string,
  processedByRole?: string,
): Promise<void> {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Facture');
  if (!invoice.validatedAt) {
    throw new ConflictError('Ce document doit être visé avant d\'enregistrer un mouvement.');
  }
  if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
    throw new ConflictError('Ce document ne peut plus recevoir de mouvement.');
  }
  if (invoice.appliedToInvoiceId) {
    throw new ConflictError('Cet acompte est imputé sur la facture de la réservation : enregistrez le paiement sur la facture.');
  }

  await assertPaymentAccount(tx, data.accountId, data.method);

  const isRefund = invoice.kind === 'CREDIT_NOTE';

  if (!isRefund) {
    // Trop-perçu (le client verse plus que le reste dû) : refusé sauf permission explicite. Accepté,
    // l'excédent reste au crédit du client (411000 créditeur), remboursable via refundOverpayment.
    const credits = await tx.invoice.aggregate({
      where: { relatesToInvoiceId: invoiceId, kind: 'CREDIT_NOTE', validatedAt: { not: null } },
      _sum:  { totalAmount: true },
    });
    const remaining = invoice.totalAmount - (credits._sum.totalAmount ?? 0) - await sumPayments(tx, { invoiceId });
    if (data.amount > remaining && !(processedByRole && await roleHasPermission(processedByRole, 'invoices.overpay'))) {
      throw new ForbiddenError(`Le paiement dépasse le reste dû (${Math.max(0, remaining).toLocaleString('fr-FR')} Ar).`);
    }
  }

  if (isRefund) {
    const ceiling = await refundableOn(tx, invoice);
    if (data.amount > ceiling) {
      throw new ConflictError(
        ceiling === 0
          ? "Il n'y a rien à rembourser : la part retenue couvre tout ce que le client a payé."
          : `Le remboursement dépasse ce qui reste à rendre au client (${ceiling.toLocaleString('fr-FR')} Ar).`,
      );
    }
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

  // C'est cette écriture, pas la facturation, qui fait bouger le solde "où est l'argent".
  await ledgerService.postEntry({
    source:           'PAYMENT',
    relatedPaymentId: payment.id,
    relatedInvoiceId: invoiceId,
    postedById:       processedById,
    memo:             isRefund
      ? `Remboursement avoir ${invoice.number}`
      : `Encaissement facture ${invoice.number}`,
    lines: isRefund
      ? [
          { accountCode: '411000', debit: data.amount },
          { accountId: data.accountId, credit: data.amount },
        ]
      : [
          { accountId: data.accountId, debit: data.amount },
          { accountCode: '411000', credit: data.amount },
        ],
  }, tx);

  // Suit la valeur cumulée réellement échangée avec le client, au moment où elle l'est.
  await tx.guest.update({
    where: { id: invoice.guestId },
    data:  { lifetimeValue: isRefund ? { decrement: data.amount } : { increment: data.amount } },
  });

  await syncDocumentAndRelated(tx, invoiceId);
  await resyncCheckoutPaymentStatus(invoice.bookingId, tx);
}

// Rend au client ce qu'il a payé en trop sur une facture (ou un acompte non imputé) : paiement
// négatif sur le document, l'argent sort du compte choisi et la créance créditrice 411000 est soldée.
export async function refundOverpayment(invoiceId: string, data: PaymentInput, processedById: string, processedByRole?: string) {
  if (processedByRole) await assertCanViewCashAccount(processedByRole, data.accountId);
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Facture');
    if (!invoice.validatedAt) throw new ConflictError('Ce document doit être visé avant d\'enregistrer un mouvement.');
    if (invoice.kind === 'CREDIT_NOTE') throw new ConflictError('Un avoir se rembourse depuis son propre formulaire de remboursement.');
    if (invoice.appliedToInvoiceId) {
      throw new ConflictError('Cet acompte est imputé sur la facture de la réservation : le trop-perçu se rembourse depuis la facture.');
    }
    await assertPaymentAccount(tx, data.accountId, data.method);

    const balance  = await balanceOf(tx, invoiceId);
    const overpaid = balance?.overpaid ?? 0;
    if (data.amount > overpaid) {
      throw new ConflictError(overpaid === 0
        ? 'Aucun trop-perçu à rembourser sur ce document.'
        : `Le remboursement dépasse le trop-perçu (${overpaid.toLocaleString('fr-FR')} Ar).`);
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId, processedById,
        amount:    -data.amount,
        method:    data.method,
        accountId: data.accountId,
        reference: data.reference ?? null,
        notes:     data.notes ?? 'Remboursement du trop-perçu',
        status:    'COMPLETED',
      },
    });
    await ledgerService.postEntry({
      source:           'PAYMENT',
      relatedPaymentId: payment.id,
      relatedInvoiceId: invoiceId,
      postedById:       processedById,
      memo:             `Remboursement trop-perçu ${invoice.number}`,
      lines: [
        { accountCode: '411000', debit: data.amount },
        { accountId: data.accountId, credit: data.amount },
      ],
    }, tx);
    await tx.guest.update({ where: { id: invoice.guestId }, data: { lifetimeValue: { decrement: data.amount } } });

    await syncDocumentAndRelated(tx, invoiceId);
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
    if (invoice.appliedToInvoiceId) {
      throw new ConflictError('Cet acompte est imputé sur la facture de la réservation : annulez la facture par un avoir pour le rembourser.');
    }

    await tx.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });

    // Argent sorti : remboursement d'un avoir, ou remboursement de trop-perçu (paiement négatif).
    const outflow = invoice.kind === 'CREDIT_NOTE' || payment.amount < 0;
    const amount  = Math.abs(payment.amount);

    // Contre-écriture exacte du mouvement d'origine (voir addPayment / refundOverpayment). Pour un
    // encaissement : l'argent ressort du compte, la créance est rouverte. Pour un remboursement :
    // sens inverse. Jamais de suppression de l'écriture d'origine.
    await ledgerService.postEntry({
      source:           'PAYMENT_VOID',
      relatedPaymentId: payment.id,
      relatedInvoiceId: invoiceId,
      postedById:       voidedById,
      memo:             outflow
        ? `Annulation remboursement — ${invoice.number}`
        : `Annulation paiement — facture ${invoice.number}`,
      lines: outflow
        ? [
            { accountId: payment.accountId, debit: amount },
            { accountCode: '411000', credit: amount },
          ]
        : [
            { accountCode: '411000', debit: amount },
            { accountId: payment.accountId, credit: amount },
          ],
    }, tx);

    // Symétrique de addPayment : on défait l'effet du mouvement annulé sur la valeur cumulée.
    await tx.guest.update({
      where: { id: invoice.guestId },
      data:  { lifetimeValue: outflow ? { increment: amount } : { decrement: amount } },
    });

    await syncDocumentAndRelated(tx, invoiceId);
    await resyncCheckoutPaymentStatus(invoice.bookingId, tx);

    return tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  });
}

// ─── Lignes personnalisées : dépenses flexibles & remises ────────────────────
// Lignes `InvoiceItem.source = MANUAL` ajoutées à la main sur un brouillon de facture (ou de facture
// complémentaire) :
//  - charge libre (casse, service exceptionnel…) → total positif ;
//  - remise en montant fixe → total négatif, `discountRate` null ;
//  - remise en pourcentage → `discountRate` renseigné, total recalculé à chaque resynchronisation.
// Elles échappent à syncInvoiceWithBooking (qui ne réécrit que les lignes BOOKING). Elles restent
// modifiables après le visa : chaque variation passe alors une écriture correctrice. Comptes de
// contrepartie de la créance 411000 : produit 706000 pour une charge, contra-produit 709000 (Rabais,
// remises et ristournes accordés) pour une remise.

type ContraAccount = '706000' | '709000';

// Une ligne à total négatif ou portant un taux de remise est une remise → contra-produit 709000.
function contraAccountFor(line: { total: number; discountRate: number | null }): ContraAccount {
  return line.discountRate !== null || line.total < 0 ? '709000' : '706000';
}

function assertInvoiceItemsEditable(invoice: { kind: InvoiceKind; status: InvoiceStatus }, bookingStatus: BookingStatus): void {
  if (invoice.kind !== 'STANDARD') {
    throw new ConflictError('Seule une facture porte des lignes modifiables.');
  }
  if (invoice.status === 'CANCELLED' || invoice.status === 'REFUNDED') {
    throw new ConflictError('Cette facture est annulée, ses lignes ne peuvent plus être modifiées.');
  }
  if (bookingStatus === 'CLOSED') {
    throw new ConflictError('La réservation est clôturée, sa facture ne peut plus être modifiée.');
  }
}

// Répercute une variation de montant d'une ligne (ajout / modification / suppression) sur le total
// facturé. Sur une facture visée, la variation est un fait nouveau : écriture correctrice créance
// 411000 vs `contra` (706000 ou 709000), TVA inchangée (ajustable via `update`). `delta > 0` = la
// facture augmente.
async function applyInvoiceItemDelta(
  tx: Prisma.TransactionClient,
  invoice: { id: string; number: string | null; totalAmount: number; bookingId: string; validatedAt: Date | null },
  delta: number,
  contra: ContraAccount,
  memo: string,
  postedById: string,
): Promise<void> {
  if (delta !== 0) {
    await tx.invoice.update({ where: { id: invoice.id }, data: { totalAmount: invoice.totalAmount + delta } });
    if (invoice.validatedAt) {
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
  }
  await syncDocumentAndRelated(tx, invoice.id);
  await resyncCheckoutPaymentStatus(invoice.bookingId, tx);
}

async function loadEditableInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { booking: { select: { status: true } }, items: { select: { total: true } } },
  });
  if (!invoice) throw new NotFoundError('Facture');
  assertInvoiceItemsEditable(invoice, invoice.booking.status);
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

