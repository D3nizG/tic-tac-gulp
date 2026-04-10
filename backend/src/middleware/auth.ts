import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

/**
 * Verifies Supabase JWT from Authorization header.
 * On success: attaches req.userId (Supabase user id) to the request.
 * On failure or missing token: continues without userId (guest mode).
 *
 * Usage:
 *   app.get('/protected', requireAuth, handler)  — fails without token
 *   app.get('/optional', optionalAuth, handler)  — userId may be null
 */

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

let _verifier: ReturnType<typeof createClient> | null = null;

function getVerifier() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!_verifier) {
    _verifier = createClient(url, key, { auth: { persistSession: false } });
  }
  return _verifier;
}

async function extractUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const supabase = getVerifier();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** Middleware: sets req.userId if a valid Supabase token is present. Never blocks. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.userId = (await extractUserId(req)) ?? undefined;
  next();
}

/** Middleware: requires a valid Supabase token. Returns 401 if missing or invalid. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = await extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.userId = userId;
  next();
}
