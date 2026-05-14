import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrescriptionStatus, Prisma } from '../../generated/prisma/client';
import { randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import {
  DoctorPrescriptionsQueryDto,
  PatientPrescriptionsQueryDto,
} from './dto/list-prescriptions-query.dto';

const includeFull = {
  items: true,
  Patient: { include: { user: { select: { id: true, email: true, name: true } } } },
  author: { include: { user: { select: { id: true, email: true, name: true } } } },
} as const;

@Injectable()
export class PrescriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseOrder(order: string): Prisma.PrescriptionOrderByWithRelationInput {
    const [field, dir] = order.split('.') as [string, 'asc' | 'desc'];
    if (field !== 'createdAt' && field !== 'id') {
      return { createdAt: 'desc' };
    }
    return { [field]: dir } as Prisma.PrescriptionOrderByWithRelationInput;
  }

  async createForDoctor(userId: number, dto: CreatePrescriptionDto) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) {
      throw new ForbiddenException('Doctor profile required');
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const code = `RX-${randomUUID()}`;

    return this.prisma.prescription.create({
      data: {
        code,
        notes: dto.notes,
        authorId: doctor.id,
        patientId: dto.patientId,
        items: {
          create: dto.items.map((i) => ({
            name: i.name,
            dosage: i.dosage,
            quantity: i.quantity,
            instructions: i.instructions,
          })),
        },
      },
      include: includeFull,
    });
  }

  async findAllForDoctor(userId: number, q: DoctorPrescriptionsQueryDto) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) {
      throw new ForbiddenException('Doctor profile required');
    }

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: Prisma.PrescriptionWhereInput = {
      authorId: doctor.id,
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: q.from } : {}),
              ...(q.to ? { lte: q.to } : {}),
            },
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.prescription.count({ where }),
      this.prisma.prescription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.parseOrder(q.order ?? 'createdAt.desc'),
        include: includeFull,
      }),
    ]);

    return { data, total, page, limit };
  }

  async findOneForDoctor(userId: number, id: number) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) {
      throw new ForbiddenException('Doctor profile required');
    }

    const rx = await this.prisma.prescription.findFirst({
      where: { id, authorId: doctor.id },
      include: includeFull,
    });
    if (!rx) {
      throw new NotFoundException('Prescription not found');
    }
    return rx;
  }

  async findAllForPatient(userId: number, q: PatientPrescriptionsQueryDto) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) {
      throw new ForbiddenException('Patient profile required');
    }

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: Prisma.PrescriptionWhereInput = {
      patientId: patient.id,
      ...(q.status ? { status: q.status } : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.prescription.count({ where }),
      this.prisma.prescription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: includeFull,
      }),
    ]);

    return { data, total, page, limit };
  }

  async consumeForPatient(userId: number, id: number) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) {
      throw new ForbiddenException('Patient profile required');
    }

    const rx = await this.prisma.prescription.findFirst({
      where: { id, patientId: patient.id },
    });
    if (!rx) {
      throw new NotFoundException('Prescription not found');
    }
    if (rx.status !== PrescriptionStatus.pending) {
      throw new ConflictException('Prescription cannot be consumed');
    }

    return this.prisma.prescription.update({
      where: { id },
      data: { status: PrescriptionStatus.consumed, consumedAt: new Date() },
      include: includeFull,
    });
  }

  async pdfForPatient(userId: number, id: number): Promise<Buffer> {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) {
      throw new ForbiddenException('Patient profile required');
    }

    const rx = await this.prisma.prescription.findFirst({
      where: { id, patientId: patient.id },
      include: {
        items: true,
        author: { include: { user: { select: { name: true } } } },
      },
    });
    if (!rx) {
      throw new NotFoundException('Prescription not found');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Prescripción médica', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Código: ${rx.code}`);
      doc.text(`Estado: ${rx.status}`);
      doc.text(`Paciente ID: ${rx.patientId}`);
      doc.text(`Médico: ${rx.author.user.name}`);
      doc.text(`Fecha: ${rx.createdAt.toISOString()}`);
      if (rx.notes) {
        doc.moveDown();
        doc.text(`Notas: ${rx.notes}`);
      }
      doc.moveDown();
      doc.fontSize(12).text('Medicación', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      for (const item of rx.items) {
        doc.text(`• ${item.name}`, { continued: false });
        if (item.dosage) doc.text(`  Dosis: ${item.dosage}`);
        if (item.quantity != null) doc.text(`  Cantidad: ${item.quantity}`);
        if (item.instructions) doc.text(`  Indicaciones: ${item.instructions}`);
        doc.moveDown(0.3);
      }
      doc.end();
    });
  }
}
