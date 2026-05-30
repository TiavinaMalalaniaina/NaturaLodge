import { Router, Response } from 'express';
import { z } from 'zod';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

export const invoicesRouter = Router();
invoicesRouter.use(authenticate);

// ─── Includes ────────────────────────────────────────────────────

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
              roomType: { select: { name: true, category: true } },
            },
          },
        },
      },
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────

async function generateInvoiceNumber(): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await prisma.invoice.count();
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

async function syncInvoiceStatus(invoiceId: string): Promise<void> {
  const invoice  = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { totalAmount: true } });
  if (!invoice) return;

  const payments = await prisma.payment.findMany({
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

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status, paidAt } });
}

// ─── Routes ───────────────────────────────────────────────────────

// GET /invoices  ──  liste paginée
invoicesRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { bookingId, guestId, status, page = '1', limit = '20' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {
    ...(bookingId ? { bookingId: String(bookingId) }             : {}),
    ...(guestId   ? { guestId:   String(guestId) }               : {}),
    ...(status    ? { status: String(status).toUpperCase() as InvoiceStatus } : {}),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({ where, include: invoiceInclude, orderBy: { issuedAt: 'desc' }, skip, take: Number(limit) }),
    prisma.invoice.count({ where }),
  ]);

  res.json({
    data: invoices,
    meta: {
      total, page: Number(page), limit: Number(limit),
      totalPages:  Math.ceil(total / Number(limit)),
      hasNextPage: Number(page) * Number(limit) < total,
      hasPrevPage: Number(page) > 1,
    },
  });
});

// GET /invoices/booking/:bookingId  ──  facture d'une réservation
invoicesRouter.get('/booking/:bookingId', async (req: AuthRequest, res: Response): Promise<void> => {
  const invoice = await prisma.invoice.findFirst({
    where: { bookingId: req.params.bookingId },
    include: invoiceInclude,
    orderBy: { issuedAt: 'desc' },
  });
  if (!invoice) { res.status(404).json({ error: 'Aucune facture pour cette réservation' }); return; }
  res.json(invoice);
});

// GET /invoices/:id
invoicesRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: invoiceInclude });
  if (!invoice) { res.status(404).json({ error: 'Facture introuvable' }); return; }
  res.json(invoice);
});

// POST /invoices/generate  ──  générer depuis une réservation (idempotent)
invoicesRouter.post('/generate', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({
    bookingId: z.string().min(1),
    taxRate:   z.number().min(0).max(100).default(0),
    notes:     z.string().optional(),
    dueAt:     z.string().datetime().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { bookingId, taxRate, notes, dueAt } = parsed.data;

  // Vérifier si une facture existe déjà
  const existing = await prisma.invoice.findFirst({ where: { bookingId }, include: invoiceInclude });
  if (existing) { res.json(existing); return; }

  // Récupérer la réservation avec les chambres
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: true,
      rooms: {
        include: {
          room: { include: { roomType: true } },
        },
      },
    },
  });
  if (!booking) { res.status(404).json({ error: 'Réservation introuvable' }); return; }

  // Construire les lignes de facture
  const items = booking.rooms.map(br => {
    const nights    = Math.max(1, Math.round(
      (br.departure.getTime() - br.arrival.getTime()) / 86_400_000
    ));
    const unitPrice = br.roomRate;
    const total     = unitPrice * nights;
    return {
      description: `${br.room.roomType.name} — Chambre ${br.room.number}`,
      quantity:    nights,
      unitPrice,
      total,
    };
  });

  const subtotal   = items.reduce((s, i) => s + i.total, 0);
  const taxAmount  = Math.round(subtotal * taxRate / 100);
  const totalAmount = subtotal + taxAmount;
  const number     = await generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      number,
      bookingId,
      guestId:     booking.guestId,
      issuedById:  req.user!.id,
      totalAmount,
      taxAmount,
      notes:       notes ?? null,
      dueAt:       dueAt ? new Date(dueAt) : null,
      items:       { create: items },
    },
    include: invoiceInclude,
  });

  res.status(201).json(invoice);
});

// PATCH /invoices/:id  ──  modifier notes / dueAt / taxAmount
invoicesRouter.patch('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({
    notes:      z.string().optional(),
    dueAt:      z.string().datetime().nullable().optional(),
    taxAmount:  z.number().int().min(0).optional(),
    status:     z.nativeEnum(InvoiceStatus).optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const invoice = await prisma.invoice.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.data.notes     !== undefined && { notes: parsed.data.notes }),
      ...(parsed.data.dueAt     !== undefined && { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null }),
      ...(parsed.data.taxAmount !== undefined && { taxAmount: parsed.data.taxAmount }),
      ...(parsed.data.status    !== undefined && { status: parsed.data.status }),
    },
    include: invoiceInclude,
  });
  res.json(invoice);
});

// POST /invoices/:id/payments  ──  enregistrer un paiement
invoicesRouter.post('/:id/payments', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({
    amount:    z.number().int().positive(),
    method:    z.nativeEnum(PaymentMethod),
    reference: z.string().optional(),
    notes:     z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) { res.status(404).json({ error: 'Facture introuvable' }); return; }
  if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
    res.status(409).json({ error: 'Cette facture ne peut plus recevoir de paiement.' });
    return;
  }

  await prisma.payment.create({
    data: {
      invoiceId:     req.params.id,
      processedById: req.user!.id,
      amount:        parsed.data.amount,
      method:        parsed.data.method,
      reference:     parsed.data.reference ?? null,
      notes:         parsed.data.notes ?? null,
      status:        'COMPLETED',
    },
  });

  await syncInvoiceStatus(req.params.id);

  const updated = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: invoiceInclude });
  res.status(201).json(updated);
});

// DELETE /invoices/:id/payments/:paymentId  ──  annuler un paiement
invoicesRouter.delete('/:id/payments/:paymentId', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.payment.update({
    where: { id: req.params.paymentId },
    data:  { status: 'REFUNDED' },
  });
  await syncInvoiceStatus(req.params.id);
  const updated = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: invoiceInclude });
  res.json(updated);
});
