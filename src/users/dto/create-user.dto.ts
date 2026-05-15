import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength, IsDate } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'user@test.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password1', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Nombre' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: Role })
  @IsIn(['admin', 'doctor', 'patient'])
  role!: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  speciality?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  birthDate?: Date;
}
