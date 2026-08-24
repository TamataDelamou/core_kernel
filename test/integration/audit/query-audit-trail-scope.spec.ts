import { Test } from '@nestjs/testing';
import { QueryAuditTrailUseCase } from '../../../src/audit/application/use-cases/query-audit-trail.use-case';
import { AUDIT_EVENEMENT_REPOSITORY } from '../../../src/audit/domain/repositories/audit.repositories';
import { ORGANISATION_LOOKUP_PORT } from '../../../src/common/kernel-ports/organisation-lookup.port';
import {
  AuditTrailAccessDeniedError,
  AuditTrailScopeRequiredError,
} from '../../../src/audit/domain/exceptions/audit.exceptions';

const RESULTAT_VIDE = { elements: [], total: 0, page: 1, tailleParPage: 50 };

async function buildUseCase(isDescendantOrSelfMock: jest.Mock) {
  const queryTrailMock = jest.fn().mockResolvedValue(RESULTAT_VIDE);
  const moduleRef = await Test.createTestingModule({
    providers: [
      QueryAuditTrailUseCase,
      { provide: AUDIT_EVENEMENT_REPOSITORY, useValue: { queryTrail: queryTrailMock } },
      { provide: ORGANISATION_LOOKUP_PORT, useValue: { isDescendantOrSelf: isDescendantOrSelfMock } },
    ],
  }).compile();

  return { useCase: moduleRef.get(QueryAuditTrailUseCase), queryTrailMock };
}

describe('QueryAuditTrailUseCase (intégration application) — KER-AUD-01, fermeture de portée', () => {
  it('kernel.admin consulte SANS gsgOrgId, sans jamais interroger OrganisationLookupPort', async () => {
    const isDescendantOrSelfMock = jest.fn();
    const { useCase, queryTrailMock } = await buildUseCase(isDescendantOrSelfMock);

    await useCase.execute({
      requestingUserRoles: ['kernel.admin'],
      requestingUserGsgOrgIds: [],
      page: 1,
      tailleParPage: 50,
    });

    expect(isDescendantOrSelfMock).not.toHaveBeenCalled();
    expect(queryTrailMock).toHaveBeenCalledTimes(1);
  });

  it('kernel.admin peut filtrer par gsgOrgId (optionnel), toujours sans vérification de portée', async () => {
    const isDescendantOrSelfMock = jest.fn();
    const { useCase, queryTrailMock } = await buildUseCase(isDescendantOrSelfMock);

    await useCase.execute({
      requestingUserRoles: ['kernel.admin'],
      requestingUserGsgOrgIds: [],
      gsgOrgId: 'org-nimporte-laquelle',
      page: 1,
      tailleParPage: 50,
    });

    expect(isDescendantOrSelfMock).not.toHaveBeenCalled();
    expect(queryTrailMock).toHaveBeenCalledWith(
      expect.objectContaining({ gsgOrgId: 'org-nimporte-laquelle' }),
    );
  });

  it('REFUSE org.owner sans gsgOrgId — le scope est obligatoire pour ce rôle', async () => {
    const { useCase, queryTrailMock } = await buildUseCase(jest.fn());

    await expect(
      useCase.execute({
        requestingUserRoles: ['org.owner'],
        requestingUserGsgOrgIds: ['org-1'],
        page: 1,
        tailleParPage: 50,
      }),
    ).rejects.toThrow(AuditTrailScopeRequiredError);

    expect(queryTrailMock).not.toHaveBeenCalled();
  });

  it('autorise org.owner à consulter SA PROPRE organisation', async () => {
    const isDescendantOrSelfMock = jest.fn().mockResolvedValue(true);
    const { useCase, queryTrailMock } = await buildUseCase(isDescendantOrSelfMock);

    await useCase.execute({
      requestingUserRoles: ['org.owner'],
      requestingUserGsgOrgIds: ['org-1'],
      gsgOrgId: 'org-1',
      page: 1,
      tailleParPage: 50,
    });

    expect(isDescendantOrSelfMock).toHaveBeenCalledWith('org-1', 'org-1');
    expect(queryTrailMock).toHaveBeenCalledTimes(1);
  });

  it('autorise org.owner à consulter le journal d\'une FILIALE (héritage descendant)', async () => {
    const isDescendantOrSelfMock = jest.fn().mockResolvedValue(true);
    const { useCase, queryTrailMock } = await buildUseCase(isDescendantOrSelfMock);

    await useCase.execute({
      requestingUserRoles: ['org.owner'],
      requestingUserGsgOrgIds: ['org-mere'],
      gsgOrgId: 'org-filiale',
      page: 1,
      tailleParPage: 50,
    });

    expect(isDescendantOrSelfMock).toHaveBeenCalledWith('org-filiale', 'org-mere');
    expect(queryTrailMock).toHaveBeenCalledTimes(1);
  });

  it('REFUSE org.owner sur une organisation SANS AUCUN lien de filiation', async () => {
    const isDescendantOrSelfMock = jest.fn().mockResolvedValue(false);
    const { useCase, queryTrailMock } = await buildUseCase(isDescendantOrSelfMock);

    await expect(
      useCase.execute({
        requestingUserRoles: ['org.owner'],
        requestingUserGsgOrgIds: ['org-1'],
        gsgOrgId: 'org-sans-lien',
        page: 1,
        tailleParPage: 50,
      }),
    ).rejects.toThrow(AuditTrailAccessDeniedError);

    expect(queryTrailMock).not.toHaveBeenCalled();
  });

  it('vérifie CHAQUE organisation possédée avant de refuser (org.owner de plusieurs organisations)', async () => {
    const isDescendantOrSelfMock = jest
      .fn()
      .mockResolvedValueOnce(false) // org-1 → pas de lien
      .mockResolvedValueOnce(true); // org-2 → lien trouvé
    const { useCase, queryTrailMock } = await buildUseCase(isDescendantOrSelfMock);

    await useCase.execute({
      requestingUserRoles: ['org.owner'],
      requestingUserGsgOrgIds: ['org-1', 'org-2'],
      gsgOrgId: 'org-filiale-de-org-2',
      page: 1,
      tailleParPage: 50,
    });

    expect(isDescendantOrSelfMock).toHaveBeenCalledTimes(2);
    expect(queryTrailMock).toHaveBeenCalledTimes(1);
  });

  it('plafonne tailleParPage au maximum autorisé, quelle que soit la valeur demandée', async () => {
    const { useCase, queryTrailMock } = await buildUseCase(jest.fn());

    await useCase.execute({
      requestingUserRoles: ['kernel.admin'],
      requestingUserGsgOrgIds: [],
      page: 1,
      tailleParPage: 99999,
    });

    expect(queryTrailMock).toHaveBeenCalledWith(expect.objectContaining({ tailleParPage: 200 }));
  });
});
