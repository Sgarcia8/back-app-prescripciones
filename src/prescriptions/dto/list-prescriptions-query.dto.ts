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
import { PrescriptionStatus } from '../../../generated/prisma/client';

export class DoctorPrescriptionsQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  mine?: boolean;

  @IsOptional()
  @IsIn(Object.values(PrescriptionStatus))
  status?: PrescriptionStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(['createdAt.asc', 'createdAt.desc', 'id.asc', 'id.desc'])
  order = 'createdAt.desc';
}

export class PatientPrescriptionsQueryDto {
  @IsOptional()
  @IsIn(Object.values(PrescriptionStatus))
  status?: PrescriptionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
