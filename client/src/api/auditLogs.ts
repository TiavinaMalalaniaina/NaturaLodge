import { api } from './client';

export interface AuditLogEntry {
  id:           string;
  userId:       string | null;
  user:         { id: string; name: string; role: string } | null;
  method:       string;
  path:         string;
  resourceType: string | null;
  resourceId:   string | null;
  statusCode:   number;
  body:         Record<string, unknown> | null;
  createdAt:    string;
}

export interface AuditLogsList {
  data: AuditLogEntry[];
  meta: {
    total:       number;
    page:        number;
    limit:       number;
    totalPages:  number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface AuditLogsParams {
  page?:         number;
  limit?:        number;
  userId?:       string;
  resourceType?: string;
  dateFrom?:     string;
  dateTo?:       string;
}

export const fetchAuditLogs = async (params?: AuditLogsParams): Promise<AuditLogsList> => {
  const { data } = await api.get<AuditLogsList>('/audit-logs', { params });
  return data;
};

export const fetchAuditLogResourceTypes = async (): Promise<string[]> => {
  const { data } = await api.get<string[]>('/audit-logs/resource-types');
  return data;
};
