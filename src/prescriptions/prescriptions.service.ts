import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrescriptionStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
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

  async findOneForPatient(userId: number, id: number) {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) {
      throw new ForbiddenException('Patient profile required');
    }

    const rx = await this.prisma.prescription.findFirst({
      where: { id, patientId: patient.id },
      include: includeFull,
    });
    if (!rx) {
      throw new NotFoundException('Prescription not found');
    }
    return rx;
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
        items: { orderBy: { id: 'asc' } },
        Patient: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        author: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!rx) {
      throw new NotFoundException('Prescription not found');
    }

    const baseRaw = process.env.FRONTEND_BASE_URL?.trim();
    const base = baseRaw?.replace(/\/+$/, '') ?? '';
    let qrPng: Buffer | null = null;
    if (base) {
      try {
        qrPng = await QRCode.toBuffer(`${base}/patient/prescriptions/${id}`, {
          type: 'png',
          width: 160,
          margin: 1,
        });
      } catch {
        qrPng = null;
      }
    }

    const locale = 'es-ES';
    const fechaEmision = rx.createdAt.toLocaleString(locale, {
      dateStyle: 'long',
      timeStyle: 'short',
    });
    const birthHuman = rx.Patient.birthDate
      ? rx.Patient.birthDate.toLocaleDateString(locale, { dateStyle: 'long' })
      : '—';

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Prescripción médica', { align: 'center' });
      doc.moveDown(1.2);

      doc.fontSize(12).font('Helvetica-Bold').text('Paciente');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Nombre: ${rx.Patient.user.name}`);
      doc.text(`Email: ${rx.Patient.user.email}`);
      doc.text(`Fecha de nacimiento: ${birthHuman}`);

      doc.moveDown(0.8);
      doc.fontSize(12).font('Helvetica-Bold').text('Médico');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Nombre: ${rx.author.user.name}`);
      doc.text(`Email: ${rx.author.user.email}`);
      doc.text(
        `Especialidad: ${rx.author.speciality?.trim() ? rx.author.speciality : '—'}`,
      );

      doc.moveDown(0.8);
      doc.fontSize(12).font('Helvetica-Bold').text('Prescripción');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Código: ${rx.code}`);
      doc.text(`Estado: ${rx.status}`);
      doc.text(`Fecha: ${fechaEmision}`);

      if (rx.notes?.trim()) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Notas clínicas:');
        doc.font('Helvetica').text(rx.notes, { align: 'left' });
      }

      doc.moveDown(0.9);
      doc.fontSize(12).font('Helvetica-Bold').text('Medicación');
      doc.font('Helvetica').fontSize(10);
      doc.moveDown(0.3);

      rx.items.forEach((item, i) => {
        doc.font('Helvetica-Bold').text(`${i + 1}. ${item.name}`);
        doc.font('Helvetica');
        doc.text(`Dosis: ${item.dosage ?? '—'}`, { indent: 12 });
        doc.text(`Cantidad: ${item.quantity != null ? String(item.quantity) : '—'}`, {
          indent: 12,
        });
        doc.text(`Instrucciones: ${item.instructions ?? '—'}`, { indent: 12 });
        doc.moveDown(0.45);
      });

      if (qrPng) {
        doc.moveDown(0.5);
        doc.fontSize(9).fillColor('#444444');
        doc.text('Consulta esta receta en la app (código QR):', { align: 'left' });
        doc.fillColor('#000000');
        const qrTop = doc.y + 4;
        doc.image(qrPng, 50, qrTop, { width: 120 });
        doc.text('', 50, qrTop + 128);
      }

      doc.end();
    });
  }
}
