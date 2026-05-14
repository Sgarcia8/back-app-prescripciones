import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListUsersQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.query
        ? {
            OR: [
              { email: { contains: q.query, mode: 'insensitive' as const } },
              { name: { contains: q.query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          doctor: true,
          patient: true,
        },
      }),
    ]);

    return { data: rows, total, page, limit };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const password = await bcrypt.hash(dto.password, 10);
    const role = dto.role;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password,
        name: dto.name,
        role,
        ...(role === Role.doctor
          ? { doctor: { create: { speciality: dto.speciality } } }
          : {}),
        ...(role === Role.patient
          ? { patient: { create: { birthDate: dto.birthDate ?? undefined } } }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        doctor: true,
        patient: true,
      },
    });

    return user;
  }
}
