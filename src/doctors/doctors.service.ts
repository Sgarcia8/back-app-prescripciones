import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListDoctorsQueryDto } from './dto/list-doctors-query.dto';

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListDoctorsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const where = {
      ...(q.speciality
        ? { speciality: { contains: q.speciality, mode: 'insensitive' as const } }
        : {}),
      ...(q.query
        ? {
            user: {
              OR: [
                { email: { contains: q.query, mode: 'insensitive' as const } },
                { name: { contains: q.query, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.doctor.count({ where }),
      this.prisma.doctor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
        include: { user: { select: { id: true, email: true, name: true, role: true } } },
      }),
    ]);

    return { data: rows, total, page, limit };
  }
}
