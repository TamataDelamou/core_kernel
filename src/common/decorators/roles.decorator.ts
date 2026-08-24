import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedRequestUser } from '../guards/jwt-auth.guard';

export const ROLES_METADATA_KEY = 'gsg_id:required_roles';

/**
 * Déclare les rôles requis pour accéder à un endpoint. Combiné à RolesGuard.
 * Exemple : @Roles('kernel.admin', 'org.owner')
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA_KEY, roles);

/**
 * Injecte l'utilisateur authentifié (résolu par JwtAuthGuard) dans le handler.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequestUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedRequestUser }>();
    return request.user;
  },
);
