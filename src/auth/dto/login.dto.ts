import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@test.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'admin123', minLength: 1 })
  @IsString()
  @MinLength(1)
  password!: string;
}
