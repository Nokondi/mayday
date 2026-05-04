import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRouteHandler<Req extends Request> = (
  req: Req,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler<Req extends Request = Request>(
  fn: AsyncRouteHandler<Req>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };
}
