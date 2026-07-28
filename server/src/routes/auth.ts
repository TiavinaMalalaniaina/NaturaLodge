import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { loginSchema } from '../validation/auth.schema';
import * as authService from '../services/auth.service';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await authService.login(parsed.data));
}));

authRouter.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await authService.getMe(req.user!.id));
}));
