import { Role } from '../../generated/prisma/client';

export interface JwtPayload {
  sub: number;
  role: Role;
}

export type RequestUser = JwtPayload;
