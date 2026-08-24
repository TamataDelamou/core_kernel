import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { CreateVilleDto, MoveVilleDto } from '../dto/referential.dto';
import {
  CreateVilleUseCase,
  ListVillesByPaysUseCase,
  MoveVilleUseCase,
  SetVilleActivationUseCase,
} from '../../../application/use-cases/ville.use-cases';
import { UnpublishedHierarchicalNodeError, VilleNotFoundError } from '../../../domain/exceptions/referential.exceptions';

@Controller({ path: 'referential/villes', version: '1' })
export class VilleController {
  constructor(
    private readonly createVilleUseCase: CreateVilleUseCase,
    private readonly listVillesByPaysUseCase: ListVillesByPaysUseCase,
    private readonly setVilleActivationUseCase: SetVilleActivationUseCase,
    private readonly moveVilleUseCase: MoveVilleUseCase,
  ) {}

  @Get('par-pays/:paysId')
  async listByPays(@Param('paysId', ParseUUIDPipe) paysId: string) {
    const villes = await this.listVillesByPaysUseCase.execute(paysId);
    return villes.map((v) => v.toSnapshot());
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('ville.created')
  async create(@Body() dto: CreateVilleDto) {
    try {
      return await this.createVilleUseCase.execute(dto);
    } catch (error) {
      if (error instanceof UnpublishedHierarchicalNodeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.setVilleActivationUseCase.deactivate(id);
    return { success: true };
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.setVilleActivationUseCase.reactivate(id);
    return { success: true };
  }

  @Post(':id/deplacer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('ville.moved')
  async move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveVilleDto): Promise<{ success: true }> {
    try {
      await this.moveVilleUseCase.execute(id, dto.nouveauReferentielHierarchiqueId ?? null);
      return { success: true };
    } catch (error) {
      if (error instanceof VilleNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof UnpublishedHierarchicalNodeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
