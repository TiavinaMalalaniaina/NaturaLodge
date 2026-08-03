import { NextFunction, Request, Response } from 'express';

type AsyncRequestHandler<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler<Req extends Request = Request>(fn: AsyncRequestHandler<Req>) {
  return (req: Req, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
