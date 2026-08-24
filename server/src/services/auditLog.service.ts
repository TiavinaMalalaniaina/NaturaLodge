import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuditLogQueryParams } from '../validation/auditLog.schema';

export async function list(params: AuditLogQueryParams) {
  const { page, limit, userId, resourceType, dateFrom, dateTo } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {
    ...(userId       ? { userId }       : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(dateFrom || dateTo ? {
      createdAt: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
      },
    } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, skip, take: limit,
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    meta: {
      total, page, limit,
      totalPages:  Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

export async function listResourceTypes(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    where:    { resourceType: { not: null } },
    select:   { resourceType: true },
    distinct: ['resourceType'],
    orderBy:  { resourceType: 'asc' },
  });
  return rows.map(r => r.resourceType!);
}
