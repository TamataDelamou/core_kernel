import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { CreateGrilleTarifaireDto, ResolveActivePriceQueryDto } from '../dto/product.dto';
import {
  CreateGrilleTarifaireUseCase,
  ResolveActivePriceUseCase,
  TransitionGrilleTarifaireWorkflowUseCase,
} from '../../../application/use-cases/grille-tarifaire.use-cases';

@Controller({ path: 'product/offres/:offreId/grilles-tarifaires', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class GrilleTarifaireController {
  constructor(
    private readonly createGrilleTarifaireUseCase: CreateGrilleTarifaireUseCase,
    private readonly transitionGrilleTarifaireWorkflowUseCase: TransitionGrilleTarifaireWorkflowUseCase,
    private readonly resolveActivePriceUseCase: ResolveActivePriceUseCase,
  ) {}

  /**
   * KER-PRD : point d'entrée public de résolution du prix applicable — c'est ce que les
   * produits consommateurs (facturation, panier, etc.) appellent en pratique. Ne renvoie
   * jamais de valeur par défaut : 404 explicite si aucune grille publiée n'est effective.
   */
  @Get('prix-actif')
  @Roles('kernel.admin', 'org.owner')
  async resolveActivePrice(
    @Param('offreId', ParseUUIDPipe) offreId: string,
    @Query() query: ResolveActivePriceQueryDto,
  ) {
    return this.resolveActivePriceUseCase.execute({
      offreId,
      deviseId: query.deviseId,
      instant: query.instant ? new Date(query.instant) : undefined,
    });
  }

  @Post()
  @Roles('kernel.admin')
  @AuditAction('grille_tarifaire.created')
  async create(
    @Param('offreId', ParseUUIDPipe) offreId: string,
    @Body() dto: CreateGrilleTarifaireDto,
  ) {
    return this.createGrilleTarifaireUseCase.execute({
      offreId,
      deviseId: dto.deviseId,
      montantMinorUnit: dto.montantMinorUnit,
      periodeFacturation: dto.periodeFacturation,
      dateEffective: new Date(dto.dateEffective),
      dateFin: dto.dateFin ? new Date(dto.dateFin) : null,
    });
  }

  @Post(':grilleId/workflow/validate')
  @Roles('kernel.admin')
  async validate(@Param('grilleId', ParseUUIDPipe) grilleId: string): Promise<{ success: true }> {
    await this.transitionGrilleTarifaireWorkflowUseCase.validate(grilleId);
    return { success: true };
  }

  @Post(':grilleId/workflow/reject-to-draft')
  @Roles('kernel.admin')
  async rejectToDraft(@Param('grilleId', ParseUUIDPipe) grilleId: string): Promise<{ success: true }> {
    await this.transitionGrilleTarifaireWorkflowUseCase.rejectToDraft(grilleId);
    return { success: true };
  }

  @Post(':grilleId/workflow/publish')
  @Roles('kernel.admin')
  @AuditAction('grille_tarifaire.published')
  async publish(@Param('grilleId', ParseUUIDPipe) grilleId: string): Promise<{ success: true }> {
    await this.transitionGrilleTarifaireWorkflowUseCase.publish(grilleId);
    return { success: true };
  }

  @Post(':grilleId/workflow/archive')
  @Roles('kernel.admin')
  @AuditAction('grille_tarifaire.archived')
  async archive(@Param('grilleId', ParseUUIDPipe) grilleId: string): Promise<{ success: true }> {
    await this.transitionGrilleTarifaireWorkflowUseCase.archive(grilleId);
    return { success: true };
  }
}
