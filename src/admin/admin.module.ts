import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminMetricsService],
})
export class AdminModule {}
