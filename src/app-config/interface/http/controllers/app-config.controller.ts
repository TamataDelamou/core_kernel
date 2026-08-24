import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard, AuthenticatedRequestUser } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../../../common/decorators/roles.decorator';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { GetAppConfigDto, UpdateConfigurationGlobaleDto } from '../dto/app-config.dto';
import { ResolveAppConfigUseCase } from '../../../application/use-cases/resolve-app-config.use-case';
import {
  GetConfigurationGlobaleUseCase,
  UpdateConfigurationGlobaleUseCase,
} from '../../../application/use-cases/configuration-globale.use-cases';
import {
  OrganisationNotFoundOrInactiveError,
  OrganisationNotInUserScopeError,
  UniteOperationnelleNotInOrganisationError,
} from '../../../domain/exceptions/app-config.exceptions';

/**
 * KER-CFG-02 : point d'entrée UNIQUE des applications clientes au démarrage — un seul appel,
 * jamais reconstruit indépendamment côté client. `gsgOrgId` est obligatoire et vérifié contre
 * le claim `gsgOrgIds` du jeton (jamais une organisation arbitraire), `uniteOperationnelleId`
 * optionnel pour le cas d'un utilisateur multi-agences qui précise son contexte actif.
 */
@Controller({ path: 'app-config', version: '1' })
export class AppConfigController {
  constructor(
    private readonly resolveAppConfigUseCase: ResolveAppConfigUseCase,
    private readonly getConfigurationGlobaleUseCase: GetConfigurationGlobaleUseCase,
    private readonly updateConfigurationGlobaleUseCase: UpdateConfigurationGlobaleUseCase,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async resolve(@Query() query: GetAppConfigDto, @CurrentUser() user: AuthenticatedRequestUser) {
    try {
      return await this.resolveAppConfigUseCase.execute({
        gsgId: user.gsgId,
        requestingUserGsgOrgIds: user.gsgOrgIds,
        gsgOrgId: query.gsgOrgId,
        uniteOperationnelleId: query.uniteOperationnelleId,
      });
    } catch (error) {
      if (error instanceof OrganisationNotInUserScopeError) {
        throw new ForbiddenException(error.message);
      }
      if (error instanceof OrganisationNotFoundOrInactiveError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof UniteOperationnelleNotInOrganisationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get('global')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  async getGlobal() {
    const configuration = await this.getConfigurationGlobaleUseCase.execute();
    return configuration.toSnapshot();
  }

  @Patch('global')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('kernel.admin')
  @UseInterceptors(AuditInterceptor)
  @AuditAction('configuration_globale.updated')
  async updateGlobal(@Body() dto: UpdateConfigurationGlobaleDto): Promise<{ success: true }> {
    await this.updateConfigurationGlobaleUseCase.execute(dto);
    return { success: true };
  }
}
