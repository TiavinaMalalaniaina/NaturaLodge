import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PaymentListParams } from '../validation/payment.schema';

const include = {
  invoice: {
    select: {
      id: true, number: true, bookingId: true,
      guest: { select: { id: true, name: true } },
    },
  },
  processedBy: { select: { id: true, name: true, role: true } },
};

export async function list(params: PaymentListParams) {
  const { page, limit, status, method, guestId, search, dateFrom, dateTo } = params;
  const skip = (page - 1) * limit;

  const invoiceFilter: Prisma.InvoiceWhereInput = {};
  if (guestId) invoiceFilter.guestId = guestId;
  if (search) {
    invoiceFilter.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { guest: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const where: Prisma.PaymentWhereInput = {
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    ...(dateFrom || dateTo ? {
      paidAt: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
      },
    } : {}),
    ...(Object.keys(invoiceFilter).length > 0 ? { invoice: invoiceFilter } : {}),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({ where, include, orderBy: { paidAt: 'desc' }, skip, take: limit }),
    prisma.payment.count({ where }),
  ]);

  return {
    data: payments,
    meta: {
      total, page, limit,
      totalPages:  Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}
