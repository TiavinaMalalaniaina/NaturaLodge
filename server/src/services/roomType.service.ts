import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { RoomTypeInput } from '../validation/roomType.schema';

const include = {
  features: true,
  rooms:    { select: { id: true }, orderBy: { number: 'asc' as const } },
};

export function list() {
  return prisma.roomType.findMany({ include, orderBy: { name: 'asc' } });
}

export async function getById(id: string) {
  const rt = await prisma.roomType.findUnique({ where: { id }, include });
  if (!rt) throw new NotFoundError('Type');
  return rt;
}

export function create(data: RoomTypeInput) {
  const { featureIds, ...rest } = data;
  return prisma.roomType.create({
    data: {
      ...rest,
      features: featureIds ? { connect: featureIds.map(id => ({ id })) } : undefined,
    },
    include,
  });
}

export function update(id: string, data: Partial<RoomTypeInput>) {
  const { featureIds, ...rest } = data;
  return prisma.roomType.update({
    where: { id },
    data: {
      ...rest,
      features: featureIds ? { set: featureIds.map(id => ({ id })) } : undefined,
    },
    include,
  });
}

export async function remove(id: string) {
  const count = await prisma.room.count({ where: { roomTypeId: id } });
  if (count > 0) throw new ConflictError(`Impossible de supprimer : ${count} chambre(s) utilisent ce type.`);
  await prisma.roomType.delete({ where: { id } });
}
