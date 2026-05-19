import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET;
const key = new TextEncoder().encode(secretKey);

export interface SessionPayload {
  [key: string]: string | undefined;
  sub: string;
  email: string;
  name: string;
  role: string;
  purpose?: string;
}

export async function encrypt(payload: SessionPayload, expiresIn = '24h') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string, maxAgeMs = 24 * 60 * 60 * 1000) {
  const expires = new Date(Date.now() + maxAgeMs);
  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires,
    sameSite: 'lax',
    path: '/',
  });
}

export async function createSession(payload: SessionPayload) {
  const session = await encrypt(payload);
  await setSessionCookie(session);
}

/** Long-lived token for switching between saved accounts on this device. */
export async function createAccountSwitchToken(payload: SessionPayload) {
  return encrypt({ ...payload, purpose: 'account_switch' }, '30d');
}

export async function verifyAccountSwitchToken(token: string, expectedAdminId: string) {
  const payload = await decrypt(token);
  if (!payload?.sub || payload.sub !== expectedAdminId) return null;
  if (payload.purpose !== 'account_switch') return null;
  return payload;
}

export async function verifySession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('session')?.value;
  const session = await decrypt(cookie);

  if (!session?.sub) {
    return null;
  }

  return {
    isAuth: true,
    adminId: session.sub,
    email: session.email,
    name: session.name,
    role: session.role || 'admin',
  };
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
