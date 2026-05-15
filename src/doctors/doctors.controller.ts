import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListDoctorsQueryDto } from './dto/list-doctors-query.dto';
import { DoctorsService } from './doctors.service';

@ApiTags('Doctors')
@ApiBearerAuth('JWT')
@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar médicos' })
  list(@Query() q: ListDoctorsQueryDto) {
    return this.doctors.list(q);
  }
}
