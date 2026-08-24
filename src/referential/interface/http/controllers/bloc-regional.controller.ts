import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import {
  AddPaysToBlocRegionalDto,
  CreateBlocRegionalDto,
  WithdrawPaysFromBlocRegionalDto,
} from '../dto/referential.dto';
import {
  AddPaysToBlocRegionalUseCase,
  CreateBlocRegionalUseCase,
  ListBlocsRegionauxUseCase,
  TransitionBlocRegionalWorkflowUseCase,
  WithdrawPaysFromBlocRegionalUseCase,
} from '../../../application/use-cases/bloc-regional.use-cases';

@Controller({ path: 'referential/blocs-regionaux', version: '1' })
export class BlocRegionalController {
  constructor(
    private readonly createBlocRegionalUseCase: CreateBlocRegionalUseCase,
    private readonly transitionBlocRegionalWorkflowUseCase: TransitionBlocRegionalWorkflowUseCase,
    private readonly addPaysToBlocRegionalUseCase: AddPaysToBlocRegionalUseCase,
    private readonly withdrawPaysFromBlocRegionalUseCase: WithdrawPaysFromBlocRegionalUseCase,
    private readonly listBlocsRegionauxUseCase: ListBlocsRegionauxUseCase,
  ) {}

  @Get()
  async list(@Query('includeNonPublies') includeNonPublies?: string) {
    const blocs = await this.listBlocsRegionauxUseCase.execute({
      includeNonPublies: includeNonPublies === 'true',
    });
    return blocs.map((b) => b.toSnapshot());
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('bloc_regional.created')
  async create(@Body() dto: CreateBlocRegionalDto) {
    return this.createBlocRegionalUseCase.execute(dto);
  }

  @Post(':id/workflow/submit-for-review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async submitForReview(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionBlocRegionalWorkflowUseCase.submitForReview(id);
    return { success: true };
  }

  @Post(':id/workflow/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async validate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionBlocRegionalWorkflowUseCase.validate(id);
    return { success: true };
  }

  @Post(':id/workflow/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('bloc_regional.published')
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionBlocRegionalWorkflowUseCase.publish(id);
    return { success: true };
  }

  @Post('adhesions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('pays_bloc_regional.adhesion')
  async addPaysToBloc(@Body() dto: AddPaysToBlocRegionalDto) {
    return this.addPaysToBlocRegionalUseCase.execute({
      paysId: dto.paysId,
      blocRegionalId: dto.blocRegionalId,
      dateAdhesion: new Date(dto.dateAdhesion),
    });
  }

  @Post('adhesions/:relationId/retrait')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('pays_bloc_regional.retrait')
  async withdraw(
    @Param('relationId', ParseUUIDPipe) relationId: string,
    @Body() dto: WithdrawPaysFromBlocRegionalDto,
  ): Promise<{ success: true }> {
    await this.withdrawPaysFromBlocRegionalUseCase.execute(relationId, new Date(dto.dateRetrait));
    return { success: true };
  }
}
