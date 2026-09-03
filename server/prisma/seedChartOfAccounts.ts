import { PrismaClient, PaymentMethod } from '@prisma/client'

// Plan comptable minimal de départ, partagé entre seed.ts (démo) et seed.init.ts (prod) — les deux
// doivent pouvoir démarrer avec les mêmes comptes de trésorerie/charges/produits. Upsert par
// `code` : rejouable sans dupliquer, et resynchronise nom/type/compte de trésorerie/moyens de
// paiement à chaque exécution (utile pour propager un renommage fait ici, ex: raccourcir un nom
// de compte) — `isActive` n'est pas listé ci-dessus donc jamais réactivé/désactivé par le reseed.
const CHART_OF_ACCOUNTS = [
  { code: '101000',  name: 'Capital / Apports propriétaire',        type: 'EQUITY',    isCashAccount: false, allowedMethods: [] },
  { code: '411000',  name: 'Clients',                               type: 'ASSET',     isCashAccount: false, allowedMethods: [] },
  { code: '401000',  name: 'Fournisseurs',                          type: 'LIABILITY', isCashAccount: false, allowedMethods: [] },
  { code: '4457000', name: 'TVA collectée',                         type: 'LIABILITY', isCashAccount: false, allowedMethods: [] },
  { code: '4456000', name: 'TVA déductible',                        type: 'ASSET',     isCashAccount: false, allowedMethods: [] },
  // "5", "51", "53"... : comptes collectifs (aucune écriture n'est jamais postée dessus
  // directement, isCashAccount: false) — leur seul rôle est de porter le libellé du groupe dans
  // les rapports (voir groupByCodePrefix dans ledger.service.ts), pour que les sous-comptes en
  // dessous puissent avoir un nom court. Pas de collectif "4" (comptes de tiers) : il couvrirait
  // à la fois des comptes ASSET (Clients, TVA déductible) et LIABILITY (Fournisseurs, TVA
  // collectée) — impossible avec un seul code, `code` étant unique tous types confondus.
  { code: '5',        name: 'Trésorerie',                           type: 'ASSET',     isCashAccount: false, allowedMethods: [] },
  { code: '51',       name: 'Banques et Mobile Money',               type: 'ASSET',     isCashAccount: false, allowedMethods: [] },
  { code: '512',      name: 'Banque',                                type: 'ASSET',     isCashAccount: false, allowedMethods: [] },
  { code: '512100',   name: 'BMOI',                                  type: 'ASSET',     isCashAccount: true,  allowedMethods: ['BANK_TRANSFER'] },
  { code: '512200',   name: 'BNI',                                   type: 'ASSET',     isCashAccount: true,  allowedMethods: ['BANK_TRANSFER'] },
  { code: '517',      name: 'Mobile Money',                          type: 'ASSET',     isCashAccount: false, allowedMethods: [] },
  { code: '517100',   name: 'Mvola',                                 type: 'ASSET',     isCashAccount: true,  allowedMethods: ['MVOLA'] },
  { code: '517200',   name: 'Orange Money 0323763499',                type: 'ASSET',     isCashAccount: true,  allowedMethods: ['ORANGE_MONEY'] },
  { code: '517300',   name: 'Orange Money 0323762757',                type: 'ASSET',     isCashAccount: true,  allowedMethods: ['ORANGE_MONEY'] },
  { code: '53',       name: 'Caisse',                                type: 'ASSET',     isCashAccount: false, allowedMethods: [] },
  { code: '530',      name: 'Caisse principale',                     type: 'ASSET',     isCashAccount: false, allowedMethods: [] },
  { code: '530000',   name: 'Caisse principale',                     type: 'ASSET',     isCashAccount: true,  allowedMethods: ['CASH'] },
  { code: '531',      name: 'Petites caisses et caisses personnel',  type: 'ASSET',     isCashAccount: false, allowedMethods: [] },
  { code: '531100',   name: 'Petite caisse',                         type: 'ASSET',     isCashAccount: true,  allowedMethods: ['CASH'] },
  { code: '606100',  name: 'Achats de fournitures',                 type: 'EXPENSE',   isCashAccount: false, allowedMethods: [] },
  { code: '606200',  name: 'Eau, électricité',                      type: 'EXPENSE',   isCashAccount: false, allowedMethods: [] },
  { code: '615000',  name: 'Entretien et réparations',              type: 'EXPENSE',   isCashAccount: false, allowedMethods: [] },
  { code: '623000',  name: 'Publicité, marketing',                  type: 'EXPENSE',   isCashAccount: false, allowedMethods: [] },
  { code: '641000',  name: 'Rémunérations du personnel',            type: 'EXPENSE',   isCashAccount: false, allowedMethods: [] },
  { code: '628000',  name: 'Autres charges',                        type: 'EXPENSE',   isCashAccount: false, allowedMethods: [] },
  { code: '627000',  name: 'Frais bancaires et de transfert',       type: 'EXPENSE',   isCashAccount: false, allowedMethods: [] },
  { code: '706000',  name: 'Prestations d\'hébergement',            type: 'REVENUE',   isCashAccount: false, allowedMethods: [] },
  // Contra-produit : les remises accordées y sont débitées, pour rester lisibles à part du CA brut.
  { code: '709000',  name: 'Rabais, remises et ristournes accordés', type: 'REVENUE',   isCashAccount: false, allowedMethods: [] },
] as const satisfies readonly { code: string; name: string; type: string; isCashAccount: boolean; allowedMethods: PaymentMethod[] }[]

export async function seedChartOfAccounts(prisma: PrismaClient) {
  for (const account of CHART_OF_ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where:  { code: account.code },
      update: account,
      create: account,
    })
  }
  console.log(`✅ Plan comptable : ${CHART_OF_ACCOUNTS.length} comptes.`)
}
