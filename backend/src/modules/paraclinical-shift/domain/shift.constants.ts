/**
 * Domain constants for the paraclinical shift management feature.
 */

/** Minimum shift duration in hours. */
export const MIN_SHIFT_HOURS = 1;

/** Maximum shift duration in hours. */
export const MAX_SHIFT_HOURS = 24;

/** How far in advance (days) a shift can be registered. */
export const MAX_ADVANCE_REGISTRATION_DAYS = 60;

/** Temporary token TTL for the shared-account MFA flow (minutes). */
export const PARACLINICAL_TEMP_TOKEN_TTL_MINUTES = 5;
