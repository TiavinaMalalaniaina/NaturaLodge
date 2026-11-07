import { api } from './client';

export type RequestStatus = 'PENDING' | 'AWAITING_PAYMENT' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
export interface WebsiteRequest {
  id: string; reference: string; name: string; email: string; phone: string; notes: string;
  arrival: string; departure: string; guests: number; createdAt: string;
  lines: { roomTypeId: string; name: string; quantity: number; unitPrice: number }[];
  totalAmount: number; depositAmount: number; status: RequestStatus;
  paymentInstructions: string; decisionNote: string; expiresAt: string | null;
  booking: { id: string; status: string } | null;
}
export async function fetchWebsiteRequests(status: RequestStatus | '', page: number) {
  return (await api.get<{ data: WebsiteRequest[]; total: number }>('/website-requests', { params: { status: status || undefined, page } })).data;
}
export async function processWebsiteRequest(input: { id: string; action: 'approve' | 'reject' | 'confirm'; paymentInstructions?: string; hours?: number; reason?: string }) {
  const { id, action, ...body } = input;
  await api.post(`/website-requests/${id}/${action}`, body);
}
