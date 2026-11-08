import { prisma } from '../lib/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/AppError';
import { recordEvent } from './websiteEvent.service';
import { kickPush } from './staffPush.service';

export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_REQUEST = 5;
const INVALID = 'Fichier non accepté : envoyez une image (JPG, PNG, WebP) ou un PDF de 5 Mo maximum.';

// The declared Content-Type is not trusted: the file signature must match it. Never accept SVG/HTML,
// which a browser could execute when staff open the proof.
function matchesSignature(data: Buffer, mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg': return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case 'image/png': return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp': return data.subarray(0, 4).toString('latin1') === 'RIFF' && data.subarray(8, 12).toString('latin1') === 'WEBP';
    case 'application/pdf': return data.subarray(0, 5).toString('latin1') === '%PDF-';
    default: return false;
  }
}

const safeName = (name: string) => name.replace(/[\\/\r\n"<>]/g, '_').trim().slice(0, 120) || 'preuve';
export const proofMeta = { select: { id: true, fileName: true, mimeType: true, size: true, note: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } };

export async function upload(requestId: string, customerId: string, file: { data: unknown; mimeType: string; fileName: string; note: string }) {
  if (!Buffer.isBuffer(file.data) || !file.data.length || file.data.length > PROOF_MAX_BYTES || !matchesSignature(file.data, file.mimeType)) throw new BadRequestError(INVALID);
  const data = new Uint8Array(file.data);
  const created = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "WebsiteRequest" WHERE "id" = ${requestId} FOR UPDATE`;
    const request = await tx.websiteRequest.findUnique({ where: { id: requestId }, select: { customerId: true, status: true, expiresAt: true, _count: { select: { proofs: true } } } });
    if (!request || request.customerId !== customerId) throw new NotFoundError('Demande');
    if (request.status !== 'AWAITING_PAYMENT' || (request.expiresAt && request.expiresAt <= new Date())) throw new ConflictError('Vous pouvez envoyer une preuve uniquement pendant le délai de paiement.');
    if (request._count.proofs >= MAX_PER_REQUEST) throw new ConflictError(`${MAX_PER_REQUEST} preuves au maximum par demande. Supprimez-en une avant d’en ajouter.`);
    await recordEvent(tx, requestId, 'PROOF_UPLOADED');
    return tx.websitePaymentProof.create({ data: { requestId, fileName: safeName(file.fileName), mimeType: file.mimeType, size: data.byteLength, data, note: file.note }, select: proofMeta.select });
  });
  kickPush();
  return created;
}

export async function remove(requestId: string, proofId: string, customerId: string) {
  const proof = await prisma.websitePaymentProof.findUnique({ where: { id: proofId }, select: { requestId: true, request: { select: { customerId: true, status: true } } } });
  if (!proof || proof.requestId !== requestId || proof.request.customerId !== customerId) throw new NotFoundError('Preuve');
  // Once the stay is confirmed the proof is part of the payment record: only the hotel keeps it.
  if (proof.request.status !== 'AWAITING_PAYMENT') throw new ConflictError('Cette preuve ne peut plus être supprimée.');
  await prisma.websitePaymentProof.delete({ where: { id: proofId } });
}

export async function download(requestId: string, proofId: string) {
  const proof = await prisma.websitePaymentProof.findUnique({ where: { id: proofId } });
  if (!proof || proof.requestId !== requestId) throw new NotFoundError('Preuve');
  return proof;
}
