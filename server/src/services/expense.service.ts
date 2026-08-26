import { ExpenseCategory, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CreateExpenseInput, ExpenseListParams } from '../validation/expense.schema';
import * as ledgerService from './ledger.service';

// Compte de charge (classe 6) débité selon la catégorie choisie par l'utilisateur — celui-ci ne
// voit jamais de code comptable, juste une catégorie métier.
const EXPENSE_ACCOUNT_CODE: Record<ExpenseCategory, string> = {
  SUPPLIES:    '606100',
  UTILITIES:   '606200',
  MAINTENANCE: '615000',
  MARKETING:   '623000',
  SALARIES:    '641000',
  OTHER:       '628000',
};

const include = {
  paidFrom:   { select: { id: true, code: true, name: true } },
  approvedBy: { select: { id: true, name: true, role: true } },
};

export async function list(params: ExpenseListParams) {
  const { page, limit, category, dateFrom, dateTo } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.ExpenseWhereInput = {
    ...(category ? { category } : {}),
    ...(dateFrom || dateTo ? {
      incurredAt: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
      },
    } : {}),
  };

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({ where, include, orderBy: { incurredAt: 'desc' }, skip, take: limit }),
    prisma.expense.count({ where }),
  ]);

  return {
    data: expenses,
    meta: {
      total, page, limit,
      totalPages:  Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

export async function create(data: CreateExpenseInput, approvedById: string) {
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        category:    data.category,
        amount:      data.amount,
        description: data.description,
        paidFromId:  data.paidFromId,
        approvedById,
        incurredAt:  data.incurredAt ? new Date(data.incurredAt) : undefined,
      },
      include,
    });

    await ledgerService.postEntry({
      source:           'EXPENSE',
      relatedExpenseId: expense.id,
      postedById:       approvedById,
      memo:             data.description,
      lines: [
        { accountCode: EXPENSE_ACCOUNT_CODE[data.category], debit: data.amount },
        { accountId: data.paidFromId, credit: data.amount },
      ],
    }, tx);

    return expense;
  });
}
