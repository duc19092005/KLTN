import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
import { PasswordHasherPort } from '../../application/ports/password-hasher.port';

/**
 * bcrypt implementation of the password hasher port (cost factor 12), matching
 * the former StaffService.hashPassword().
 */
@Injectable()
export class BcryptPasswordHasher implements PasswordHasherPort {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
