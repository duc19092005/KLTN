import { Response } from 'express';
import { getAuthCookieOptions } from '../constants/auth-security';

export function setAuthCookie(res: Response, token?: string) {
  if (!token) return;
  res.cookie('token', token, getAuthCookieOptions());
}

export function stripToken<T extends { access_token?: string }>(result: T): Omit<T, 'access_token'> {
  const { access_token, ...publicResult } = result;
  return publicResult;
}

export function clientIp(req: any): string {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

export function rateLimitKey(req: any, action: string, subject: string) {
  const ip = clientIp(req);
  return `${action}:${ip}:${subject}`;
}