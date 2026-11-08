import { api } from './client';

export type RequestStatus = 'PENDING' | 'AWAITING_PAYMENT' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export interface WebsiteRequest {
  id: string; reference: string; name: string; email: string; phone: string; notes: string;
  arrival: string; departure: string; guests: number; createdAt: string;
  lines: { roomTypeId: string; name: string; quantity: number; unitPrice: number }[];
  totalAmount: number; depositAmount: number; status: RequestStatus;
  locale: 'FR' | 'EN';
  paymentInstructions: string; decisionNote: string; expiresAt: string | null;
  booking: { id: string; status: string } | null;
  // Follow-up emails attempted but not delivered yet (SMTP failures), most recent first.
  emails: { status: RequestStatus; attempts: number; lastError: string }[];
  // Pending requests only: rooms still free per requested type (null otherwise).
  availability: { roomTypeId: string; name: string; requested: number; free: number }[] | null;
  proofs: ProofMeta[];
}
export interface ProofMeta { id: string; fileName: string; mimeType: string; size: number; note: string; createdAt: string }
export interface RoomOption { id: string; number: string; state: 'free' | 'booked' | 'maintenance'; bookedBy: string | null }
export interface RoomChoiceLine { roomTypeId: string; name: string; quantity: number; rooms: RoomOption[] }
export async function fetchRoomOptions(id: string) {
  return (await api.get<RoomChoiceLine[]>(`/website-requests/${id}/rooms`)).data;
}
export async function fetchWebsiteRequests(status: RequestStatus | '', page: number) {
  return (await api.get<{ data: WebsiteRequest[]; total: number }>('/website-requests', { params: { status: status || undefined, page } })).data;
}
export async function fetchPendingWebsiteRequests() {
  return (await api.get<{ pending: number; proofs: number }>('/website-requests/pending-count')).data;
}
export async function processWebsiteRequest(input: { id: string; action: 'approve' | 'reject' | 'confirm'; paymentInstructions?: string; hours?: number; roomIds?: string[]; reason?: string }) {
  const { id, action, ...body } = input;
  await api.post(`/website-requests/${id}/${action}`, body);
}
export interface PaymentMethod { id: string; label: string; account: string; holder: string; defaultSelected: boolean }
export interface PaymentSheet { methods: PaymentMethod[]; whatsapp: string; noteFr: string; noteEn: string }
export interface PaymentSheetView extends PaymentSheet { updatedAt: string | null; updatedBy: string | null }
export async function fetchPaymentSheet() {
  return (await api.get<PaymentSheetView>('/website-requests/payment-sheet')).data;
}
export async function savePaymentSheet(sheet: PaymentSheet) {
  return (await api.put<PaymentSheetView>('/website-requests/payment-sheet', sheet)).data;
}
// Fetched with the staff token (a plain link would not carry it), then shown from a blob URL.
export async function fetchProof(requestId: string, proofId: string) {
  return (await api.get<Blob>(`/website-requests/${requestId}/proofs/${proofId}`, { responseType: 'blob' })).data;
}
export interface WebsiteEvent {
  id: string; kind: 'REQUEST_RECEIVED' | 'PROOF_UPLOADED' | 'CANCELLED_BY_GUEST' | 'EXPIRED' | 'DEPOSIT_CONFIRMED'; createdAt: string;
  request: { id: string; name: string; arrival: string; departure: string; depositAmount: number; reference: string };
}
export async function fetchWebsiteEvents(after: string) {
  return (await api.get<WebsiteEvent[]>('/website-requests/events', { params: { after } })).data;
}
