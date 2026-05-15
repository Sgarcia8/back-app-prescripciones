import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: number;
  role: Role;
}

export type RequestUser = JwtPayload;
