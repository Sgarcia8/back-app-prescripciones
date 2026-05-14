import "dotenv/config";
import * as bcrypt from "bcrypt";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import type { PrescriptionStatus } from "../generated/prisma/client";

const SEED_EMAILS = ["admin@test.com", "dr@test.com", "patient@test.com"] as const;
const SEED_RX_PREFIX = "SEED-RX-";

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

function createPrisma(): { prisma: PrismaClient; pool: Pool } {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

async function wipeSeed(prisma: PrismaClient): Promise<void> {
  await prisma.prescriptionItem.deleteMany({
    where: { prescription: { code: { startsWith: SEED_RX_PREFIX } } },
  });
  await prisma.prescription.deleteMany({
    where: { code: { startsWith: SEED_RX_PREFIX } },
  });
  await prisma.doctor.deleteMany({
    where: { user: { email: { in: [...SEED_EMAILS] } } },
  });
  await prisma.patient.deleteMany({
    where: { user: { email: { in: [...SEED_EMAILS] } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: [...SEED_EMAILS] } },
  });
}

async function main(): Promise<void> {
  const { prisma, pool } = createPrisma();
  try {
    await prisma.$connect();
    console.info("Cleaning previous seed rows…");
    await wipeSeed(prisma);

    const [adminPw, doctorPw, patientPw] = await Promise.all([
      hashPassword("admin123"),
      hashPassword("dr123"),
      hashPassword("patient123"),
    ]);

    const admin = await prisma.user.create({
      data: {
        email: "admin@test.com",
        password: adminPw,
        name: "Admin Demo",
        role: "admin",
      },
    });
    const drUser = await prisma.user.create({
      data: {
        email: "dr@test.com",
        password: doctorPw,
        name: "Doctor Demo",
        role: "doctor",
      },
    });
    const patientUser = await prisma.user.create({
      data: {
        email: "patient@test.com",
        password: patientPw,
        name: "Paciente Demo",
        role: "patient",
      },
    });

    const doctor = await prisma.doctor.create({
      data: {
        userId: drUser.id,
        speciality: "Medicina general",
      },
    });
    const patient = await prisma.patient.create({
      data: {
        userId: patientUser.id,
        birthDate: new Date("1990-05-15"),
      },
    });

    type RxSeed = {
      codeSuffix: string;
      status: PrescriptionStatus;
      notes: string;
      createdDaysAgo: number;
      consumedDaysAgo?: number;
      items: { name: string; dosage?: string; quantity?: number; instructions?: string }[];
    };

    const defs: RxSeed[] = [
      {
        codeSuffix: "001",
        status: "pending",
        notes: "Reposo relativo por 3 días",
        createdDaysAgo: 1,
        items: [{ name: "Ibuprofeno", dosage: "400 mg", quantity: 10, instructions: "Cada 8 h si hay dolor" }],
      },
      {
        codeSuffix: "002",
        status: "pending",
        notes: "Hidratación abundante",
        createdDaysAgo: 3,
        items: [
          { name: "Paracetamol", dosage: "500 mg", quantity: 20, instructions: "Máximo 4 g/día" },
          { name: "Sales de rehidratación oral", quantity: 6, instructions: "Según necesidad" },
        ],
      },
      {
        codeSuffix: "003",
        status: "consumed",
        notes: "Tratamiento completado",
        createdDaysAgo: 14,
        consumedDaysAgo: 8,
        items: [{ name: "Amoxicilina", dosage: "500 mg", quantity: 14, instructions: "Cada 12 h hasta terminar el esquema" }],
      },
      {
        codeSuffix: "004",
        status: "pending",
        notes: "Control ambulatorio en 15 días",
        createdDaysAgo: 0,
        items: [{ name: "Óvulos emolientes oftámicos", dosage: "0.05%", quantity: 1, instructions: "1 gota oftálica c/8 h x 7 días" }],
      },
      {
        codeSuffix: "005",
        status: "consumed",
        notes: "Dolor lumbar mecánico",
        createdDaysAgo: 21,
        consumedDaysAgo: 17,
        items: [{ name: "Diclofenaco gel", dosage: "1%", quantity: 1, instructions: "Aplicar zona lumbar 3 veces al día" }],
      },
      {
        codeSuffix: "006",
        status: "pending",
        notes: "Refuerzo de hierro tras analítica",
        createdDaysAgo: 7,
        items: [{ name: "Sulfato ferroso", dosage: "80 mg", quantity: 30, instructions: "1 comp al día en ayunas" }],
      },
      {
        codeSuffix: "007",
        status: "consumed",
        notes: "Faringitis leve — curso terminado",
        createdDaysAgo: 28,
        consumedDaysAgo: 26,
        items: [{ name: "Azitromicina", dosage: "500 mg", quantity: 3, instructions: "1 comp diaria durante 3 días" }],
      },
      {
        codeSuffix: "008",
        status: "expired",
        notes: "Ventana temporal vencida; renovar valoración médica",
        createdDaysAgo: 180,
        items: [{ name: "Ranitidina", dosage: "150 mg", quantity: 28, instructions: "Obsoleto; solo ejemplo de seed histórico" }],
      },
    ];

    const msPerDay = 86_400_000;
    const now = Date.now();

    for (const def of defs) {
      const createdAt = new Date(now - def.createdDaysAgo * msPerDay);
      const consumedAt =
        def.status === "consumed" && def.consumedDaysAgo != null
          ? new Date(now - def.consumedDaysAgo * msPerDay)
          : undefined;

      await prisma.prescription.create({
        data: {
          code: `${SEED_RX_PREFIX}${def.codeSuffix}`,
          status: def.status,
          notes: def.notes,
          createdAt,
          consumedAt,
          patientId: patient.id,
          authorId: doctor.id,
          items: {
            create: def.items.map((item) => ({
              name: item.name,
              dosage: item.dosage,
              quantity: item.quantity ?? null,
              instructions: item.instructions ?? null,
            })),
          },
        },
      });
    }

    console.info(`Seed OK — admin id ${admin.id}, doctor id ${doctor.id}, patient id ${patient.id}, ${defs.length} prescripciones (${SEED_RX_PREFIX}*).`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
