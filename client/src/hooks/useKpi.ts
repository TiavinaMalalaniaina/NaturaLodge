import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchHotelKpis, setOccupancyTarget } from '../api/kpi';

export const KPI_KEY = ['kpi'] as const;

// month : "AAAA-MM"
export function useHotelKpis(month: string) {
  return useQuery({
    queryKey: [...KPI_KEY, month],
    queryFn:  () => fetchHotelKpis(month),
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
