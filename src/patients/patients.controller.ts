import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';
import { PatientsService } from './patients.service';

@ApiTags('Patients')
@ApiBearerAuth('JWT')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin, Role.doctor)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar pacientes (admin o doctor)' })
  list(@Query() q: ListPatientsQueryDto) {
    return this.patients.list(q);
  }
}
