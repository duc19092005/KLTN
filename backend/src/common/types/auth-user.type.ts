import { UserRole } from '@prisma/client';

/**
 * The authenticated principal attached to `req.user` by JwtStrategy.validate().
 * Shared across modules so controllers/services/use-cases stop re-declaring local
 * `{ sub, role }` shapes and `@Req() req: any`.
 *
 * Optional fields mirror the JWT strategy payload; `role` is widened to `string`
 * to remain compatible with the previous local `AuthUser` definitions that used
 * `UserRole | string`.
 */
export type AuthUser = {
  sub: string;
  role: UserRole | string;
  username?: string;
  verified?: boolean;
  walletAddress?: string;
  firstLogin?: boolean;
  tokenVersion?: number;
  staffId?: string;
  shiftId?: string;
  staffName?: string;
};
