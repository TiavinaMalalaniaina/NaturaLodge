import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({ error: err.flatten() });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Ressource introuvable' }); return; }
    if (err.code === 'P2002') { res.status(409).json({ error: 'Conflit : valeur déjà utilisée' }); return; }
    if (err.code === 'P2003') { res.status(409).json({ error: 'Suppression impossible : des données liées existent encore' }); return; }
  }

  console.error(err.stack);
  res.status(500).json({ error: 'Erreur serveur interne' });
}
