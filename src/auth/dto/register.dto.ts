import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsDate,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'nuevo@test.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password1', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Nombre Apellido' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: ['doctor', 'patient'] })
  @IsIn(['doctor', 'patient'])
  role!: 'doctor' | 'patient';

  @ApiPropertyOptional({ example: 'Medicina general' })
  @IsOptional()
  @IsString()
  speciality?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthDate?: Date;
}
