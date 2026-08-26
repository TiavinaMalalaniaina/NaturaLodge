import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import { paymentListQuerySchema } from '../validation/payment.schema';
import * as paymentService from '../services/payment.service';

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);

paymentsRouter.get('/', can('payments.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = paymentListQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await paymentService.list(parsed.data));
}));
