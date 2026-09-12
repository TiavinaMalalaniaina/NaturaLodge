import { api } from './client';

// Miroir du DTO renvoyé par `server/src/services/kpi.service.ts`. Les ratios valent `null` quand
// le dénominateur est nul (aucune division impossible côté client).

export interface KpiRoomTypeRow {
  roomTypeId:          string;
  roomTypeName:        string;
  roomsAvailable:      number;
  roomNightsAvailable: number;
  roomNightsSold:      number;
  occupancyRate:       number | null;
  theoreticalRevenue:  number;
  realisedRoomRevenue: number;
}

export interface KpiRoomRow {
  roomId:              string;
  roomNumber:          string;
  roomTypeName:        string;
  status:              string;   // available | occupied | maintenance | reserved
  nightlyRate:         number;
  roomNightsSold:      number;
  roomNightsAvailable: number;
  occupancyRate:       number | null;
  theoreticalRevenue:  number;
  realisedRoomRevenue: number;
}

export interface HotelKpis {
  period: { month: string; dateFrom: string; dateTo: string; days: number };

  occupancy: {
    roomsAvailable:          number;
    days:                    number;
    roomNightsAvailable:     number;
    roomNightsSold:          number;
    occupancyRate:           number | null;
    accommodationRevenueNet: number;
    adr:                     number | null;
    revpar:                  number | null;
    theoreticalRevenue:      number;
    adrTheoretical:          number | null;
    revparTheoretical:       number | null;
    revenueVariance:         number;
    revenueVariancePct:      number | null;
    occupancyTargetRate:     number | null;
    occupancyGapToTarget:    number | null;
  };

  byRoomType: KpiRoomTypeRow[];
  byRoom:     KpiRoomRow[];

  billing: {
    standardInvoicesIssued:       number;
    cancelledInvoices:            number;
    netInvoices:                  number;
    averageBasket:                number | null;
    grossCollected:               number;
    paymentRefunds:               number;
    paymentVoids:                 number;
    netCollected:                 number;
    invoicedRevenue:              number;
    recoveryRate:                 number | null;
    paymentCancellationRate:      number | null;
    clientReceivablesEndOfPeriod: number;
  };

  profitability: {
    revenue:                   number;
    accommodationRevenueNet:   number;
    netIncome:                 number;
    netOperatingMargin:        number | null;
    personnelExpense:          number;
    personnelExpenseRatio:     number | null;
    maintenanceExpense:        number;
    maintenanceExpenseRatio:   number | null;
    totalExpense:              number;
    totalExpenseRatio:         number | null;
    revenuePerDay:             number | null;
    netIncomePerAvailableRoom: number | null;
  };
}

// month au format "AAAA-MM"
export const fetchHotelKpis = async (month: string): Promise<HotelKpis> => {
  const { data } = await api.get<HotelKpis>('/kpi', { params: { month } });
  return data;
};

// targetRate en fraction (0.9 = 90 %), même convention que les autres ratios du dashboard.
export const setOccupancyTarget = async (month: string, targetRate: number): Promise<void> => {
  await api.put('/kpi/occupancy-target', { month, targetRate });
};
