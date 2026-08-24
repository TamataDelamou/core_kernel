import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthenticatedRequestUser } from '../guards/jwt-auth.guard';
import { EVENT_PUBLISHER, EventPublisher } from '../kernel-ports/event-publisher.interface';

export const AUDIT_ACTION_METADATA_KEY = 'gsg_id:audit_action';

/**
 * Déclare le nom de l'action métier auditée pour un endpoint (ex. 'identity.user.registered').
 * Le nom respecte la convention type.entité.action utilisée par le bus d'événements (KER-EVT-01).
 */
export const AuditAction = (actionName: string): MethodDecorator =>
  SetMetadata(AUDIT_ACTION_METADATA_KEY, actionName);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const actionName = this.reflector.get<string | undefined>(
      AUDIT_ACTION_METADATA_KEY,
      context.getHandler(),
    );

    if (!actionName) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedRequestUser }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.eventPublisher.publish({
            type: `identity.${actionName}`,
            gsgOrgId: null, // GSG ID est transverse aux organisations ; renseigné par les use-cases quand pertinent.
            horodatage: new Date().toISOString(),
            produitSource: 'gsg-id',
            chargeUtile: {
              acteur: request.user?.gsgId ?? 'anonyme',
              methodeHttp: request.method,
              chemin: request.url,
              dureeMs: Date.now() - startedAt,
              statutHttp: context.switchToHttp().getResponse().statusCode,
            },
          });
        },
        // Un échec métier (4xx applicatif) n'est pas silencieusement ignoré : il est journalisé
        // par le filtre d'exception global, avec le même identifiant de corrélation d'audit.
      }),
    );
  }
}
