import { Injectable } from '@nestjs/common';
import { Prisma, PrescriptionStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPrescriptionsQueryDto, AdminMetricsQueryDto } from '../prescriptions/dto/admin-prescriptions-query.dto';

export type PrescriptionSummaryFilters = {
  status?: PrescriptionStatus;
  doctorId?: number;
  patientId?: number;
  from?: Date;
  to?: Date;
};

@Injectable()
export class AdminMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  buildWhere(filters: PrescriptionSummaryFilters): Prisma.PrescriptionWhereInput {
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.doctorId != null ? { authorId: filters.doctorId } : {}),
      ...(filters.patientId != null ? { patientId: filters.patientId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };
  }

  async summary(where: Prisma.PrescriptionWhereInput) {
    const [doctorTotal, patientTotal, prescriptionFilteredTotal, statusGroups, topDoctors, dates] =
      await Promise.all([
        this.prisma.doctor.count(),
        this.prisma.patient.count(),
        this.prisma.prescription.count({ where }),
        this.prisma.prescription.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.prescription.groupBy({
          by: ['authorId'],
          where,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        this.prisma.prescription.findMany({
          where,
          select: { createdAt: true },
        }),
      ]);

    const byStatus: Record<string, number> = {
      pending: 0,
      consumed: 0,
      expired: 0,
    };
    for (const row of statusGroups) {
      byStatus[row.status] = row._count._all;
    }

    const byDayMap = new Map<string, number>();
    for (const row of dates) {
      const key = row.createdAt.toISOString().slice(0, 10);
      byDayMap.set(key, (byDayMap.get(key) ?? 0) + 1);
    }
    const byDay = [...byDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const topDoctorsResolved = await Promise.all(
      topDoctors.map(async (t) => ({
        doctorId: t.authorId,
        count: t._count.id,
      })),
    );

    return {
      totals: {
        doctors: doctorTotal,
        patients: patientTotal,
        prescriptions: prescriptionFilteredTotal,
      },
      byStatus,
      byDay,
      topDoctors: topDoctorsResolved,
    };
  }

  filtersFromPrescriptionsQuery(q: AdminPrescriptionsQueryDto): PrescriptionSummaryFilters {
    return {
      status: q.status,
      doctorId: q.doctorId,
      patientId: q.patientId,
      from: q.from,
      to: q.to,
    };
  }

  filtersFromMetricsQuery(q: AdminMetricsQueryDto): PrescriptionSummaryFilters {
    return {
      from: q.from,
      to: q.to,
    };
  }
}
