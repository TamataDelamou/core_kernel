import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_EVENEMENT_REPOSITORY,
  AuditEvenementRepository,
  AuditTrailPage,
} from '../../domain/repositories/audit.repositories';
import {
  AuditTrailAccessDeniedError,
  AuditTrailScopeRequiredError,
} from '../../domain/exceptions/audit.exceptions';
import {
  ORGANISATION_LOOKUP_PORT,
  OrganisationLookupPort,
} from '../../../common/kernel-ports/organisation-lookup.port';

const TAILLE_PAGE_MAX = 200;
const ROLE_ADMIN_NOYAU = 'kernel.admin';

export interface QueryAuditTrailCommand {
  /** Rôles portés par le jeton de l'appelant (roles claim du JWT). */
  requestingUserRoles: string[];
  /** Organisations pour lesquelles l'appelant détient un rôle scopé (gsgOrgIds claim du JWT). */
  requestingUserGsgOrgIds: string[];
  gsgOrgId?: string;
  type?: string;
  depuis?: Date;
  jusqua?: Date;
  page: number;
  tailleParPage: number;
}

/**
 * KER-AUD-01 + fermeture du contrôle de portée multi-tenant (Priorité 2). Deux régimes :
 *
 *  - `kernel.admin` : vue transverse sans restriction — un `gsgOrgId` reste un filtre
 *    optionnel, jamais une contrainte imposée.
 *  - tout autre rôle autorisé à atteindre ce use-case (`org.owner`) : `gsgOrgId` devient
 *    OBLIGATOIRE, et doit correspondre à une organisation que l'appelant possède lui-même
 *    OU dont il possède une organisation mère (héritage descendant de la hiérarchie de
 *    filiales, même sémantique que le scope catalogue de Product Catalog) — vérifié via
 *    `OrganisationLookupPort.isDescendantOrSelf`, jamais par une simple comparaison de chaîne.
 */
@Injectable()
export class QueryAuditTrailUseCase {
  constructor(
    @Inject(AUDIT_EVENEMENT_REPOSITORY) private readonly auditEvenementRepository: AuditEvenementRepository,
    @Inject(ORGANISATION_LOOKUP_PORT) private readonly organisationLookupPort: OrganisationLookupPort,
  ) {}

  async execute(command: QueryAuditTrailCommand): Promise<AuditTrailPage> {
    const estAdminNoyau = command.requestingUserRoles.includes(ROLE_ADMIN_NOYAU);

    if (!estAdminNoyau) {
      if (!command.gsgOrgId) {
        throw new AuditTrailScopeRequiredError();
      }
      const autorise = await this.estDansLePerimetre(command.gsgOrgId, command.requestingUserGsgOrgIds);
      if (!autorise) {
        throw new AuditTrailAccessDeniedError(command.gsgOrgId);
      }
    }

    const tailleParPage = Math.min(command.tailleParPage, TAILLE_PAGE_MAX);
    return this.auditEvenementRepository.queryTrail({
      gsgOrgId: command.gsgOrgId,
      type: command.type,
      depuis: command.depuis,
      jusqua: command.jusqua,
      page: command.page,
      tailleParPage,
    });
  }

  private async estDansLePerimetre(gsgOrgIdDemande: string, gsgOrgIdsPossedes: string[]): Promise<boolean> {
    for (const possede of gsgOrgIdsPossedes) {
      const autorise = await this.organisationLookupPort.isDescendantOrSelf(gsgOrgIdDemande, possede);
      if (autorise) return true;
    }
    return false;
  }
}
