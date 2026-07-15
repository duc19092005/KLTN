import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../types/auth-user.type';

/**
 * Extracts the authenticated principal (req.user) attached by JwtStrategy.
 * Replaces the repeated `@Req() req: any` + `req.user` pattern in controllers
 * with a typed `@CurrentUser() user: AuthUser` parameter.
 *
 * Passing a property name returns just that field, e.g. `@CurrentUser('sub')`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
