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
import { CreateReferentielRegleDto, GouvernanceDto, UpdateReferentielRegleDto } from '../dto/referential-engine.dto';
import {
  CreateReferentielRegleUseCase,
  QueryReglesUseCase,
  SetRegleActivationUseCase,
  TransitionRegleWorkflowUseCase,
  UpdateReferentielRegleUseCase,
} from '../../../application/use-cases/referentiel-regle.use-cases';
import { RegleNotAttachedToTerminalNodeError } from '../../../domain/entities/referentiel-regle.entity';

@Controller({ path: 'referential-engine/regles', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('kernel.admin')
export class ReferentielRegleController {
  constructor(
    private readonly createReferentielRegleUseCase: CreateReferentielRegleUseCase,
    private readonly updateReferentielRegleUseCase: UpdateReferentielRegleUseCase,
    private readonly transitionRegleWorkflowUseCase: TransitionRegleWorkflowUseCase,
    private readonly setRegleActivationUseCase: SetRegleActivationUseCase,
    private readonly queryReglesUseCase: QueryReglesUseCase,
  ) {}

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const regle = await this.queryReglesUseCase.getById(id);
    return regle.toSnapshot();
  }

  @Get()
  async listByNoeud(@Query('noeudId', ParseUUIDPipe) noeudId: string) {
    const regles = await this.queryReglesUseCase.listByNoeud(noeudId);
    return regles.map((r) => r.toSnapshot());
  }

  @Post()
  @UseInterceptors(AuditInterceptor)
  @AuditAction('referentiel_regle.created')
  async create(@Body() dto: CreateReferentielRegleDto) {
    try {
      return await this.createReferentielRegleUseCase.execute(dto);
    } catch (error) {
      if (error instanceof RegleNotAttachedToTerminalNodeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch(':id')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('referentiel_regle.updated')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReferentielRegleDto,
  ): Promise<{ success: true }> {
    await this.updateReferentielRegleUseCase.updateDetails(id, dto);
    return { success: true };
  }

  @Patch(':id/gouvernance')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('referentiel_regle.gouvernance_updated')
  async updateGouvernance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GouvernanceDto,
  ): Promise<{ success: true }> {
    await this.updateReferentielRegleUseCase.updateGouvernance(id, dto);
    return { success: true };
  }

  @Post(':id/workflow/submit-for-review')
  async submitForReview(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionRegleWorkflowUseCase.submitForReview(id);
    return { success: true };
  }

  @Post(':id/workflow/validate')
  async validate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionRegleWorkflowUseCase.validate(id);
    return { success: true };
  }

  @Post(':id/workflow/reject-to-draft')
  async rejectToDraft(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionRegleWorkflowUseCase.rejectToDraft(id);
    return { success: true };
  }

  @Post(':id/workflow/publish')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('referentiel_regle.published')
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionRegleWorkflowUseCase.publish(id);
    return { success: true };
  }

  @Post(':id/deactivate')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('referentiel_regle.deactivated')
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.setRegleActivationUseCase.deactivate(id);
    return { success: true };
  }

  @Post(':id/reactivate')
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.setRegleActivationUseCase.reactivate(id);
    return { success: true };
  }
}
