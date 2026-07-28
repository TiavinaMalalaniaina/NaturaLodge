import bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError, ForbiddenError } from '../errors/AppError';
import { StaffInput, StaffUpdateInput } from '../validation/staff.schema';

const select = {
  id: true, email: true, name: true, role: true,
  status: true, avatar: true, joinedDate: true, lastLogin: true,
};

export function list() {
  return prisma.user.findMany({ select, orderBy: { name: 'asc' } });
}

export async function getById(id: string) {
  const member = await prisma.user.findUnique({ where: { id }, select });
  if (!member) throw new NotFoundError('Membre');
  return member;
}

export async function create(data: StaffInput) {
  const hashed = await bcrypt.hash(data.password, 12);
  try {
    return await prisma.user.create({ data: { ...data, password: hashed }, select });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Un compte existe déjà avec cet email.');
    }
    throw err;
  }
}

export function update(id: string, data: StaffUpdateInput, requestingUserRole: Role) {
  // Seul un ADMIN peut modifier le rôle ou le statut d'un compte (empêche un MANAGER de s'auto-promouvoir ADMIN).
  if ((data.role !== undefined || data.status !== undefined) && requestingUserRole !== 'ADMIN') {
    throw new ForbiddenError('Seul un administrateur peut modifier le rôle ou le statut');
  }
  return prisma.user.update({ where: { id }, data, select });
}

export async function updatePassword(id: string, password: string): Promise<void> {
  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
}

export async function remove(id: string, requestingUserId: string): Promise<void> {
  if (id === requestingUserId) throw new ConflictError('Impossible de supprimer son propre compte');
  await prisma.user.delete({ where: { id } });
}
