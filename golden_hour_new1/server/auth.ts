import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

const JWT_SECRET: string = (() => {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length > 0) {
    return process.env.SESSION_SECRET.trim();
  }
  console.warn(
    '[Auth] WARNING: SESSION_SECRET is not set. Generating a random 32-byte secret for this process (sessions will reset on restart).'
  );
  return crypto.randomBytes(32).toString('hex');
})();

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface UserSession {
  userId: string;
  role: 'admin' | 'nurse' | 'ambulance' | 'patient';
  name: string;
  badgeId?: string;
  hospitalId?: string; // Stored in session for nurses
  vehicleNo?: string;  // For ambulance pilots
  station?: string;
  admissionId?: string;
  caseId?: string;
  phone?: string;
  iat: number;
  exp: number;
}

// Scrypt password hashing
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const passwordSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, passwordSalt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt: passwordSalt,
  };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    if (keyBuffer.length !== hashBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, hashBuffer);
  } catch {
    return false;
  }
}

// Sign and verify HMAC session tokens
export function signToken(payload: Omit<UserSession, 'iat' | 'exp'>): string {
  const iat = Date.now();
  const exp = iat + TOKEN_EXPIRY_MS;
  const fullPayload: UserSession = { ...payload, iat, exp };

  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

export function verifyToken(token: string): UserSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: UserSession = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Extract session from cookie or Authorization header
export function getSessionFromRequest(req: Request): UserSession | null {
  // 1. Try modern Cookie
  const cookieToken = req.cookies?.golden_hour_session || req.cookies?.saarthi_session;
  if (cookieToken) {
    const session = verifyToken(cookieToken);
    if (session) return session;
  }

  // 2. Try Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    return verifyToken(token);
  }

  return null;
}

// Express Middleware: Require any valid authenticated user
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }
  (req as any).user = session;
  next();
}

// Express Middleware: Require specific role
export function requireRole(...allowedRoles: Array<UserSession['role']>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    }
    if (!allowedRoles.includes(session.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: role '${session.role}' is not authorized for this resource.`,
      });
    }
    (req as any).user = session;
    next();
  };
}
