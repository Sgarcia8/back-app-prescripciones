import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { PrescriptionStatus } from '@prisma/client';

export class DoctorPrescriptionsQueryDto {
  @ApiPropertyOptional({ description: 'Solo recetas del médico autenticado' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional({ enum: PrescriptionStatus })
  @IsOptional()
  @IsIn(Object.values(PrescriptionStatus))
  status?: PrescriptionStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    enum: ['createdAt.asc', 'createdAt.desc', 'id.asc', 'id.desc'],
    default: 'createdAt.desc',
  })
  @IsOptional()
  @IsIn(['createdAt.asc', 'createdAt.desc', 'id.asc', 'id.desc'])
  order = 'createdAt.desc';
}

export class PatientPrescriptionsQueryDto {
  @ApiPropertyOptional({ enum: PrescriptionStatus })
  @IsOptional()
  @IsIn(Object.values(PrescriptionStatus))
  status?: PrescriptionStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
