import { Role } from '@prisma/client';
import { prisma } from './prisma';

// Cache mémoire process-local : la matrice de permissions change rarement, donc éviter une
// requête DB à chaque appel HTTP. `invalidatePermissionCache()` est appelée par
// `permission.service.ts` à chaque modification via l'écran d'administration (Phase 3).
let cache: Map<string, Set<Role>> | null = null;
let loading: Promise<Map<string, Set<Role>>> | null = null;

async function loadCache(): Promise<Map<string, Set<Role>>> {
  const rows = await prisma.rolePermission.findMany({
    select: { role: true, permission: { select: { key: true } } },
  });
  const map = new Map<string, Set<Role>>();
  for (const row of rows) {
    const key = row.permission.key;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(row.role);
  }
  return map;
}

async function getCache(): Promise<Map<string, Set<Role>>> {
  if (cache) return cache;
  if (!loading) {
    loading = loadCache().then(map => {
      cache = map;
      loading = null;
      return map;
    });
  }
  return loading;
}

export async function roleHasPermission(role: Role, permissionKey: string): Promise<boolean> {
  const map = await getCache();
  return map.get(permissionKey)?.has(role) ?? false;
}

// Permissions effectives d'un rôle — envoyé au client au login/`/auth/me` (Phase 4) pour que
// l'UI se base sur la même source que `can()` côté serveur, au lieu de rejouer des checks de rôle
// codés en dur dans chaque page.
export async function getPermissionsForRole(role: Role): Promise<string[]> {
  const map = await getCache();
  const keys: string[] = [];
  for (const [key, roles] of map) {
    if (roles.has(role)) keys.push(key);
  }
  return keys;
}

export function invalidatePermissionCache(): void {
  cache = null;
}
