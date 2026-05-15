import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { DoctorPrescriptionsQueryDto } from './dto/list-prescriptions-query.dto';
import { PrescriptionsService } from './prescriptions.service';

@ApiTags('Prescriptions')
@ApiBearerAuth('JWT')
@Controller('prescriptions')
@UseGuards(JwtAuthGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear prescripción (médico autenticado)' })
  @UseGuards(RolesGuard)
  @Roles(Role.doctor)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePrescriptionDto) {
    return this.prescriptions.createForDoctor(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar prescripciones del médico' })
  @UseGuards(RolesGuard)
  @Roles(Role.doctor)
  findAllDoctor(@CurrentUser() user: RequestUser, @Query() q: DoctorPrescriptionsQueryDto) {
    return this.prescriptions.findAllForDoctor(user.sub, q);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar PDF de la receta (paciente dueño)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'PDF de la receta para descarga',
    schema: { type: 'string', format: 'binary' },
  })
  @UseGuards(RolesGuard)
  @Roles(Role.patient)
  async pdf(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const buf = await this.prescriptions.pdfForPatient(user.sub, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="prescription-${id}.pdf"`);
    res.send(buf);
  }

  @Put(':id/consume')
  @ApiOperation({ summary: 'Marcar prescripción como dispensada/consumida (paciente)' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(RolesGuard)
  @Roles(Role.patient)
  consume(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.prescriptions.consumeForPatient(user.sub, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de prescripción para el médico autor' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(RolesGuard)
  @Roles(Role.doctor)
  findOneDoctor(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.prescriptions.findOneForDoctor(user.sub, id);
  }
}
