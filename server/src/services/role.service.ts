import { prisma } from '../lib/prisma';
import { ConflictError, NotFoundError } from '../errors/AppError';
import { invalidatePermissionCache } from '../lib/permissions';
import { CreateRoleInput, UpdateRoleInput } from '../validation/role.schema';

export async function list() {
  const roles = await prisma.role.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: 'asc' },
  });
  return roles.map(r => ({ id: r.id, name: r.name, isSystem: r.isSystem, userCount: r._count.users }));
}

export async function create(data: CreateRoleInput) {
  const existing = await prisma.role.findUnique({ where: { name: data.name } });
  if (existing) throw new ConflictError(`Un rôle nommé "${data.name}" existe déjà.`);
  return prisma.role.create({ data: { name: data.name } });
}

// Renommage uniquement — jamais de suppression en v1, et isSystem n'est jamais modifiable ici (les
// 4 rôles historiques restent isSystem même après renommage).
export async function update(id: string, data: UpdateRoleInput) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new NotFoundError('Rôle');

  const existing = await prisma.role.findUnique({ where: { name: data.name } });
  if (existing && existing.id !== id) throw new ConflictError(`Un rôle nommé "${data.name}" existe déjà.`);

  const updated = await prisma.role.update({ where: { id }, data: { name: data.name } });
  // Le cache de permissions est indexé par nom de rôle (voir lib/permissions.ts) : un renommage le
  // rend obsolète immédiatement, pas seulement au prochain changement de la matrice.
  invalidatePermissionCache();
  return updated;
}
