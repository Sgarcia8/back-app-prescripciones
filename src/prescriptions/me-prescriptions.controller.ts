import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PatientPrescriptionsQueryDto } from './dto/list-prescriptions-query.dto';
import { PrescriptionsService } from './prescriptions.service';

@ApiTags('Me')
@ApiBearerAuth('JWT')
@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.patient)
export class MePrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get('prescriptions')
  @ApiOperation({ summary: 'Mis prescripciones (paciente)' })
  myPrescriptions(@CurrentUser() user: RequestUser, @Query() q: PatientPrescriptionsQueryDto) {
    return this.prescriptions.findAllForPatient(user.sub, q);
  }

  @Get('prescriptions/:id')
  @ApiOperation({ summary: 'Detalle de una de mis prescripciones' })
  @ApiParam({ name: 'id', type: Number })
  myPrescription(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.prescriptions.findOneForPatient(user.sub, id);
  }
}
