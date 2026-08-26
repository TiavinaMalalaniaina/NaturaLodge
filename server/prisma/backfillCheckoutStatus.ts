import { config } from 'dotenv'
config()

import { prisma } from '../src/lib/prisma'
import { computePaymentStatus } from '../src/services/booking.service'

// Script à lancer UNE FOIS après la migration `split_checked_out_statuses` (schema.prisma :
// BookingStatus.CHECKED_OUT scindé en CHECKED_OUT_UNPAID/CHECKED_OUT_PAID/CLOSED) : convertit
// chaque réservation encore au statut legacy CHECKED_OUT vers l'un des deux nouveaux statuts,
// selon la facture la plus récente au moment du script. Idempotent : ne touche que les lignes
// encore littéralement CHECKED_OUT, donc rejouable sans risque si interrompu ou relancé.

async function main() {
  const bookings = await prisma.booking.findMany({
    where: { status: 'CHECKED_OUT' },
    include: {
      invoices: {
        select:  { status: true, totalAmount: true },
        orderBy: { issuedAt: 'desc' },
        take:    1,
      },
    },
  })

  let paid = 0, unpaid = 0

  for (const booking of bookings) {
    const status = computePaymentStatus(booking) === 'paid' ? 'CHECKED_OUT_PAID' : 'CHECKED_OUT_UNPAID'
    await prisma.booking.update({ where: { id: booking.id }, data: { status } })
    if (status === 'CHECKED_OUT_PAID') paid++; else unpaid++
  }

  console.log({ total: bookings.length, paid, unpaid })
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
