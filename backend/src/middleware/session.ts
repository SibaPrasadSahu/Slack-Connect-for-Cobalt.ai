import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type SessionUser = { teamId: string; userId: string };

declare global {
  namespace Express {
    interface Request {
      sessionUser?: SessionUser | null;
    }
  }
}

export function attachSession(req: Request, _res: Response, next: NextFunction) {
  const cookie = req.cookies?.ss_session;
  if (!cookie) {
    req.sessionUser = null;
    return next();
  }
  try {
    const payload = jwt.verify(cookie, process.env.JWT_SECRET!) as SessionUser;
    req.sessionUser = payload;
  } catch {
    req.sessionUser = null;
  }
  next();
}
