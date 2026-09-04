import { PrismaClient } from '@prisma/client'

// Catégories de dépense de départ, une par compte de charge du plan comptable minimal (voir
// seedChartOfAccounts.ts) — reprend exactement le mapping de l'ancien enum ExpenseCategory.
// Doit tourner après seedChartOfAccounts (dépend des comptes déjà créés). Upsert par `name` :
// rejouable sans dupliquer ni écraser une catégorie déjà personnalisée (compte, isActive...).
const EXPENSE_CATEGORIES = [
  { name: 'Fournitures',                accountCode: '606100' },
  { name: 'Eau, électricité',           accountCode: '606200' },
  { name: 'Entretien et réparations',   accountCode: '615000' },
  { name: 'Publicité, marketing',       accountCode: '623000' },
  { name: 'Rémunérations du personnel', accountCode: '641000' },
  { name: 'Autres charges',             accountCode: '628000' },
] as const

export async function seedExpenseCategories(prisma: PrismaClient) {
  for (const category of EXPENSE_CATEGORIES) {
    const account = await prisma.ledgerAccount.findUnique({ where: { code: category.accountCode } })
    if (!account) continue // plan comptable pas encore seedé ou compte renommé — on ignore plutôt que de planter

    await prisma.expenseCategory.upsert({
      where:  { name: category.name },
      update: {},
      create: { name: category.name, accountId: account.id },
    })
  }
  console.log(`✅ Catégories de dépense : ${EXPENSE_CATEGORIES.length} catégories.`)
}
