import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ConflictError, NotFoundError } from '../errors/AppError';
import { CreateExpenseInput, ExpenseListParams } from '../validation/expense.schema';
import * as ledgerService from './ledger.service';
import { assertCanPayExpenseFrom } from '../lib/treasuryAccess';

const include = {
  category:   { select: { id: true, name: true } },
  paidFrom:   { select: { id: true, code: true, name: true } },
  approvedBy: { select: { id: true, name: true, role: true } },
};

export async function list(params: ExpenseListParams) {
  const { page, limit, categoryId, dateFrom, dateTo } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.ExpenseWhereInput = {
    ...(categoryId ? { categoryId } : {}),
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

export async function create(data: CreateExpenseInput, approvedById: string, approvedByRole?: string) {
  if (approvedByRole) {
    // Le rôle doit être autorisé à payer une dépense depuis ce compte de trésorerie.
    await assertCanPayExpenseFrom(approvedByRole, data.paidFromId);
  }
  return prisma.$transaction(async (tx) => {
    const category = await tx.expenseCategory.findUnique({ where: { id: data.categoryId } });
    if (!category)          throw new NotFoundError('Catégorie de dépense');
    if (!category.isActive) throw new ConflictError('Cette catégorie de dépense est désactivée.');

    const expense = await tx.expense.create({
      data: {
        categoryId:  data.categoryId,
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
        { accountId: category.accountId, debit: data.amount },
        { accountId: data.paidFromId,    credit: data.amount },
      ],
    }, tx);

    return expense;
  });
}

// ─── Catégories de dépense ───────────────────────────────────────
// Configurables par l'ADMIN (voir permission 'expenses.manage_categories') : chacune débite un
// compte de charge précis à la création d'une dépense — remplace l'ancien enum figé.

export async function listCategories() {
  return prisma.expenseCategory.findMany({
    include: { account: { select: { id: true, code: true, name: true } } },
    orderBy: { name: 'asc' },
  });
}

export type CreateCategoryParams = { name: string; accountId: string };

export async function createCategory(params: CreateCategoryParams) {
  const existing = await prisma.expenseCategory.findUnique({ where: { name: params.name } });
  if (existing) throw new ConflictError(`Une catégorie nommée "${params.name}" existe déjà.`);

  const account = await prisma.ledgerAccount.findUnique({ where: { id: params.accountId } });
  if (!account) throw new NotFoundError('Compte comptable');
  if (account.type !== 'EXPENSE') throw new ConflictError('Une catégorie de dépense doit être liée à un compte de type Charge.');

  return prisma.expenseCategory.create({
    data: params,
    include: { account: { select: { id: true, code: true, name: true } } },
  });
}

export type UpdateCategoryParams = { name?: string; accountId?: string; isActive?: boolean };

export async function updateCategory(id: string, params: UpdateCategoryParams) {
  const category = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!category) throw new NotFoundError('Catégorie de dépense');

  if (params.accountId) {
    const account = await prisma.ledgerAccount.findUnique({ where: { id: params.accountId } });
    if (!account) throw new NotFoundError('Compte comptable');
    if (account.type !== 'EXPENSE') throw new ConflictError('Une catégorie de dépense doit être liée à un compte de type Charge.');
  }

  return prisma.expenseCategory.update({
    where: { id },
    data:  params,
    include: { account: { select: { id: true, code: true, name: true } } },
  });
}
