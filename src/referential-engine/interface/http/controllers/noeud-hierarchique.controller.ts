import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
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
import { CreateNoeudDto, ReattachNoeudDto, UpdateNoeudDto } from '../dto/referential-engine.dto';
import {
  CreateNoeudUseCase,
  QueryNoeudsUseCase,
  ReattachNoeudUseCase,
  SetNoeudActivationUseCase,
  TransitionNoeudWorkflowUseCase,
  UpdateNoeudUseCase,
} from '../../../application/use-cases/noeud-hierarchique.use-cases';
import {
  CircularReattachmentError,
  CrossCountryReattachmentError,
  NodeHasPublishedChildrenError,
} from '../../../domain/entities/noeud-hierarchique.entity';
import {
  NodeHasAttachedVillesError,
  NoeudHierarchiqueNotFoundError,
} from '../../../domain/exceptions/referential-engine.exceptions';

@Controller({ path: 'referential-engine/noeuds', version: '1' })
export class NoeudHierarchiqueController {
  constructor(
    private readonly createNoeudUseCase: CreateNoeudUseCase,
    private readonly updateNoeudUseCase: UpdateNoeudUseCase,
    private readonly transitionNoeudWorkflowUseCase: TransitionNoeudWorkflowUseCase,
    private readonly reattachNoeudUseCase: ReattachNoeudUseCase,
    private readonly setNoeudActivationUseCase: SetNoeudActivationUseCase,
    private readonly queryNoeudsUseCase: QueryNoeudsUseCase,
  ) {}

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const noeud = await this.queryNoeudsUseCase.getById(id);
    return noeud.toSnapshot();
  }

  @Get(':id/enfants')
  async listChildren(@Param('id', ParseUUIDPipe) id: string) {
    const enfants = await this.queryNoeudsUseCase.listChildren(id);
    return enfants.map((n) => n.toSnapshot());
  }

  @Get(':id/descendants')
  async listDescendants(@Param('id', ParseUUIDPipe) id: string) {
    const descendants = await this.queryNoeudsUseCase.listDescendants(id);
    return descendants.map((n) => n.toSnapshot());
  }

  @Get()
  async listByPaysEtDomaine(@Query('paysId', ParseUUIDPipe) paysId: string, @Query('codeDomaine') codeDomaine: string) {
    const noeuds = await this.queryNoeudsUseCase.listByPaysEtDomaine(paysId, codeDomaine ?? 'administratif');
    return noeuds.map((n) => n.toSnapshot());
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('noeud_hierarchique.created')
  async create(@Body() dto: CreateNoeudDto) {
    return this.createNoeudUseCase.execute({
      paysId: dto.paysId,
      codeDomaine: dto.codeDomaine ?? 'administratif',
      parentId: dto.parentId ?? null,
      appellationLocale: dto.appellationLocale,
      ordre: dto.ordre,
      estNoeudTerminal: dto.estNoeudTerminal,
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('noeud_hierarchique.updated')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoeudDto): Promise<{ success: true }> {
    await this.updateNoeudUseCase.execute(id, dto);
    return { success: true };
  }

  @Post(':id/workflow/submit-for-review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async submitForReview(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionNoeudWorkflowUseCase.submitForReview(id);
    return { success: true };
  }

  @Post(':id/workflow/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async validate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionNoeudWorkflowUseCase.validate(id);
    return { success: true };
  }

  @Post(':id/workflow/reject-to-draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async rejectToDraft(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionNoeudWorkflowUseCase.rejectToDraft(id);
    return { success: true };
  }

  @Post(':id/workflow/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('noeud_hierarchique.published')
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionNoeudWorkflowUseCase.publish(id);
    return { success: true };
  }

  @Post(':id/reattach')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('noeud_hierarchique.reattached')
  async reattach(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReattachNoeudDto): Promise<{ success: true }> {
    try {
      await this.reattachNoeudUseCase.execute(id, dto.nouveauParentId ?? null);
      return { success: true };
    } catch (error) {
      throw this.mapDomainError(error);
    }
  }

  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('noeud_hierarchique.deactivated')
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    try {
      await this.setNoeudActivationUseCase.deactivate(id);
      return { success: true };
    } catch (error) {
      throw this.mapDomainError(error);
    }
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.setNoeudActivationUseCase.reactivate(id);
    return { success: true };
  }

  private mapDomainError(error: unknown): unknown {
    if (error instanceof NoeudHierarchiqueNotFoundError) {
      return new NotFoundException((error as Error).message);
    }
    if (
      error instanceof NodeHasPublishedChildrenError ||
      error instanceof NodeHasAttachedVillesError ||
      error instanceof CircularReattachmentError ||
      error instanceof CrossCountryReattachmentError
    ) {
      return new BadRequestException((error as Error).message);
    }
    return error;
  }
}
