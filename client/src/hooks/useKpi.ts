import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchHotelKpis, setOccupancyTarget } from '../api/kpi';

export const KPI_KEY = ['kpi'] as const;

// month : "AAAA-MM". `detail: false` pour un mois de simple comparaison (pas affiché, juste les
// agrégats globaux pour les DeltaBadge) — clé de cache distincte du fetch complet du même mois.
export function useHotelKpis(month: string, detail = true) {
  return useQuery({
    queryKey: [...KPI_KEY, month, detail],
    queryFn:  () => fetchHotelKpis(month, detail),
    placeholderData: (prev) => prev,
  });
}

export function useSetOccupancyTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, targetRate }: { month: string; targetRate: number }) => setOccupancyTarget(month, targetRate),
    onSuccess: () => qc.invalidateQueries({ queryKey: KPI_KEY }),
  });
}
