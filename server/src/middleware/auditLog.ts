import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from './auth';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const SENSITIVE_KEYS = ['password', 'newPassword', 'currentPassword'];

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return null;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of SENSITIVE_KEYS) {
    if (key in clone) clone[key] = '[REDACTED]';
  }
  return clone;
}

// Un segment ressemble à un id cuid() (ex: "cmt3d7goo0001gkrk1i42nf96") plutôt qu'à un mot-clé de
// route (ex: "generate", "status") — évite d'entretenir une liste d'exclusion de verbes d'URL.
const CUID_PATTERN = /^c[a-z0-9]{20,}$/i;

function parseResource(path: string): { resourceType: string | null; resourceId: string | null } {
  const segments = path.split('?')[0].replace(/^\/api\//, '').split('/').filter(Boolean);
  const resourceType = segments[0] ?? null;
  const resourceId = segments.slice(1).find(s => CUID_PATTERN.test(s)) ?? null;
  return { resourceType, resourceId };
}

// Capture générique de toute requête mutante authentifiée — voir le commentaire sur le modèle
// AuditLog dans schema.prisma. Écrit après la réponse (`res.on('finish')`) pour ne jamais
// ralentir ni faire échouer la requête réelle si l'écriture d'audit elle-même échoue.
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) { next(); return; }

  res.on('finish', () => {
    const authReq = req as AuthRequest;
    const { resourceType, resourceId } = parseResource(req.originalUrl);

    prisma.auditLog.create({
      data: {
        userId:       authReq.user?.id ?? null,
        method:       req.method,
        path:         req.originalUrl,
        resourceType,
        resourceId,
        statusCode:   res.statusCode,
        body:         sanitizeBody(req.body) as any,
      },
    }).catch(err => console.error('Échec de journalisation d\'audit :', err));
  });

  next();
}
