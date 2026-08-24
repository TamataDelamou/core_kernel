import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { CreateLocaleDto, UpdateLocaleDto } from '../dto/referential.dto';
import {
  CreateLocaleUseCase,
  ListLocalesUseCase,
  SetLocaleActivationUseCase,
  SetLocaleParDefautUseCase,
  UpdateLocaleUseCase,
} from '../../../application/use-cases/locale.use-cases';
import { InvalidLocaleCodeError } from '../../../domain/entities/locale-et-traduction.entity';
import { LocaleCodeAlreadyExistsError } from '../../../domain/exceptions/referential.exceptions';

@Controller({ path: 'referential/locales', version: '1' })
export class LocaleController {
  constructor(
    private readonly createLocaleUseCase: CreateLocaleUseCase,
    private readonly updateLocaleUseCase: UpdateLocaleUseCase,
    private readonly setLocaleParDefautUseCase: SetLocaleParDefautUseCase,
    private readonly setLocaleActivationUseCase: SetLocaleActivationUseCase,
    private readonly listLocalesUseCase: ListLocalesUseCase,
  ) {}

  @Get()
  async list(@Query('includeInactives') includeInactives?: string) {
    const locales = await this.listLocalesUseCase.execute({ includeInactives: includeInactives === 'true' });
    return locales.map((l) => l.toSnapshot());
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('locale.created')
  async create(@Body() dto: CreateLocaleDto) {
    try {
      return await this.createLocaleUseCase.execute(dto);
    } catch (error) {
      if (error instanceof InvalidLocaleCodeError || error instanceof LocaleCodeAlreadyExistsError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('locale.updated')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocaleDto): Promise<{ success: true }> {
    await this.updateLocaleUseCase.execute(id, dto);
    return { success: true };
  }

  @Post(':id/definir-par-defaut')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('locale.par_defaut_set')
  async setParDefaut(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.setLocaleParDefautUseCase.execute(id);
    return { success: true };
  }

  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.setLocaleActivationUseCase.deactivate(id);
    return { success: true };
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.setLocaleActivationUseCase.reactivate(id);
    return { success: true };
  }
}
