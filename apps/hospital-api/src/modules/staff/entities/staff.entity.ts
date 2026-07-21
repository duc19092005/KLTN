import { StaffProfile, User } from '@prisma/client';

export type StaffEntity = StaffProfile & {
  user?: Omit<User, 'passwordHash'>;
};
