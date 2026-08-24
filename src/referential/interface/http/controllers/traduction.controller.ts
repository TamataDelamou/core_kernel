import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { CreateTraductionDto, UpdateTraductionDto } from '../dto/referential.dto';
import {
  CreateTraductionUseCase,
  ListTraductionsByLocaleUseCase,
  UpdateTraductionUseCase,
} from '../../../application/use-cases/traduction.use-cases';
import { TraductionKeyAlreadyExistsError } from '../../../domain/exceptions/referential.exceptions';

@Controller({ path: 'referential/traductions', version: '1' })
export class TraductionController {
  constructor(
    private readonly createTraductionUseCase: CreateTraductionUseCase,
    private readonly updateTraductionUseCase: UpdateTraductionUseCase,
    private readonly listTraductionsByLocaleUseCase: ListTraductionsByLocaleUseCase,
  ) {}

  @Get('par-locale/:localeId')
  async listByLocale(@Param('localeId', ParseUUIDPipe) localeId: string) {
    const traductions = await this.listTraductionsByLocaleUseCase.execute(localeId);
    return traductions.map((t) => t.toSnapshot());
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('traduction.created')
  async create(@Body() dto: CreateTraductionDto) {
    try {
      return await this.createTraductionUseCase.execute(dto);
    } catch (error) {
      if (error instanceof TraductionKeyAlreadyExistsError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('traduction.updated')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTraductionDto,
  ): Promise<{ success: true }> {
    await this.updateTraductionUseCase.execute(id, dto.valeur);
    return { success: true };
  }
}
