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
import { CreateCatalogueDto, UpdateCatalogueDto } from '../dto/product.dto';
import { Catalogue } from '../../../domain/entities/catalogue.entity';
import { UnregisteredProductError } from '../../../domain/exceptions/product.exceptions';
import {
  AssertOrganisationCanAccessCatalogueUseCase,
  CreateCatalogueUseCase,
  GetCatalogueUseCase,
  ListCataloguesUseCase,
  TransitionCatalogueWorkflowUseCase,
  UpdateCatalogueUseCase,
} from '../../../application/use-cases/catalogue.use-cases';

@Controller({ path: 'product/catalogues', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class CatalogueController {
  constructor(
    private readonly createCatalogueUseCase: CreateCatalogueUseCase,
    private readonly updateCatalogueUseCase: UpdateCatalogueUseCase,
    private readonly transitionCatalogueWorkflowUseCase: TransitionCatalogueWorkflowUseCase,
    private readonly getCatalogueUseCase: GetCatalogueUseCase,
    private readonly listCataloguesUseCase: ListCataloguesUseCase,
    private readonly assertOrganisationCanAccessCatalogueUseCase: AssertOrganisationCanAccessCatalogueUseCase,
  ) {}

  @Get()
  @Roles('kernel.admin')
  async list(@Query('includeNonPublies') includeNonPublies?: string) {
    const catalogues = await this.listCataloguesUseCase.execute({
      includeNonPublies: includeNonPublies === 'true',
    });
    return catalogues.map((c) => this.toResponse(c));
  }

  @Get(':id')
  @Roles('kernel.admin', 'org.owner')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const catalogue = await this.getCatalogueUseCase.execute(id);
    return this.toResponse(catalogue);
  }

  /**
   * KER-PRD : point d'entrée qui ferme réellement le contrôle de portée — une organisation
   * ne peut consulter, via cette route, que les catalogues auxquels elle a droit selon la
   * hiérarchie Org Registry (elle-même, une maison mère, ou un catalogue global/géographique).
   */
  @Get(':id/pour-organisation/:organisationId')
  @Roles('kernel.admin', 'org.owner')
  async getForOrganisation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
  ) {
    const catalogue = await this.assertOrganisationCanAccessCatalogueUseCase.execute(id, organisationId);
    return this.toResponse(catalogue);
  }

  @Post()
  @Roles('kernel.admin')
  @AuditAction('catalogue.created')
  async create(@Body() dto: CreateCatalogueDto) {
    try {
      return await this.createCatalogueUseCase.execute(dto);
    } catch (error) {
      if (error instanceof UnregisteredProductError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Patch(':id')
  @Roles('kernel.admin')
  @AuditAction('catalogue.updated')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogueDto,
  ): Promise<{ success: true }> {
    await this.updateCatalogueUseCase.execute(id, dto);
    return { success: true };
  }

  @Post(':id/workflow/validate')
  @Roles('kernel.admin')
  async validate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionCatalogueWorkflowUseCase.validate(id);
    return { success: true };
  }

  @Post(':id/workflow/reject-to-draft')
  @Roles('kernel.admin')
  async rejectToDraft(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionCatalogueWorkflowUseCase.rejectToDraft(id);
    return { success: true };
  }

  @Post(':id/workflow/publish')
  @Roles('kernel.admin')
  @AuditAction('catalogue.published')
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionCatalogueWorkflowUseCase.publish(id);
    return { success: true };
  }

  @Post(':id/workflow/archive')
  @Roles('kernel.admin')
  @AuditAction('catalogue.archived')
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionCatalogueWorkflowUseCase.archive(id);
    return { success: true };
  }

  private toResponse(catalogue: Catalogue) {
    const snapshot = catalogue.toSnapshot();
    return {
      id: snapshot.id,
      produitId: snapshot.produitId,
      nom: snapshot.nom,
      scopeType: snapshot.scope.getType(),
      scopeCibleId: snapshot.scope.getCibleId(),
      estActif: snapshot.estActif,
      statutWorkflow: snapshot.statutWorkflow,
      creeLe: snapshot.creeLe,
      modifieLe: snapshot.modifieLe,
    };
  }
}
