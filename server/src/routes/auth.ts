import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { loginSchema } from '../validation/auth.schema';
import * as authService from '../services/auth.service';
import { resetPasswordSchema } from '../validation/resetPassword.schema';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await authService.login(parsed.data));
}));

authRouter.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await authService.getMe(req.user!.id));
}));

authRouter.patch('/reset-password', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = resetPasswordSchema.safeParse(req.body.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { token, password } = parsed.data;
  if (!token || !password) {
    res.status(400).json({ message: 'Token and new password are required' });
    return;
  }

  try {
    await authService.resetPassword(token, password);
    res.json({ message: 'Password reset successful' });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to reset password' });
  }
}));

authRouter.get('/verify-reset-token', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const token = req.query.token as string;
  if (!token) {
    res.status(400).json({ message: 'Token is required' });
    return;
  }

  try {
    const { user } = await authService.verifyResetToken(token);
    console.log('Token is valid for user:', user);
    res.json({ message: 'Token is valid', user });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Invalid or expired token' });
  }
}));
