import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../../../common/decorators/roles.decorator';
import { AuthenticatedRequestUser } from '../../../../common/guards/jwt-auth.guard';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { ListDeadLetterDto, QueryAuditTrailDto } from '../dto/audit.dto';
import { QueryAuditTrailUseCase } from '../../../application/use-cases/query-audit-trail.use-case';
import { ReplayDeadLetterUseCase } from '../../../application/use-cases/dead-letter.use-cases';
import { DEAD_LETTER_REPOSITORY, DeadLetterRepository } from '../../../domain/repositories/audit.repositories';
import {
  AuditTrailAccessDeniedError,
  AuditTrailScopeRequiredError,
  DeadLetterEntryAlreadyReplayedError,
  DeadLetterEntryNotFoundError,
} from '../../../domain/exceptions/audit.exceptions';

const PAGE_PAR_DEFAUT = 1;
const TAILLE_PAGE_PAR_DEFAUT = 50;

/**
 * KER-AUD-01, contrôle de portée multi-tenant fermé (Priorité 2) : kernel.admin garde une
 * vue transverse sans restriction ; org.owner est contraint par QueryAuditTrailUseCase à
 * fournir un gsgOrgId relevant explicitement de son propre périmètre (lui-même ou une de ses
 * filiales) — vérifié serveur, jamais laissé à la discrétion du paramètre de requête seul.
 */
@Controller({ path: 'audit', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class AuditController {
  constructor(
    private readonly queryAuditTrailUseCase: QueryAuditTrailUseCase,
    private readonly replayDeadLetterUseCase: ReplayDeadLetterUseCase,
    @Inject(DEAD_LETTER_REPOSITORY) private readonly deadLetterRepository: DeadLetterRepository,
  ) {}

  @Get('trail')
  @Roles('kernel.admin', 'org.owner')
  async queryTrail(@Query() query: QueryAuditTrailDto, @CurrentUser() user: AuthenticatedRequestUser) {
    try {
      const page = await this.queryAuditTrailUseCase.execute({
        requestingUserRoles: user.roles,
        requestingUserGsgOrgIds: user.gsgOrgIds,
        gsgOrgId: query.gsgOrgId,
        type: query.type,
        depuis: query.depuis ? new Date(query.depuis) : undefined,
        jusqua: query.jusqua ? new Date(query.jusqua) : undefined,
        page: query.page ?? PAGE_PAR_DEFAUT,
        tailleParPage: query.tailleParPage ?? TAILLE_PAGE_PAR_DEFAUT,
      });

      return {
        elements: page.elements.map((e) => e.toSnapshot()),
        total: page.total,
        page: page.page,
        tailleParPage: page.tailleParPage,
      };
    } catch (error) {
      if (error instanceof AuditTrailScopeRequiredError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof AuditTrailAccessDeniedError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }

  @Get('dead-letter')
  @Roles('kernel.admin')
  async listDeadLetter(@Query() query: ListDeadLetterDto) {
    const { elements, total } = await this.deadLetterRepository.list({
      page: query.page ?? PAGE_PAR_DEFAUT,
      tailleParPage: query.tailleParPage ?? TAILLE_PAGE_PAR_DEFAUT,
    });
    return { elements: elements.map((e) => e.toSnapshot()), total };
  }

  @Post('dead-letter/:id/replay')
  @Roles('kernel.admin')
  @AuditAction('dead_letter.replayed')
  async replay(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: true }> {
    try {
      await this.replayDeadLetterUseCase.execute(id);
      return { success: true };
    } catch (error) {
      if (error instanceof DeadLetterEntryNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof DeadLetterEntryAlreadyReplayedError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
