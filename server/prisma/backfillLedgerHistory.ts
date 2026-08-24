import { config } from 'dotenv'
config()

import { prisma } from '../src/lib/prisma'
import * as ledgerService from '../src/services/ledger.service'

// Script à lancer UNE FOIS lors de la mise en prod du module de comptabilité, après les
// migrations de schéma et le seed du plan comptable (npx tsx prisma/seed.init.ts) : reconstitue
// dans le grand livre les écritures manquantes pour les factures/paiements créés avant que ce
// module n'existe (la migration de schéma ne fait que rattacher Payment.accountId, elle ne poste
// aucune écriture — voir la conversation qui a mené à ce script). Idempotent : vérifie pour
// chaque facture/paiement qu'aucune écriture ne référence déjà relatedInvoiceId/relatedPaymentId
// avant d'en poster une, donc rejouable sans risque de doublon si interrompu ou relancé.
//
// Les factures CANCELLED/REFUNDED sont ignorées (effet net nul, même convention que
// syncInvoiceWithBooking) — et par cohérence leurs paiements éventuels aussi, pour ne jamais
// créditer 411000 Clients sans le débit d'origine correspondant.

// Défaut Prisma (5000ms) trop court en pratique contre une base distante à latence élevée
// (ex: Render) — chaque écriture fait plusieurs allers-retours dans une seule transaction.
const TX_TIMEOUT_MS = 20_000

async function main() {
  const invoices = await prisma.invoice.findMany({
    where:   { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    orderBy: { issuedAt: 'asc' },
  })

  let postedInvoices = 0, skippedInvoices = 0, postedPayments = 0, skippedPayments = 0, postedVoids = 0

  for (const invoice of invoices) {
    const existingInvoiceEntry = await prisma.journalEntry.findFirst({
      where: { relatedInvoiceId: invoice.id, source: 'INVOICE' },
    })

    if (existingInvoiceEntry) {
      skippedInvoices++
    } else {
      const subtotal = invoice.totalAmount - invoice.taxAmount
      await ledgerService.postEntry({
        source:           'INVOICE',
        relatedInvoiceId: invoice.id,
        date:             invoice.issuedAt,
        memo:             `Facture ${invoice.number} (historique)`,
        lines: [
          { accountCode: '411000', debit: invoice.totalAmount },
          { accountCode: '706000', credit: subtotal },
          ...(invoice.taxAmount > 0 ? [{ accountCode: '4457000', credit: invoice.taxAmount } as const] : []),
        ],
      }, prisma, TX_TIMEOUT_MS)
      postedInvoices++
    }

    const payments = await prisma.payment.findMany({
      where:   { invoiceId: invoice.id, status: { in: ['COMPLETED', 'REFUNDED'] } },
      orderBy: { paidAt: 'asc' },
    })

    for (const payment of payments) {
      const existingPaymentEntry = await prisma.journalEntry.findFirst({
        where: { relatedPaymentId: payment.id, source: 'PAYMENT' },
      })

      if (existingPaymentEntry) {
        skippedPayments++
      } else {
        await ledgerService.postEntry({
          source:           'PAYMENT',
          relatedPaymentId: payment.id,
          relatedInvoiceId: invoice.id,
          date:             payment.paidAt,
          memo:             `Encaissement facture ${invoice.number} (historique)`,
          lines: [
            { accountId: payment.accountId, debit: payment.amount },
            { accountCode: '411000', credit: payment.amount },
          ],
        }, prisma, TX_TIMEOUT_MS)
        postedPayments++
      }

      if (payment.status === 'REFUNDED') {
        const existingVoidEntry = await prisma.journalEntry.findFirst({
          where: { relatedPaymentId: payment.id, source: 'PAYMENT_VOID' },
        })
        if (!existingVoidEntry) {
          // Pas de date de remboursement stockée sur Payment — on réutilise paidAt, faute de mieux.
          await ledgerService.postEntry({
            source:           'PAYMENT_VOID',
            relatedPaymentId: payment.id,
            relatedInvoiceId: invoice.id,
            date:             payment.paidAt,
            memo:             `Annulation paiement — facture ${invoice.number} (historique)`,
            lines: [
              { accountCode: '411000', debit: payment.amount },
              { accountId: payment.accountId, credit: payment.amount },
            ],
          }, prisma, TX_TIMEOUT_MS)
          postedVoids++
        }
      }
    }
  }

  console.log({ postedInvoices, skippedInvoices, postedPayments, skippedPayments, postedVoids })
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
