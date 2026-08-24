import { PrismaClient } from '@prisma/client'

// Plan comptable minimal de départ, partagé entre seed.ts (démo) et seed.init.ts (prod) — les deux
// doivent pouvoir démarrer avec les mêmes comptes de trésorerie/charges/produits. Upsert par
// `code` : rejouable sans dupliquer ni écraser un compte déjà personnalisé (isActive, nom...).
const CHART_OF_ACCOUNTS = [
  { code: '101000',  name: 'Capital / Apports propriétaire',        type: 'EQUITY',    isCashAccount: false },
  { code: '411000',  name: 'Clients',                               type: 'ASSET',     isCashAccount: false },
  { code: '401000',  name: 'Fournisseurs',                          type: 'LIABILITY', isCashAccount: false },
  { code: '4457000', name: 'TVA collectée',                         type: 'LIABILITY', isCashAccount: false },
  { code: '4456000', name: 'TVA déductible',                        type: 'ASSET',     isCashAccount: false },
  { code: '530000',  name: 'Caisse principale',                     type: 'ASSET',     isCashAccount: true  },
  { code: '512100',  name: 'Mobile Money — Mvola',                  type: 'ASSET',     isCashAccount: true  },
  { code: '512200',  name: 'Mobile Money — Orange Money 0323763499', type: 'ASSET',     isCashAccount: true  },
  { code: '512300',  name: 'Mobile Money — Orange Money 0323762757', type: 'ASSET',     isCashAccount: true  },
  { code: '606100',  name: 'Achats de fournitures',                 type: 'EXPENSE',   isCashAccount: false },
  { code: '606200',  name: 'Eau, électricité',                      type: 'EXPENSE',   isCashAccount: false },
  { code: '615000',  name: 'Entretien et réparations',              type: 'EXPENSE',   isCashAccount: false },
  { code: '623000',  name: 'Publicité, marketing',                  type: 'EXPENSE',   isCashAccount: false },
  { code: '641000',  name: 'Rémunérations du personnel',            type: 'EXPENSE',   isCashAccount: false },
  { code: '628000',  name: 'Autres charges',                        type: 'EXPENSE',   isCashAccount: false },
  { code: '706000',  name: 'Prestations d\'hébergement',            type: 'REVENUE',   isCashAccount: false },
] as const

export async function seedChartOfAccounts(prisma: PrismaClient) {
  for (const account of CHART_OF_ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where:  { code: account.code },
      update: {},
      create: account,
    })
  }
  console.log(`✅ Plan comptable : ${CHART_OF_ACCOUNTS.length} comptes.`)
}
