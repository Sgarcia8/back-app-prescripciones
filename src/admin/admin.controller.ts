import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminMetricsQueryDto,
  AdminPrescriptionsQueryDto,
} from '../prescriptions/dto/admin-prescriptions-query.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('prescriptions')
  listPrescriptions(@Query() q: AdminPrescriptionsQueryDto) {
    return this.admin.listPrescriptions(q);
  }

  @Get('metrics')
  metrics(@Query() q: AdminMetricsQueryDto) {
    return this.admin.getMetrics(q);
  }
}
