import { prisma } from './prisma';

// Cache mémoire process-local : la matrice de permissions change rarement, donc éviter une
// requête DB à chaque appel HTTP. `invalidatePermissionCache()` est appelée par
// `permission.service.ts` à chaque modification via l'écran d'administration (Phase 3).
// Indexé par NOM de rôle (le JWT porte le nom, pas l'id — voir auth.service.ts) : renommer un
// rôle ne casse rien tant que le cache est rechargé, mais un token émis avant un renommage cesse
// de matcher jusqu'à réauthentification (fail-closed, assumé).
let cache: Map<string, Set<string>> | null = null;
let loading: Promise<Map<string, Set<string>>> | null = null;

async function loadCache(): Promise<Map<string, Set<string>>> {
  const rows = await prisma.rolePermission.findMany({
    select: { role: { select: { name: true } }, permission: { select: { key: true } } },
  });
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = row.permission.key;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(row.role.name);
  }
  return map;
}

async function getCache(): Promise<Map<string, Set<string>>> {
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

export async function roleHasPermission(roleName: string, permissionKey: string): Promise<boolean> {
  const map = await getCache();
  return map.get(permissionKey)?.has(roleName) ?? false;
}

// Permissions effectives d'un rôle — envoyé au client au login/`/auth/me` (Phase 4) pour que
// l'UI se base sur la même source que `can()` côté serveur, au lieu de rejouer des checks de rôle
// codés en dur dans chaque page.
export async function getPermissionsForRole(roleName: string): Promise<string[]> {
  const map = await getCache();
  const keys: string[] = [];
  for (const [key, roles] of map) {
    if (roles.has(roleName)) keys.push(key);
  }
  return keys;
}

export function invalidatePermissionCache(): void {
  cache = null;
}
