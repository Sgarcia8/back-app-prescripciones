import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListPatientsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where = q.query
      ? {
          user: {
            OR: [
              { email: { contains: q.query, mode: 'insensitive' as const } },
              { name: { contains: q.query, mode: 'insensitive' as const } },
            ],
          },
        }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.patient.count({ where }),
      this.prisma.patient.findMany({
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
