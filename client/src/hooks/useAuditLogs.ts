import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs, fetchAuditLogResourceTypes } from '../api/auditLogs';

export const AUDIT_LOGS_KEY = ['audit-logs'] as const;

export function useAuditLogs(params?: Parameters<typeof fetchAuditLogs>[0]) {
  return useQuery({
    queryKey: [...AUDIT_LOGS_KEY, 'list', params],
    queryFn:  () => fetchAuditLogs(params),
    placeholderData: (prev) => prev,
  });
}

export function useAuditLogResourceTypes() {
  return useQuery({
    queryKey: [...AUDIT_LOGS_KEY, 'resource-types'],
    queryFn:  fetchAuditLogResourceTypes,
    staleTime: 60_000,
  });
}
