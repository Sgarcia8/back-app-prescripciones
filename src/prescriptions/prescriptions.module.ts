import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MePrescriptionsController } from './me-prescriptions.controller';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';

@Module({
  imports: [AuthModule],
  controllers: [PrescriptionsController, MePrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
