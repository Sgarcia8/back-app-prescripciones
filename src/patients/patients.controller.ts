import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListPatientsQueryDto } from './dto/list-patients-query.dto';
import { PatientsService } from './patients.service';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  list(@Query() q: ListPatientsQueryDto) {
    return this.patients.list(q);
  }
}
