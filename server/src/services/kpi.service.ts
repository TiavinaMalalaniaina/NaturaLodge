import { prisma } from '../lib/prisma';

// Tableau de bord "KPI hôteliers" mensuel. Toute l'agrégation SQL (explosion des nuitées,
// jointures, classification des comptes) vit dans les vues `kpi_*` (voir schema.prisma + la
// migration `*_kpi_hotelier_views`). Ici on ne fait que : convertir le mois en fenêtre de dates,
// filtrer ces vues, et calculer des ratios — même approche que ledger.service.ts sur JournalLine.
//
// Convention de signe (reprise de ledger.service.ts:normalBalance) :
//   REVENUE / LIABILITY / EQUITY → Σ(credit − debit)   |   ASSET / EXPENSE → Σ(debit − credit)

// detail=false saute les 2 requêtes de détail par chambre (byRoomAgg + rooms) — utilisé pour le
// mois de comparaison ("vs mois précédent"), où seuls les agrégats globaux servent aux DeltaBadge
// du dashboard ; byRoomType/byRoom reviennent alors vides plutôt que d'être recalculés pour rien.
export type KpiParams = { month: string; detail?: boolean }; // "AAAA-MM"

const num = (v: bigint | number | null | undefined): number => Number(v ?? 0);
const ratio = (a: number, b: number): number | null => (b === 0 ? null : a / b);

type SumDC = { _sum: { debit: bigint | null; credit: bigint | null } };
const revenueSide = (r: SumDC) => num(r._sum.credit) - num(r._sum.debit);
const expenseSide = (r: SumDC) => num(r._sum.debit) - num(r._sum.credit);

export async function getHotelKpis({ month, detail = true }: KpiParams) {
  const [y, m] = month.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const lastOfMonth = new Date(Date.UTC(y, m, 0));
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Mois en cours : on borne la fin à aujourd'hui pour ne pas diluer l'occupation avec des jours
  // à venir. Mois passé : mois calendaire complet.
  const dateTo = lastOfMonth < todayUTC ? lastOfMonth : todayUTC;
  const days = Math.max(0, Math.round((dateTo.getTime() - monthStart.getTime()) / 86_400_000) + 1);

  const inPeriod = { entryDate: { gte: monthStart, lte: dateTo } };
  const cashInPeriod = { isCashAccount: true, ...inPeriod };

  const [
    byType,
    accommodation, personnel, maintenance, byAccountType,
    paymentAgg, voidAgg, receivablesAgg,
    issuedCount, cancelledCount,
    inventory,
    occupancyTarget,
  ] = await Promise.all([
    prisma.kpiRoomNight.groupBy({
      by: ['roomTypeId', 'roomTypeName'],
      where: { bookingStatus: { not: 'CANCELLED' }, nightDate: { gte: monthStart, lte: dateTo } },
      _count: true,
      _sum: { roomRate: true, catalogueRate: true },
    }),
    prisma.kpiLedgerDaily.aggregate({ where: { accountCode: { in: ['706000', '709000'] }, ...inPeriod }, _sum: { debit: true, credit: true } }),
    prisma.kpiLedgerDaily.aggregate({ where: { accountCode: { startsWith: '641' }, ...inPeriod }, _sum: { debit: true, credit: true } }),
    prisma.kpiLedgerDaily.aggregate({ where: { accountCode: { startsWith: '615' }, ...inPeriod }, _sum: { debit: true, credit: true } }),
    prisma.kpiLedgerDaily.groupBy({ by: ['accountType'], where: inPeriod, _sum: { debit: true, credit: true } }),
    prisma.kpiLedgerDaily.aggregate({ where: { ...cashInPeriod, source: 'PAYMENT' }, _sum: { debit: true, credit: true } }),
    prisma.kpiLedgerDaily.aggregate({ where: { ...cashInPeriod, source: 'PAYMENT_VOID' }, _sum: { debit: true, credit: true } }),
    prisma.kpiLedgerDaily.aggregate({ where: { accountCode: '411000', entryDate: { lte: dateTo } }, _sum: { debit: true, credit: true } }),
    prisma.kpiInvoice.count({ where: { validatedDate: { gte: monthStart, lte: dateTo } } }),
    prisma.kpiInvoice.count({ where: { validatedDate: { gte: monthStart, lte: dateTo }, status: 'CANCELLED' } }),
    prisma.kpiRoomInventory.findMany(),
    prisma.kpiOccupancyTarget.findUnique({ where: { month } }),
  ]);

  // byRoomAgg (nuitées par chambre) + rooms (inventaire par chambre) : uniquement pour la table
  // "détail par chambre" (byRoom) — sautées quand `detail` est faux (mois de comparaison "vs mois
  // précédent", où seuls les agrégats globaux ci-dessus servent aux DeltaBadge du dashboard).
  const [byRoomAgg, rooms] = detail
    ? await Promise.all([
        prisma.kpiRoomNight.groupBy({
          by: ['roomId'],
          where: { bookingStatus: { not: 'CANCELLED' }, nightDate: { gte: monthStart, lte: dateTo } },
          _count: true,
          _sum: { roomRate: true, catalogueRate: true },
        }),
        prisma.kpiRoom.findMany({ orderBy: { roomNumber: 'asc' } }),
      ])
    : [[], []];

  const totalOf = (type: 'REVENUE' | 'EXPENSE') => {
    const row = byAccountType.find(r => r.accountType === type);
    if (!row) return 0;
    return type === 'REVENUE' ? revenueSide(row) : expenseSide(row);
  };

  // ── Occupation ──
  const roomsAvailable      = inventory.reduce((s, r) => s + num(r.roomsAvailable), 0);
  const roomNightsAvailable = roomsAvailable * days;
  const roomNightsSold      = byType.reduce((s, r) => s + r._count, 0);
  const accommodationNet    = revenueSide(accommodation);        // "CA hébergement net" (706000 net de 709000)
  const theoreticalRevenue  = byType.reduce((s, r) => s + num(r._sum.catalogueRate), 0);

  const invByType = new Map(inventory.map(r => [r.roomTypeId, r]));
  const soldByType = new Map(byType.map(r => [r.roomTypeId, r]));
  const byRoomType = [...new Set([...invByType.keys(), ...soldByType.keys()])].map(id => {
    const sold = soldByType.get(id);
    const inv  = invByType.get(id);
    const rooms  = num(inv?.roomsAvailable);
    const nAvail = rooms * days;
    const nSold  = sold?._count ?? 0;
    return {
      roomTypeId:          id,
      roomTypeName:        sold?.roomTypeName ?? inv?.roomTypeName ?? '—',
      roomsAvailable:      rooms,
      roomNightsAvailable: nAvail,
      roomNightsSold:      nSold,
      occupancyRate:       ratio(nSold, nAvail),
      theoreticalRevenue:  num(sold?._sum.catalogueRate),   // Σ RoomType.rate sur nuitées vendues
      realisedRoomRevenue: num(sold?._sum.roomRate),        // Σ BookingRoom.roomRate (snapshot)
    };
  }).sort((a, b) => a.roomTypeName.localeCompare(b.roomTypeName));

  // ── Détail par chambre — toutes les chambres, y compris sans vente sur la période.
  //    `roomNightsAvailable` = jours de la période pour chaque chambre (le statut MAINTENANCE
  //    courant n'a pas d'historique — voir `status` pour distinguer visuellement). ──
  const soldByRoom = new Map(byRoomAgg.map(r => [r.roomId, r]));
  const byRoom = rooms.map(room => {
    const sold  = soldByRoom.get(room.roomId);
    const nSold = sold?._count ?? 0;
    return {
      roomId:              room.roomId,
      roomNumber:          room.roomNumber,
      roomTypeName:        room.roomTypeName,
      status:              room.status.toLowerCase(),
      nightlyRate:         room.catalogueRate,
      roomNightsSold:      nSold,
      roomNightsAvailable: days,
      occupancyRate:       ratio(nSold, days),
      theoreticalRevenue:  num(sold?._sum.catalogueRate),
      realisedRoomRevenue: num(sold?._sum.roomRate),
    };
  });

  // ── Encaissement (miroir de ledger.service.ts:getSummary.revenueCollected) ──
  const grossCollected  = num(paymentAgg._sum.debit);
  const paymentRefunds  = num(paymentAgg._sum.credit);   // remboursements d'avoir (source PAYMENT, sens sortant)
  const paymentVoids    = num(voidAgg._sum.credit);      // annulations de paiement (source PAYMENT_VOID)
  const netCollected    = (grossCollected - paymentRefunds) + (num(voidAgg._sum.debit) - paymentVoids);

  // ── Rentabilité ──
  const personnelExpense   = expenseSide(personnel);
  const maintenanceExpense = expenseSide(maintenance);
  const totalExpense       = totalOf('EXPENSE');
  const totalRevenue       = totalOf('REVENUE');
  const netIncome          = totalRevenue - totalExpense;
  const netInvoices        = issuedCount - cancelledCount;

  const occupancyRate = ratio(roomNightsSold, roomNightsAvailable);
  const occupancyTargetRate = occupancyTarget?.targetRate ?? null;

  return {
    period: {
      month,
      dateFrom: monthStart.toISOString().slice(0, 10),
      dateTo:   dateTo.toISOString().slice(0, 10),
      days,
    },

    occupancy: {
      roomsAvailable,
      days,
      roomNightsAvailable,
      roomNightsSold,
      occupancyRate,
      accommodationRevenueNet: accommodationNet,
      adr:                     ratio(accommodationNet, roomNightsSold),
      revpar:                  ratio(accommodationNet, roomNightsAvailable),
      theoreticalRevenue,
      adrTheoretical:          ratio(theoreticalRevenue, roomNightsSold),
      revparTheoretical:       ratio(theoreticalRevenue, roomNightsAvailable),
      revenueVariance:         accommodationNet - theoreticalRevenue,
      revenueVariancePct:      ratio(accommodationNet - theoreticalRevenue, theoreticalRevenue),
      occupancyTargetRate,
      occupancyGapToTarget:    occupancyTargetRate == null || occupancyRate == null ? null : occupancyRate - occupancyTargetRate,
    },

    byRoomType,
    byRoom,

    billing: {
      standardInvoicesIssued:  issuedCount,
      cancelledInvoices:       cancelledCount,
      netInvoices,
      averageBasket:           ratio(accommodationNet, netInvoices),
      grossCollected,
      paymentRefunds,
      paymentVoids,
      netCollected,
      invoicedRevenue:         accommodationNet,
      // recoveryRate peut dépasser 100 % : un encaissement de la période peut solder une facture
      // d'une période antérieure. Indicatif.
      recoveryRate:            ratio(netCollected, accommodationNet),
      paymentCancellationRate: ratio(paymentRefunds + paymentVoids, accommodationNet),
      clientReceivablesEndOfPeriod: expenseSide(receivablesAgg), // 411000 est un ASSET → Σ(debit − credit)
    },

    profitability: {
      revenue:                   totalRevenue,
      accommodationRevenueNet:   accommodationNet,   // "CA" au sens du PDF, dénominateur des ratios
      netIncome,
      netOperatingMargin:        ratio(netIncome, accommodationNet),
      personnelExpense,
      personnelExpenseRatio:     ratio(personnelExpense, accommodationNet),
      maintenanceExpense,
      maintenanceExpenseRatio:   ratio(maintenanceExpense, accommodationNet),
      totalExpense,
      totalExpenseRatio:         ratio(totalExpense, accommodationNet),
      revenuePerDay:             ratio(accommodationNet, days),
      netIncomePerAvailableRoom: ratio(netIncome, roomsAvailable),
    },
  };
}

export type KpiOccupancyTargetInput = { month: string; targetRate: number };

export async function setOccupancyTarget({ month, targetRate }: KpiOccupancyTargetInput) {
  return prisma.kpiOccupancyTarget.upsert({
    where:  { month },
    update: { targetRate },
    create: { month, targetRate },
  });
}
