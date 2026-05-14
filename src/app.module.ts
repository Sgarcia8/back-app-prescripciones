import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { DoctorsModule } from './doctors/doctors.module';
import { CommonModule } from './common/common.module';
import { PrescriptionsController } from './prescriptions/prescriptions.controller';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, PatientsModule, DoctorsModule, CommonModule],
  controllers: [AppController, PrescriptionsController],
  providers: [AppService],
})
export class AppModule {}
