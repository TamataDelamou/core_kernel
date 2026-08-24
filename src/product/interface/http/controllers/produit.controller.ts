import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { CreateProduitDto, UpdateProduitDto } from '../dto/product.dto';
import {
  CreateProduitUseCase,
  ListProduitsByCatalogueUseCase,
  TransitionProduitWorkflowUseCase,
  UpdateProduitUseCase,
} from '../../../application/use-cases/produit.use-cases';

@Controller({ path: 'product/produits', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class ProduitController {
  constructor(
    private readonly createProduitUseCase: CreateProduitUseCase,
    private readonly updateProduitUseCase: UpdateProduitUseCase,
    private readonly transitionProduitWorkflowUseCase: TransitionProduitWorkflowUseCase,
    private readonly listProduitsByCatalogueUseCase: ListProduitsByCatalogueUseCase,
  ) {}

  @Get('par-catalogue/:catalogueId')
  @Roles('kernel.admin', 'org.owner')
  async listByCatalogue(@Param('catalogueId', ParseUUIDPipe) catalogueId: string) {
    const produits = await this.listProduitsByCatalogueUseCase.execute(catalogueId);
    return produits.map((p) => p.toSnapshot());
  }

  @Post()
  @Roles('kernel.admin')
  @AuditAction('produit.created')
  async create(@Body() dto: CreateProduitDto) {
    return this.createProduitUseCase.execute(dto);
  }

  @Patch(':id')
  @Roles('kernel.admin')
  @AuditAction('produit.updated')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProduitDto,
  ): Promise<{ success: true }> {
    await this.updateProduitUseCase.execute(id, dto);
    return { success: true };
  }

  @Post(':id/workflow/validate')
  @Roles('kernel.admin')
  async validate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionProduitWorkflowUseCase.validate(id);
    return { success: true };
  }

  @Post(':id/workflow/reject-to-draft')
  @Roles('kernel.admin')
  async rejectToDraft(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionProduitWorkflowUseCase.rejectToDraft(id);
    return { success: true };
  }

  @Post(':id/workflow/publish')
  @Roles('kernel.admin')
  @AuditAction('produit.published')
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionProduitWorkflowUseCase.publish(id);
    return { success: true };
  }

  @Post(':id/workflow/archive')
  @Roles('kernel.admin')
  @AuditAction('produit.archived')
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionProduitWorkflowUseCase.archive(id);
    return { success: true };
  }
}
