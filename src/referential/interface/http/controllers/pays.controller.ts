import {
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
import { CreatePaysDto, UpdatePaysDto } from '../dto/referential.dto';
import {
  CreatePaysUseCase,
  GetPaysUseCase,
  ListPaysUseCase,
  SetPaysActivationUseCase,
  TransitionPaysWorkflowUseCase,
  UpdatePaysUseCase,
} from '../../../application/use-cases/pays.use-cases';

/**
 * Lecture publique (données publiées uniquement) : tout produit du portefeuille peut
 * consommer ce référentiel sans authentification renforcée (KER-VIS-03 : API uniquement).
 * Écriture réservée au back-office transversal (KER-ENG-07) : rôle kernel.admin.
 */
@Controller({ path: 'referential/pays', version: '1' })
export class PaysController {
  constructor(
    private readonly createPaysUseCase: CreatePaysUseCase,
    private readonly updatePaysUseCase: UpdatePaysUseCase,
    private readonly transitionPaysWorkflowUseCase: TransitionPaysWorkflowUseCase,
    private readonly setPaysActivationUseCase: SetPaysActivationUseCase,
    private readonly listPaysUseCase: ListPaysUseCase,
    private readonly getPaysUseCase: GetPaysUseCase,
  ) {}

  @Get()
  async list(@Query('includeNonPublies') includeNonPublies?: string) {
    const pays = await this.listPaysUseCase.execute({
      includeNonPublies: includeNonPublies === 'true',
    });
    return pays.map((p) => p.toSnapshot());
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const pays = await this.getPaysUseCase.execute(id);
    return pays.toSnapshot();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('pays.created')
  async create(@Body() dto: CreatePaysDto) {
    return this.createPaysUseCase.execute(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('pays.updated')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePaysDto): Promise<{ success: true }> {
    await this.updatePaysUseCase.execute(id, dto);
    return { success: true };
  }

  @Post(':id/workflow/submit-for-review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async submitForReview(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionPaysWorkflowUseCase.submitForReview(id);
    return { success: true };
  }

  @Post(':id/workflow/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async validate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionPaysWorkflowUseCase.validate(id);
    return { success: true };
  }

  @Post(':id/workflow/reject-to-draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async rejectToDraft(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionPaysWorkflowUseCase.rejectToDraft(id);
    return { success: true };
  }

  @Post(':id/workflow/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('pays.published')
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionPaysWorkflowUseCase.publish(id);
    return { success: true };
  }

  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('pays.deactivated')
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.setPaysActivationUseCase.deactivate(id);
    return { success: true };
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.setPaysActivationUseCase.reactivate(id);
    return { success: true };
  }
}
