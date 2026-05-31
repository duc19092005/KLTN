import { SetMetadata } from '@nestjs/common';

export const STEPUP_ACTION_KEY = 'stepup:action';

/**
 * Marks a route handler as requiring a fresh face step-up ticket. The client must first obtain a
 * ticket via POST /auth/face-stepup (scoped to this same action) and replay it on the protected
 * request via the `x-stepup-ticket` header.
 *
 * @param action  Logical scope of the action, e.g. 'DELETE_DOCTOR' | 'ANCHOR_BLOCKCHAIN'. Must
 *                match the action the ticket was issued for.
 *
 * Resource binding: if the route has a `:id` (or `:seq`) param, FaceStepUpGuard binds the ticket
 * to that value automatically, so a ticket minted for one record cannot authorize another.
 */
export const RequireFaceStepUp = (action: string) => SetMetadata(STEPUP_ACTION_KEY, action);
