import { prisma } from '../lib/prisma';
import { NotFoundError } from '../errors/AppError';
import { ExtraInput } from '../validation/extra.schema';

export function list() {
  return prisma.extra.findMany({ orderBy: { name: 'asc' } });
}

export async function getById(id: string) {
  const extra = await prisma.extra.findUnique({ where: { id } });
  if (!extra) throw new NotFoundError('Supplément');
  return extra;
}

export function create(data: ExtraInput) {
  return prisma.extra.create({ data });
}

export function update(id: string, data: Partial<ExtraInput>) {
  return prisma.extra.update({ where: { id }, data });
}

// Suppression douce : un supplément déjà utilisé sur une réservation (même passée) garde sa ligne
// en base pour ne pas casser l'historique des factures — on le désactive juste, il disparaît des
// choix pour de nouvelles lignes mais reste visible/réactivable dans le catalogue.
export async function remove(id: string) {
  await prisma.extra.update({ where: { id }, data: { isActive: false } });
}
