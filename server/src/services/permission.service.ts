import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { invalidatePermissionCache } from '../lib/permissions';

export async function list() {
  const permissions = await prisma.permission.findMany({
    include: { roles: { select: { role: true } } },
    orderBy: [{ domain: 'asc' }, { key: 'asc' }],
  });

  return permissions.map(p => ({
    id:          p.id,
    key:         p.key,
    domain:      p.domain,
    description: p.description,
    roles:       p.roles.map(r => r.role),
  }));
}

export async function setRolePermission(permissionId: string, role: Role, granted: boolean) {
  const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) throw new NotFoundError('Permission');

  // Garde-fou anti-verrouillage (Phase 0) : jamais retirer le dernier rôle qui peut encore gérer
  // la matrice de permissions elle-même, sinon plus personne ne peut jamais la remodifier.
  if (!granted && permission.key === 'permissions.manage') {
    const grantedCount = await prisma.rolePermission.count({ where: { permissionId } });
    if (grantedCount <= 1) {
      throw new ConflictError(
        'Impossible de retirer ce rôle : ce serait le dernier à pouvoir gérer les permissions, ce qui verrouillerait définitivement le système.',
      );
    }
  }

  if (granted) {
    await prisma.rolePermission.upsert({
      where:  { role_permissionId: { role, permissionId } },
      update: {},
      create: { role, permissionId },
    });
  } else {
    await prisma.rolePermission.deleteMany({ where: { role, permissionId } });
  }

  invalidatePermissionCache();

  return { permissionId, role, granted };
}
