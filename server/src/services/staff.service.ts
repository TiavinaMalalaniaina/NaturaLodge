import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError, ForbiddenError } from '../errors/AppError';
import { roleHasPermission } from '../lib/permissions';
import { StaffInput, StaffUpdateInput } from '../validation/staff.schema';

const select = {
  id: true, username: true, email: true, name: true,
  role: { select: { id: true, name: true } },
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
  // Pré-vérification explicite plutôt que de compter sur `err.meta.target` du P2002 : avec le
  // driver adapter pg utilisé ici, Prisma ne remonte pas le nom de la colonne en conflit
  // ("Unique constraint failed on the (not available)"), impossible de distinguer username/email
  // après coup.
  const [usernameTaken, emailTaken] = await Promise.all([
    prisma.user.findUnique({ where: { username: data.username }, select: { id: true } }),
    data.email ? prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }) : null,
  ]);
  if (usernameTaken) throw new ConflictError("Ce nom d'utilisateur est déjà pris.");
  if (emailTaken) throw new ConflictError('Un compte existe déjà avec cet email.');

  const hashed = await bcrypt.hash(data.password, 12);
  try {
    return await prisma.user.create({ data: { ...data, password: hashed }, select });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Ce nom d\'utilisateur ou cet email est déjà utilisé.');
    }
    throw err;
  }
}

export async function update(id: string, data: StaffUpdateInput, requestingUserRole: string) {
  // Seul un rôle habilité (staff.assign_role, ADMIN par défaut) peut modifier le rôle ou le statut
  // d'un compte — empêche par exemple un MANAGER de s'auto-promouvoir. Vérifié via le système de
  // permissions plutôt qu'un `requestingUserRole !== 'ADMIN'` en dur : un rôle est renommable, un
  // littéral figé casserait silencieusement dès qu'"ADMIN" change de nom.
  if (data.roleId !== undefined || data.status !== undefined) {
    if (!(await roleHasPermission(requestingUserRole, 'staff.assign_role'))) {
      throw new ForbiddenError('Vous n\'avez pas le droit de modifier le rôle ou le statut d\'un membre du personnel');
    }
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
