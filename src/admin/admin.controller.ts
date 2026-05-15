import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminMetricsQueryDto,
  AdminPrescriptionsQueryDto,
} from '../prescriptions/dto/admin-prescriptions-query.dto';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('prescriptions')
  @ApiOperation({ summary: 'Listado global de prescripciones (admin)' })
  listPrescriptions(@Query() q: AdminPrescriptionsQueryDto) {
    return this.admin.listPrescriptions(q);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas agregadas para dashboard admin' })
  metrics(@Query() q: AdminMetricsQueryDto) {
    return this.admin.getMetrics(q);
  }
}
