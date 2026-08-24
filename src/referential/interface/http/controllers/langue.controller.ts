import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { AttachLangueToPaysDto, CreateLangueDto } from '../dto/referential.dto';
import {
  AttachLangueToPaysUseCase,
  CreateLangueUseCase,
  ListLanguesUseCase,
  TransitionLangueWorkflowUseCase,
} from '../../../application/use-cases/langue.use-cases';

@Controller({ path: 'referential/langues', version: '1' })
export class LangueController {
  constructor(
    private readonly createLangueUseCase: CreateLangueUseCase,
    private readonly transitionLangueWorkflowUseCase: TransitionLangueWorkflowUseCase,
    private readonly attachLangueToPaysUseCase: AttachLangueToPaysUseCase,
    private readonly listLanguesUseCase: ListLanguesUseCase,
  ) {}

  @Get()
  async list(@Query('includeNonPubliees') includeNonPubliees?: string) {
    const langues = await this.listLanguesUseCase.execute({
      includeNonPubliees: includeNonPubliees === 'true',
    });
    return langues.map((l) => l.toSnapshot());
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('langue.created')
  async create(@Body() dto: CreateLangueDto) {
    return this.createLangueUseCase.execute(dto);
  }

  @Post(':id/workflow/submit-for-review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async submitForReview(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionLangueWorkflowUseCase.submitForReview(id);
    return { success: true };
  }

  @Post(':id/workflow/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async validate(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionLangueWorkflowUseCase.validate(id);
    return { success: true };
  }

  @Post(':id/workflow/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('langue.published')
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    await this.transitionLangueWorkflowUseCase.publish(id);
    return { success: true };
  }

  @Post('attach-to-pays')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('langue.attached_to_pays')
  async attachToPays(@Body() dto: AttachLangueToPaysDto) {
    return this.attachLangueToPaysUseCase.execute(dto);
  }
}
