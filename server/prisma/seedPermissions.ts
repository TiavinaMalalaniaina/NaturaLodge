import { PrismaClient, Role } from '@prisma/client'

// Catalogue des permissions — une entrée par action logique de l'API, parfois plusieurs routes
// derrière une même clé quand elles partagent toujours le même ensemble de rôles (ex:
// "bookings.manage_rooms" couvre les 5 routes d'ajout/retrait de chambre et de supplément d'une
// réservation). Construit à partir d'un inventaire exhaustif des routes de server/src/routes/*.ts
// (Phase 1 de la feuille de route permissions) — reflète l'état actuel des `authorize(...)`,
// SAUF pour HOUSEKEEPING, dont le périmètre est explicitement resserré à la lecture seule
// (décision Phase 0) : ferme au passage deux routes d'écriture qui n'avaient jusqu'ici aucun
// contrôle de rôle (`POST guests/:id/notes`, `POST bookings/:id/notes`, ouvertes à tout rôle
// authentifié) en les alignant sur ADMIN/MANAGER/RECEPTIONIST, comme les autres actions du même
// domaine.
//
// `auth.ts` (login, /me) n'a volontairement aucune permission : login est public,
// /me est un accès à ses propres infos, pas une action à autoriser par rôle.
const ALL_STAFF: Role[]    = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING']
const ADMIN_MANAGER: Role[] = ['ADMIN', 'MANAGER']
const FRONT_DESK: Role[]    = ['ADMIN', 'MANAGER', 'RECEPTIONIST']
const ADMIN_ONLY: Role[]    = ['ADMIN']

type PermissionSeed = { key: string; domain: string; description: string; roles: Role[] }

const PERMISSIONS: PermissionSeed[] = [
  // ── rooms ──
  { key: 'rooms.view',             domain: 'rooms',     description: 'Consulter les chambres, équipements et disponibilité',            roles: ALL_STAFF },
  { key: 'rooms.manage_features',  domain: 'rooms',     description: 'Gérer le catalogue d\'équipements des chambres',                   roles: ADMIN_MANAGER },
  { key: 'rooms.create',           domain: 'rooms',     description: 'Créer une chambre',                                                roles: ADMIN_MANAGER },
  { key: 'rooms.update',           domain: 'rooms',     description: 'Modifier une chambre',                                             roles: FRONT_DESK },
  { key: 'rooms.delete',           domain: 'rooms',     description: 'Supprimer une chambre',                                            roles: ADMIN_ONLY },

  // ── room types ──
  { key: 'roomTypes.view',         domain: 'roomTypes', description: 'Consulter les types de chambre',                                   roles: ALL_STAFF },
  { key: 'roomTypes.manage',       domain: 'roomTypes', description: 'Créer, modifier ou supprimer un type de chambre',                   roles: ADMIN_MANAGER },

  // ── invoices ──
  { key: 'invoices.view',            domain: 'invoices', description: 'Consulter les factures',                                          roles: ALL_STAFF },
  { key: 'invoices.generate',        domain: 'invoices', description: 'Générer une facture depuis une réservation',                      roles: FRONT_DESK },
  { key: 'invoices.update',          domain: 'invoices', description: 'Modifier une facture (notes, échéance, TVA)',                     roles: ADMIN_MANAGER },
  { key: 'invoices.cancel',          domain: 'invoices', description: 'Annuler une facture',                                             roles: ADMIN_MANAGER },
  { key: 'invoices.record_payment',  domain: 'invoices', description: 'Enregistrer un paiement',                                         roles: FRONT_DESK },
  { key: 'invoices.void_payment',    domain: 'invoices', description: 'Annuler un paiement',                                             roles: ADMIN_MANAGER },

  // ── guests ──
  { key: 'guests.view',        domain: 'guests', description: 'Consulter les clients',                                                   roles: ALL_STAFF },
  { key: 'guests.create',      domain: 'guests', description: 'Créer un client',                                                         roles: FRONT_DESK },
  { key: 'guests.update',      domain: 'guests', description: 'Modifier un client',                                                      roles: FRONT_DESK },
  { key: 'guests.delete',      domain: 'guests', description: 'Supprimer un client',                                                     roles: ADMIN_ONLY },
  { key: 'guests.add_note',    domain: 'guests', description: 'Ajouter une note à un client',                                            roles: FRONT_DESK },
  { key: 'guests.delete_note', domain: 'guests', description: 'Supprimer une note client',                                               roles: ADMIN_MANAGER },

  // ── bookings ──
  { key: 'bookings.view',          domain: 'bookings', description: 'Consulter les réservations',                                        roles: ALL_STAFF },
  { key: 'bookings.create',        domain: 'bookings', description: 'Créer une réservation',                                             roles: FRONT_DESK },
  { key: 'bookings.update_status', domain: 'bookings', description: 'Changer le statut d\'une réservation (confirmer, check-in/out, annuler)', roles: FRONT_DESK },
  { key: 'bookings.reassign',      domain: 'bookings', description: 'Réassigner la chambre d\'une réservation',                          roles: FRONT_DESK },
  { key: 'bookings.manage_rooms',  domain: 'bookings', description: 'Ajouter/retirer une chambre ou un supplément sur une réservation',   roles: FRONT_DESK },
  { key: 'bookings.delete',        domain: 'bookings', description: 'Supprimer une réservation',                                         roles: ADMIN_MANAGER },
  { key: 'bookings.add_note',      domain: 'bookings', description: 'Ajouter une note à une réservation',                                roles: FRONT_DESK },
  { key: 'bookings.delete_note',   domain: 'bookings', description: 'Supprimer une note de réservation',                                 roles: ADMIN_MANAGER },

  // ── staff ── (déjà restreint ADMIN/MANAGER aujourd'hui, HOUSEKEEPING n'y gagne pas d'accès en lecture)
  { key: 'staff.view',             domain: 'staff', description: 'Consulter l\'annuaire du personnel',                                   roles: ADMIN_MANAGER },
  { key: 'staff.create',           domain: 'staff', description: 'Créer un compte staff',                                                roles: ADMIN_ONLY },
  { key: 'staff.update',           domain: 'staff', description: 'Modifier un compte staff',                                             roles: ADMIN_MANAGER },
  { key: 'staff.manage_password',  domain: 'staff', description: 'Réinitialiser le mot de passe d\'un membre du personnel',               roles: ADMIN_ONLY },
  { key: 'staff.delete',           domain: 'staff', description: 'Supprimer un compte staff',                                            roles: ADMIN_ONLY },

  // ── extras ──
  { key: 'extras.view',   domain: 'extras', description: 'Consulter le catalogue de suppléments',                                        roles: ALL_STAFF },
  { key: 'extras.manage', domain: 'extras', description: 'Créer, modifier ou supprimer un supplément',                                   roles: ADMIN_MANAGER },

  // ── payments ──
  { key: 'payments.view', domain: 'payments', description: 'Consulter l\'historique des paiements',                                      roles: ALL_STAFF },

  // ── ledger / trésorerie ── (rapports déjà restreints ADMIN/MANAGER aujourd'hui)
  { key: 'ledger.view_cash_accounts', domain: 'ledger', description: 'Consulter les comptes de trésorerie et leur solde',                roles: ALL_STAFF },
  { key: 'ledger.view_reports',       domain: 'ledger', description: 'Consulter relevés, résumé, bilan, compte de résultat, export CSV', roles: ADMIN_MANAGER },
  { key: 'ledger.transfer',           domain: 'ledger', description: 'Effectuer un virement entre comptes de trésorerie',                roles: ADMIN_MANAGER },
  { key: 'ledger.contribute',         domain: 'ledger', description: 'Enregistrer un apport externe (capital propriétaire...)',          roles: ADMIN_MANAGER },

  // ── expenses ──
  { key: 'expenses.view',   domain: 'expenses', description: 'Consulter les dépenses',                                                   roles: ALL_STAFF },
  { key: 'expenses.create', domain: 'expenses', description: 'Enregistrer une dépense',                                                  roles: ADMIN_MANAGER },

  // ── audit ──
  { key: 'auditLogs.view', domain: 'auditLogs', description: 'Consulter le journal d\'audit',                                            roles: ADMIN_ONLY },

  // ── permissions (Phase 3) ──
  { key: 'permissions.manage', domain: 'permissions', description: 'Consulter et modifier la matrice de permissions', roles: ADMIN_ONLY },
]

// Idempotent et non destructif : upsert le catalogue (clé/domaine/description), puis n'AJOUTE que
// les associations rôle×permission manquantes (`skipDuplicates`) sans jamais en retirer. Une
// customisation faite plus tard via un futur écran d'administration (Phase 3) doit survivre à un
// reseed — même leçon que seedChartOfAccounts.ts avec la dérive des noms de comptes.
export async function seedPermissions(prisma: PrismaClient) {
  let linkCount = 0
  for (const p of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where:  { key: p.key },
      update: { domain: p.domain, description: p.description },
      create: { key: p.key, domain: p.domain, description: p.description },
    })
    if (p.roles.length > 0) {
      const result = await prisma.rolePermission.createMany({
        data: p.roles.map(role => ({ role, permissionId: permission.id })),
        skipDuplicates: true,
      })
      linkCount += result.count
    }
  }
  console.log(`✅ Permissions : ${PERMISSIONS.length} clés (${linkCount} nouvelles associations rôle×permission).`)
}
