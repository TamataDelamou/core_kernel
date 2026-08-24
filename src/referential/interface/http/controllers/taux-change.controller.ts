import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { ResolveExchangeRateQueryDto, SetTauxChangeDto } from '../dto/referential.dto';
import {
  ResolveExchangeRateUseCase,
  SetTauxChangeUseCase,
} from '../../../application/use-cases/taux-change.use-cases';

@Controller({ path: 'referential/taux-change', version: '1' })
export class TauxChangeController {
  constructor(
    private readonly setTauxChangeUseCase: SetTauxChangeUseCase,
    private readonly resolveExchangeRateUseCase: ResolveExchangeRateUseCase,
  ) {}

  /**
   * KER-REF-04 : renvoie une 404 explicite (via NoValidExchangeRateError, traduite par le
   * filtre d'exception global) si aucun taux valide n'existe — jamais un taux 1:1 implicite.
   */
  @Get('resolve')
  async resolve(@Query() query: ResolveExchangeRateQueryDto) {
    const result = await this.resolveExchangeRateUseCase.execute({
      deviseBaseId: query.deviseBaseId,
      deviseCibleId: query.deviseCibleId,
      instant: query.instant ? new Date(query.instant) : undefined,
    });
    return {
      taux: result.taux,
      validDu: result.validDu.toISOString(),
      validAu: result.validAu?.toISOString() ?? null,
      source: result.source,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('taux_change.set')
  async set(@Body() dto: SetTauxChangeDto) {
    return this.setTauxChangeUseCase.execute({
      deviseBaseId: dto.deviseBaseId,
      deviseCibleId: dto.deviseCibleId,
      taux: dto.taux,
      validDu: new Date(dto.validDu),
      validAu: dto.validAu ? new Date(dto.validAu) : null,
      source: dto.source,
    });
  }
}
