import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { SessionUser, User } from '@/types';
import { dbStore } from './store';

const JWT_SECRET = process.env.JWT_SECRET || 'al-waseet-super-secure-production-key-2026-b2b-dist';
const COOKIE_NAME = 'al_waseet_session';

export function signToken(user: User): string {
  const payload: SessionUser = {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    assignedRoute: user.assignedRoute,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  if (decoded.role === 'admin' || decoded.username === 'admin' || decoded.id === 'usr_admin') {
    return {
      ...decoded,
      name: decoded.name || 'المدير العام',
    };
  }
  return decoded;
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
