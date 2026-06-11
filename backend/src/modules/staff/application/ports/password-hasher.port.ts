/** DI token for the password hasher port. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/**
 * Boundary for password hashing, abstracting bcrypt out of the staff workflow.
 */
export interface PasswordHasherPort {
  hash(password: string): Promise<string>;
}
