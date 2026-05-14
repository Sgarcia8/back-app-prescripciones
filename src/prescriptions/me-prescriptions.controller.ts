import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PatientPrescriptionsQueryDto } from './dto/list-prescriptions-query.dto';
import { PrescriptionsService } from './prescriptions.service';

@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.patient)
export class MePrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get('prescriptions')
  myPrescriptions(@CurrentUser() user: RequestUser, @Query() q: PatientPrescriptionsQueryDto) {
    return this.prescriptions.findAllForPatient(user.sub, q);
  }
}
