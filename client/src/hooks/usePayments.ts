import { useQuery } from '@tanstack/react-query';
import { fetchPayments } from '../api/payments';

export const PAYMENTS_KEY = ['payments'] as const;

export function usePayments(params?: Parameters<typeof fetchPayments>[0]) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'list', params],
    queryFn:  () => fetchPayments(params),
    placeholderData: (prev) => prev,
  });
}
