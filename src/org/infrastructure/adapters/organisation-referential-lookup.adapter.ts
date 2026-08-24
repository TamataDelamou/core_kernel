import { Inject, Injectable } from '@nestjs/common';
import { OrganisationReferentialLookupPort } from '../../../common/kernel-ports/organisation-referential-lookup.port';
import { ReferentielNiveau } from '../../../common/kernel-ports/user-referential-lookup.port';
import {
  ORGANISATION_REPOSITORY,
  OrganisationRepository,
  UNITE_OPERATIONNELLE_REPOSITORY,
  UniteOperationnelleRepository,
} from '../../domain/repositories/org.repositories';

@Injectable()
export class OrganisationReferentialLookupAdapter implements OrganisationReferentialLookupPort {
  constructor(
    @Inject(ORGANISATION_REPOSITORY) private readonly organisationRepository: OrganisationRepository,
    @Inject(UNITE_OPERATIONNELLE_REPOSITORY)
    private readonly uniteOperationnelleRepository: UniteOperationnelleRepository,
  ) {}

  async getOrganisationReferentiel(gsgOrgId: string): Promise<ReferentielNiveau | null> {
    const organisation = await this.organisationRepository.findById(gsgOrgId);
    if (!organisation) return null;

    const referentiel = organisation.referentiel;
    return {
      paysId: referentiel.paysId,
      deviseId: referentiel.deviseId,
      langueId: referentiel.langueId,
      fuseauHoraire: referentiel.fuseauHoraire,
    };
  }

  async getUniteOperationnelleReferentiel(
    uniteOperationnelleId: string,
    gsgOrgId: string,
  ): Promise<ReferentielNiveau | null> {
    const unite = await this.uniteOperationnelleRepository.findById(uniteOperationnelleId);
    if (!unite || unite.organisationId !== gsgOrgId) return null;

    const snapshot = unite.toSnapshot();
    return {
      paysId: snapshot.referentiel.paysId,
      deviseId: snapshot.referentiel.deviseId,
      langueId: snapshot.referentiel.langueId,
      fuseauHoraire: snapshot.referentiel.fuseauHoraire,
    };
  }
}
