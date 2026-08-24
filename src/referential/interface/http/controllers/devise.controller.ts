import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { AttachDeviseToPaysDto, CreateDeviseDto } from '../dto/referential.dto';
import {
  AttachDeviseToPaysUseCase,
  CreateDeviseUseCase,
  ListDevisesUseCase,
  TransitionDeviseWorkflowUseCase,
} from '../../../application/use-cases/devise.use-cases';

@Controller({ path: 'referential/devises', version: '1' })
export class DeviseController {
  constructor(
    private readonly createDeviseUseCase: CreateDeviseUseCase,
    private readonly transitionDeviseWorkflowUseCase: TransitionDeviseWorkflowUseCase,
    private readonly attachDeviseToPaysUseCase: AttachDeviseToPaysUseCase,
    private readonly listDevisesUseCase: ListDevisesUseCase,
  ) {}

  @Get()
  async list(@Query('includeNonPubliees') includeNonPubliees?: string) {
    const devises = await this.listDevisesUseCase.execute({
      includeNonPubliees: includeNonPubliees === 'true',
    });
    return devises.map((d) => d.toSnapshot());
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('devise.created')
  async create(@Body() dto: CreateDeviseDto) {
    return this.createDeviseUseCase.execute(dto);
  }

  @Post(':id/workflow/submit-for-review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async submitForReview(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionDeviseWorkflowUseCase.submitForReview(id);
    return { success: true };
  }

  @Post(':id/workflow/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async validate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionDeviseWorkflowUseCase.validate(id);
    return { success: true };
  }

  @Post(':id/workflow/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('devise.published')
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionDeviseWorkflowUseCase.publish(id);
    return { success: true };
  }

  @Post('attach-to-pays')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('devise.attached_to_pays')
  async attachToPays(@Body() dto: AttachDeviseToPaysDto) {
    return this.attachDeviseToPaysUseCase.execute({
      paysId: dto.paysId,
      deviseId: dto.deviseId,
      dateDebut: new Date(dto.dateDebut),
      dateFin: dto.dateFin ? new Date(dto.dateFin) : null,
      devisePrincipale: dto.devisePrincipale,
    });
  }
}
