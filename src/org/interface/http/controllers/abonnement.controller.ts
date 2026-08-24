import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { ResiliateAbonnementDto, SubscribeToProduitDto } from '../dto/org.dto';
import {
  ListAbonnementsByOrganisationUseCase,
  SubscribeToProduitUseCase,
  TransitionAbonnementUseCase,
} from '../../../application/use-cases/abonnement.use-cases';
import { UnregisteredProductError } from '../../../domain/exceptions/org.exceptions';

@Controller({ path: 'org/organisations/:organisationId/abonnements', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class AbonnementController {
  constructor(
    private readonly subscribeToProduitUseCase: SubscribeToProduitUseCase,
    private readonly transitionAbonnementUseCase: TransitionAbonnementUseCase,
    private readonly listAbonnementsByOrganisationUseCase: ListAbonnementsByOrganisationUseCase,
  ) {}

  @Get()
  @Roles('kernel.admin', 'org.owner')
  async list(@Param('organisationId', ParseUUIDPipe) organisationId: string) {
    const abonnements = await this.listAbonnementsByOrganisationUseCase.execute(organisationId);
    return abonnements.map((a) => a.toSnapshot());
  }

  @Post()
  @Roles('kernel.admin')
  @AuditAction('abonnement.created')
  async subscribe(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Body() dto: SubscribeToProduitDto,
  ) {
    try {
      return await this.subscribeToProduitUseCase.execute({
        organisationId,
        produitId: dto.produitId,
        dateDebut: new Date(dto.dateDebut),
      });
    } catch (error) {
      if (error instanceof UnregisteredProductError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post(':abonnementId/suspend')
  @Roles('kernel.admin')
  @AuditAction('abonnement.suspended')
  async suspend(@Param('abonnementId', ParseUUIDPipe) abonnementId: string): Promise<{ success: true }> {
    await this.transitionAbonnementUseCase.suspend(abonnementId);
    return { success: true };
  }

  @Post(':abonnementId/reactivate')
  @Roles('kernel.admin')
  @AuditAction('abonnement.reactivated')
  async reactivate(@Param('abonnementId', ParseUUIDPipe) abonnementId: string): Promise<{ success: true }> {
    await this.transitionAbonnementUseCase.reactivate(abonnementId);
    return { success: true };
  }

  @Post(':abonnementId/resiliate')
  @Roles('kernel.admin')
  @AuditAction('abonnement.resiliated')
  async resiliate(
    @Param('abonnementId', ParseUUIDPipe) abonnementId: string,
    @Body() dto: ResiliateAbonnementDto,
  ): Promise<{ success: true }> {
    await this.transitionAbonnementUseCase.resiliate(abonnementId, new Date(dto.dateFin));
    return { success: true };
  }
}
