import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminMetricsQueryDto,
  AdminPrescriptionsQueryDto,
} from '../prescriptions/dto/admin-prescriptions-query.dto';
import { AdminMetricsService } from './admin-metrics.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminMetrics: AdminMetricsService,
  ) {}

  async listPrescriptions(q: AdminPrescriptionsQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where = this.adminMetrics.buildWhere(
      this.adminMetrics.filtersFromPrescriptionsQuery(q),
    );

    const [total, data, summary] = await Promise.all([
      this.prisma.prescription.count({ where }),
      this.prisma.prescription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          Patient: { include: { user: { select: { id: true, email: true, name: true } } } },
          author: { include: { user: { select: { id: true, email: true, name: true } } } },
        },
      }),
      this.adminMetrics.summary(where),
    ]);

    return { data, total, page, limit, summary };
  }

  async getMetrics(q: AdminMetricsQueryDto) {
    const where = this.adminMetrics.buildWhere(this.adminMetrics.filtersFromMetricsQuery(q));
    return this.adminMetrics.summary(where);
  }
}
