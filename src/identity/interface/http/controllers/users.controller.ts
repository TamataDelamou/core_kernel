import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  BadRequestException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../../../common/decorators/roles.decorator';
import { AuthenticatedRequestUser } from '../../../../common/guards/jwt-auth.guard';
import { AssignRoleDto, UpdateReferentielDto } from '../dto/identity.dto';
import {
  AssignRoleUseCase,
  UpdateUserReferentielUseCase,
} from '../../../application/use-cases/external-identity-and-profile.use-cases';
import { AuditAction, AuditInterceptor } from '../../../../common/interceptors/audit.interceptor';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/identity.repositories';
import { UserNotFoundError, InvalidOrganizationScopeError } from '../../../domain/exceptions/identity.exceptions';

@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
export class UsersController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly updateUserReferentielUseCase: UpdateUserReferentielUseCase,
    private readonly assignRoleUseCase: AssignRoleUseCase,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedRequestUser) {
    const domainUser = await this.userRepository.findByGsgId(user.gsgId);
    if (!domainUser) throw new NotFoundException('Utilisateur introuvable.');

    const snapshot = domainUser.toSnapshot();
    return {
      gsgId: snapshot.gsgId,
      email: snapshot.email?.toString() ?? null,
      emailVerifie: snapshot.emailVerifie,
      phone: snapshot.phone?.toString() ?? null,
      nomAffichage: snapshot.nomAffichage,
      statut: snapshot.statut,
      mfaActive: snapshot.mfaActive,
      referentiel: snapshot.referentiel,
      roles: user.roles,
    };
  }

  @Patch('me/referentiel')
  @AuditAction('user.referentiel_updated')
  async updateMyReferentiel(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: UpdateReferentielDto,
  ): Promise<{ success: true }> {
    await this.updateUserReferentielUseCase.execute(user.gsgId, dto);
    return { success: true };
  }

  @Post(':gsgId/roles')
  @Roles('kernel.admin', 'org.owner')
  @AuditAction('role.assigned')
  async assignRole(
    @Param('gsgId', ParseUUIDPipe) targetGsgId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() actor: AuthenticatedRequestUser,
  ): Promise<{ success: true }> {
    try {
      await this.assignRoleUseCase.execute({
        gsgId: targetGsgId,
        roleId: dto.roleId,
        gsgOrgId: dto.gsgOrgId ?? null,
        assignePar: actor.gsgId,
      });
      return { success: true };
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof InvalidOrganizationScopeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
