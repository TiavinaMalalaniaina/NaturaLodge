import { prisma } from '../lib/prisma';
import { NotFoundError } from '../errors/AppError';
import { GuestInput, GuestPaginationParams } from '../validation/guest.schema';

const notesInclude = {
  notes: {
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};

export async function list(params: GuestPaginationParams) {
  const { search, status, page, limit } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(search ? {
      OR: [
        { name:  { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(status ? { status } : {}),
  };

  // Pas de `notesInclude` ici : Guests.tsx (liste paginée) n'affiche que nom/ville/pays/ancienneté
  // — l'historique de notes (potentiellement long, avec auteur imbriqué) n'est utile que sur
  // GuestProfile.tsx (une fiche à la fois), voir `getById` ci-dessous.
  const [guests, total] = await Promise.all([
    prisma.guest.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }),
    prisma.guest.count({ where }),
  ]);

  return {
    data: guests,
    meta: {
      total, page, limit,
      totalPages:  Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

export async function getById(id: string) {
  const guest = await prisma.guest.findUnique({
    where: { id },
    include: {
      ...notesInclude,
      bookings: {
        include: {
          rooms: {
            include: {
              room: {
                select: {
                  id:           true,
                  number:       true,
                  rateOverride: true,
                  roomType:     { select: { name: true, rate: true } },
                },
              },
            },
          },
        },
        orderBy: { arrival: 'desc' },
      },
    },
  });
  if (!guest) throw new NotFoundError('Client');
  return guest;
}

export function create(data: GuestInput) {
  return prisma.guest.create({
    data: { ...data, preferences: data.preferences ?? [] },
    include: notesInclude,
  });
}

export function update(id: string, data: Partial<GuestInput>) {
  return prisma.guest.update({ where: { id }, data, include: notesInclude });
}

export async function remove(id: string): Promise<void> {
  await prisma.guest.delete({ where: { id } });
}

export function addNote(guestId: string, content: string, authorId: string) {
  return prisma.guestNote.create({
    data: { content, guestId, authorId },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
}

export async function removeNote(guestId: string, noteId: string): Promise<void> {
  const note = await prisma.guestNote.findUnique({ where: { id: noteId } });
  if (!note || note.guestId !== guestId) throw new NotFoundError('Note');
  await prisma.guestNote.delete({ where: { id: noteId } });
}
