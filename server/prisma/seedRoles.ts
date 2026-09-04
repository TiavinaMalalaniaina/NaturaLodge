import { PrismaClient } from '@prisma/client'

// Les 4 rôles historiques — marqués isSystem (jamais supprimables, mais renommables comme
// n'importe quel rôle custom créé plus tard depuis l'écran Permissions). Doit tourner avant
// seedPermissions (qui résout ces noms vers leurs ids). Upsert par `name` : rejouable sans
// dupliquer ni écraser un renommage déjà fait par l'utilisateur.
const SYSTEM_ROLES = ['ADMIN', 'MANAGER', 'GERANT', 'HOUSEKEEPING'] as const

export async function seedRoles(prisma: PrismaClient) {
  for (const name of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where:  { name },
      update: {},
      create: { name, isSystem: true },
    })
  }
  console.log(`✅ Rôles : ${SYSTEM_ROLES.length} rôles système.`)
}
