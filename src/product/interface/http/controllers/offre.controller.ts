import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { CreateOffreDto, UpdateOffreDto } from '../dto/product.dto';
import {
  CreateOffreUseCase,
  ListOffresByProduitUseCase,
  TransitionOffreWorkflowUseCase,
  UpdateOffreUseCase,
} from '../../../application/use-cases/offre.use-cases';

@Controller({ path: 'product/offres', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class OffreController {
  constructor(
    private readonly createOffreUseCase: CreateOffreUseCase,
    private readonly updateOffreUseCase: UpdateOffreUseCase,
    private readonly transitionOffreWorkflowUseCase: TransitionOffreWorkflowUseCase,
    private readonly listOffresByProduitUseCase: ListOffresByProduitUseCase,
  ) {}

  @Get('par-produit/:produitId')
  @Roles('kernel.admin', 'org.owner')
  async listByProduit(@Param('produitId', ParseUUIDPipe) produitId: string) {
    const offres = await this.listOffresByProduitUseCase.execute(produitId);
    return offres.map((o) => o.toSnapshot());
  }

  @Post()
  @Roles('kernel.admin')
  @AuditAction('offre.created')
  async create(@Body() dto: CreateOffreDto) {
    return this.createOffreUseCase.execute(dto);
  }

  @Patch(':id')
  @Roles('kernel.admin')
  @AuditAction('offre.updated')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOffreDto,
  ): Promise<{ success: true }> {
    await this.updateOffreUseCase.execute(id, dto);
    return { success: true };
  }

  @Post(':id/workflow/validate')
  @Roles('kernel.admin')
  async validate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionOffreWorkflowUseCase.validate(id);
    return { success: true };
  }

  @Post(':id/workflow/reject-to-draft')
  @Roles('kernel.admin')
  async rejectToDraft(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionOffreWorkflowUseCase.rejectToDraft(id);
    return { success: true };
  }

  @Post(':id/workflow/publish')
  @Roles('kernel.admin')
  @AuditAction('offre.published')
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionOffreWorkflowUseCase.publish(id);
    return { success: true };
  }

  @Post(':id/workflow/archive')
  @Roles('kernel.admin')
  @AuditAction('offre.archived')
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionOffreWorkflowUseCase.archive(id);
    return { success: true };
  }
}
