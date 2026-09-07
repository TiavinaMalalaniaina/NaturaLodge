import { BookingStatus, ExtraPricing, InvoiceKind, InvoiceStatus, Prisma } from '@prisma/client';
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
  relatesToInvoice: {
    select: {
      id: true, number: true, kind: true,
      payments: { where: { status: 'COMPLETED' as const }, select: { amount: true } },
    },
  },
  creditedBy:        { select: { id: true, number: true, kind: true, totalAmount: true, validatedAt: true } },
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

// Préfixe de numérotation par type de document — chaque type a sa propre séquence, comptée
// uniquement sur les documents déjà visés (`number` non nul) pour ne jamais laisser de trou dans
// l'ordre d'émission réel : un brouillon abandonné (jamais visé) ne consomme aucun numéro.
const NUMBER_PREFIX: Record<InvoiceKind, string> = {
  STANDARD:    'INV',
  DEPOSIT:     'ACO',
  CREDIT_NOTE: 'AVO',
};

async function generateInvoiceNumber(client: PrismaOrTx, kind: InvoiceKind): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await client.invoice.count({ where: { kind, number: { not: null } } });
  return `${NUMBER_PREFIX[kind]}-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function syncInvoiceStatus(invoiceId: string, client: PrismaOrTx = prisma): Promise<void> {
  const invoice = await client.invoice.findUnique({ where: { id: invoiceId }, select: { totalAmount: true, status: true } });
  if (!invoice) return;
  // CANCELLED/REFUNDED sont des états terminaux posés explicitement par cancelInvoice() : ne jamais
  // les recalculer à partir des seuls paiements. Sans ce garde, un voidPayment() postérieur sur la
  // facture annulée la ferait repasser en PENDING (« non payée » alors qu'elle est annulée).
  if (invoice.status === 'CANCELLED' || invoice.status === 'REFUNDED') return;

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

// « Acomptes en cours » : acomptes visés dont le montant n'a pas encore été absorbé par la facture
// STANDARD de la réservation — sert à tracer/justifier le solde du compte 419100 au bilan,
// réservation par réservation (sinon ce n'est qu'une somme opaque). Un acompte est absorbé au
// moment où la facture STANDARD de la réservation est visée (voir validateInvoice, qui solde
// TOUS les acomptes déjà visés à ce moment-là) : un acompte reste donc "en cours" tant qu'aucune
// facture STANDARD n'a été visée après lui — pas de champ dédié à maintenir, juste une comparaison
// de dates de visa.
export async function getOutstandingDeposits() {
  const deposits = await prisma.invoice.findMany({
    where: { kind: 'DEPOSIT', validatedAt: { not: null } },
    select: {
      id: true, number: true, totalAmount: true, validatedAt: true, bookingId: true,
      guest: { select: { id: true, name: true } },
    },
    orderBy: { validatedAt: 'asc' },
  });
  if (deposits.length === 0) return [];

  const bookingIds = [...new Set(deposits.map(d => d.bookingId))];
  const standardInvoices = await prisma.invoice.findMany({
    where: { bookingId: { in: bookingIds }, kind: 'STANDARD' },
    select: { bookingId: true, validatedAt: true },
  });
  const standardValidatedAtByBooking = new Map(standardInvoices.map(s => [s.bookingId, s.validatedAt]));

  return deposits.filter(d => {
    const standardValidatedAt = standardValidatedAtByBooking.get(d.bookingId);
    return !standardValidatedAt || standardValidatedAt < d.validatedAt!;
  });
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
        throw new ConflictError('La facture de cette réservation est déjà visée : toute correction passe désormais par un avoir.');
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

// Crée le brouillon d'une facture d'acompte pour une réservation. Comme toute facture, elle ne
// touche le grand livre qu'à son visa (voir validateInvoice) — jusque-là, montant et notes restent
// librement modifiables (via `update`).
export async function createDeposit(bookingId: string, amount: number, notes: string | undefined, issuedById: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new NotFoundError('Réservation');

  return prisma.invoice.create({
    data: {
      kind:       'DEPOSIT',
      number:     null,
      bookingId,
      guestId:    booking.guestId,
      issuedById,
      totalAmount: amount,
      taxAmount:   0,
      notes:       notes ?? null,
      items: {
        create: [{ description: 'Acompte', quantity: 1, unitPrice: amount, total: amount }],
      },
    },
    include: invoiceInclude,
  });
}

// Base de calcul des remises en pourcentage : somme des lignes à total positif (chambres +
// suppléments + charges manuelles positives). Les remises elles-mêmes en sont exclues — plusieurs
// remises % portent donc toutes sur le même montant brut, sans cumul en cascade.
function positiveBaseOf(items: { total: number }[]): number {
  return items.reduce((s, i) => (i.total > 0 ? s + i.total : s), 0);
}

// Resynchronise les lignes et le total du brouillon STANDARD d'une réservation sur son état actuel
// (chambres/suppléments), appelée par booking.service.ts après toute mutation qui touche le
// montant (reassign, add/removeRoom, add/update/removeExtra). Ne touche jamais une facture déjà
// visée (`validatedAt` non nul) — une fois au grand livre, elle est figée ; toute correction passe
// par un avoir, jamais par une resynchronisation silencieuse. Pas d'écriture comptable ici : un
// brouillon n'existe pas encore au grand livre (contrairement à l'ancien modèle où chaque invoice
// était postée dès sa création), il n'y a donc jamais rien à corriger.
//
// Lignes MANUAL (dépenses flexibles / remises, voir addManualItem / addDiscount) :
//  - montant figé (`discountRate` null) → conservées telles quelles ;
//  - remise en pourcentage (`discountRate` renseigné) → `total` recalculé sur la base du moment.
// Seules les lignes `source: BOOKING` sont réécrites.
export async function syncInvoiceWithBooking(tx: PrismaOrTx, bookingId: string): Promise<void> {
  const invoice = await tx.invoice.findFirst({ where: { bookingId, kind: 'STANDARD' }, orderBy: { issuedAt: 'desc' } });
  if (!invoice || invoice.validatedAt) return;

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

  let pctDiscountNew = 0;
  for (const d of pctDiscounts) {
    const newTotal = -Math.round(pctBase * d.discountRate! / 100);
    pctDiscountNew += newTotal;
    if (newTotal !== d.total) {
      await tx.invoiceItem.update({ where: { id: d.id }, data: { unitPrice: newTotal, total: newTotal } });
    }
  }

  const newSubtotal = bookingSubtotal + fixedManualSubtotal + pctDiscountNew;

  await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id, source: 'BOOKING' } });
  await tx.invoice.update({
    where: { id: invoice.id },
    data:  { totalAmount: newSubtotal + invoice.taxAmount, items: { create: bookingItems } },
  });
}

// Vise un brouillon : lui assigne son numéro définitif (séquence propre à son `kind`), fixe
// `issuedAt`/`validatedAt` à maintenant (la date d'émission légale EST la date du visa, pas celle
// de préparation du brouillon), et poste l'écriture comptable correspondante — seul et unique
// moment où un acompte, une facture ou un avoir touche le grand livre. Au-delà, le document est
// figé : `syncInvoiceWithBooking` l'ignorera désormais.
export async function validateInvoice(id: string, actingUserId?: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError('Facture');
    if (invoice.validatedAt) throw new ConflictError('Cette facture est déjà visée.');

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

      // Tout acompte déjà visé pour cette réservation vient en déduction : ligne négative sur la
      // facture + solde du passif 419100 contre la créance qui vient d'être constatée.
      const deposits = await tx.invoice.findMany({
        where: { bookingId: invoice.bookingId, kind: 'DEPOSIT', validatedAt: { not: null } },
      });
      if (deposits.length > 0) {
        const depositTotal = deposits.reduce((s, d) => s + d.totalAmount, 0);
        await tx.invoiceItem.createMany({
          data: deposits.map(d => ({
            invoiceId:   id,
            description: `Acompte facturé (${d.number})`,
            quantity:    1,
            unitPrice:   -d.totalAmount,
            total:       -d.totalAmount,
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
      }
    }

    await syncInvoiceStatus(id, tx);
    return tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
  });
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
  // la taxe) ET l'écriture 4457000 TVA collectée, sinon la facture affichée diverge du grand livre
  // (voir totalAmount = subtotal + taxAmount posé au visa). Une facture encore brouillon n'a
  // aucune écriture à ajuster : rien n'est posé tant qu'elle n'est pas visée.
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

    if (delta !== 0 && invoice.validatedAt) {
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

    const refundAmount = Math.round(invoice.totalAmount * refundRatePercent / 100);
    const refundTax     = invoice.totalAmount > 0 ? Math.round(invoice.taxAmount * refundRatePercent / 100) : 0;

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
        notes:              `Annulation — ${refundRatePercent}% du montant facturé retourné, ${100 - refundRatePercent}% retenu comme frais d'annulation.`,
        items: {
          create: [{
            description: `Avoir sur annulation — facture ${invoice.number}`,
            quantity:    1,
            unitPrice:   refundAmount,
            total:       refundAmount,
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
// ci-dessus. Ne touche pas les avoirs déjà émis (rien à "annuler" une deuxième fois).
export async function cancelInvoiceForBooking(
  bookingId: string,
  cancelledById?: string,
  client: PrismaOrTx = prisma,
  refundRatePercent?: number,
): Promise<CancelInvoiceResult[]> {
  const invoices = await client.invoice.findMany({
    where: { bookingId, kind: { not: 'CREDIT_NOTE' }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
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
export async function addPayment(invoiceId: string, data: PaymentInput, processedById: string, processedByRole?: string) {
  if (processedByRole) {
    // Le compte de trésorerie qui reçoit (ou verse) le mouvement doit être accessible à l'opérateur.
    await assertCanViewCashAccount(processedByRole, data.accountId);
  }
  // Enregistrement du paiement + resynchronisation du statut de la facture dans une seule
  // transaction : évite qu'une facture reste dans un statut périmé si le process meurt entre les deux.
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Facture');
    if (!invoice.validatedAt) {
      throw new ConflictError('Ce document doit être visé avant d\'enregistrer un mouvement.');
    }
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new ConflictError('Ce document ne peut plus recevoir de mouvement.');
    }

    const isRefund = invoice.kind === 'CREDIT_NOTE';

    if (isRefund) {
      const sumCompleted = async (invId: string) => (await tx.payment.findMany({
        where: { invoiceId: invId, status: 'COMPLETED' }, select: { amount: true },
      })).reduce((s, p) => s + p.amount, 0);

      const alreadyRefunded = await sumCompleted(invoiceId);
      // On ne peut rembourser que ce qui a réellement été encaissé sur le document crédité, et au
      // plus le montant de l'avoir. Sans FK vers le crédité (cas théorique), on retombe sur le
      // montant de l'avoir seul.
      const collectedOnCredited = invoice.relatesToInvoiceId
        ? await sumCompleted(invoice.relatesToInvoiceId)
        : invoice.totalAmount;
      const ceiling = Math.min(invoice.totalAmount, collectedOnCredited);

      if (alreadyRefunded + data.amount > ceiling) {
        throw new ConflictError(
          collectedOnCredited === 0
            ? "Le document d'origine n'a jamais été encaissé : il n'y a rien à rembourser."
            : "Le remboursement dépasse ce qui a été encaissé sur le document d'origine.",
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

    const isRefund = invoice.kind === 'CREDIT_NOTE';

    // Contre-écriture exacte du mouvement d'origine (voir addPayment). Pour un encaissement :
    // l'argent ressort du compte, la créance est rouverte. Pour un remboursement d'avoir : sens
    // inverse. Jamais de suppression de l'écriture d'origine.
    await ledgerService.postEntry({
      source:           'PAYMENT_VOID',
      relatedPaymentId: payment.id,
      relatedInvoiceId: invoiceId,
      postedById:       voidedById,
      memo:             isRefund
        ? `Annulation remboursement — avoir ${invoice.number}`
        : `Annulation paiement — facture ${invoice.number}`,
      lines: isRefund
        ? [
            { accountId: payment.accountId, debit: payment.amount },
            { accountCode: '411000', credit: payment.amount },
          ]
        : [
            { accountCode: '411000', debit: payment.amount },
            { accountId: payment.accountId, credit: payment.amount },
          ],
    }, tx);

    // Symétrique de addPayment : on défait l'effet du mouvement annulé sur la valeur cumulée.
    await tx.guest.update({
      where: { id: invoice.guestId },
      data:  { lifetimeValue: isRefund ? { increment: payment.amount } : { decrement: payment.amount } },
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
  invoice: { id: string; number: string | null; totalAmount: number; bookingId: string; validatedAt: Date | null },
  delta: number,
  contra: ContraAccount,
  memo: string,
  postedById: string,
): Promise<void> {
  if (delta !== 0) {
    await tx.invoice.update({ where: { id: invoice.id }, data: { totalAmount: invoice.totalAmount + delta } });
    // Un brouillon (jamais visé) n'est encore sur aucune ligne du grand livre : rien à corriger.
    // Une fois visée, la ligne ajoutée/modifiée/retirée est un fait nouveau — on poste une écriture
    // correctrice, comme le fait déjà `update()` pour un ajustement de TVA.
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
