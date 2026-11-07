import { api } from './client';

export type RequestStatus = 'PENDING' | 'AWAITING_PAYMENT' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export interface WebsiteRequest {
  id: string; reference: string; name: string; email: string; phone: string; notes: string;
  arrival: string; departure: string; guests: number; createdAt: string;
  lines: { roomTypeId: string; name: string; quantity: number; unitPrice: number }[];
  totalAmount: number; depositAmount: number; status: RequestStatus;
  paymentInstructions: string; decisionNote: string; expiresAt: string | null;
  booking: { id: string; status: string } | null;
  // Follow-up emails attempted but not delivered yet (SMTP failures), most recent first.
  emails: { status: RequestStatus; attempts: number; lastError: string }[];
}
export async function fetchWebsiteRequests(status: RequestStatus | '', page: number) {
  return (await api.get<{ data: WebsiteRequest[]; total: number }>('/website-requests', { params: { status: status || undefined, page } })).data;
}
export async function fetchPendingWebsiteRequests() {
  return (await api.get<{ pending: number }>('/website-requests/pending-count')).data;
}
export async function processWebsiteRequest(input: { id: string; action: 'approve' | 'reject' | 'confirm'; paymentInstructions?: string; hours?: number; reason?: string }) {
  const { id, action, ...body } = input;
  await api.post(`/website-requests/${id}/${action}`, body);
}
