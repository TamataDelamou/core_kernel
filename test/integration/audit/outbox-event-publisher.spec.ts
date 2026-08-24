import { Test } from '@nestjs/testing';
import { OutboxEventPublisherService } from '../../../src/common/kernel-infrastructure/messaging/outbox-event-publisher.service';
import { OUTBOX_EVENT_REPOSITORY } from '../../../src/common/kernel-infrastructure/outbox/outbox-event.repository';

describe('OutboxEventPublisherService (intégration application) — Transactional Outbox', () => {
  it('insère une ligne outbox correspondant exactement à l\'événement publié', async () => {
    const insertMock = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        OutboxEventPublisherService,
        { provide: OUTBOX_EVENT_REPOSITORY, useValue: { insert: insertMock } },
      ],
    }).compile();

    const service = moduleRef.get(OutboxEventPublisherService);
    await service.publish({
      type: 'identity.user.registered',
      gsgOrgId: 'org-1',
      horodatage: '2026-01-01T00:00:00.000Z',
      produitSource: 'gsg-id',
      chargeUtile: { gsgId: 'user-1' },
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const inserted = insertMock.mock.calls[0][0];
    expect(inserted.type).toBe('identity.user.registered');
    expect(inserted.gsgOrgId).toBe('org-1');
    expect(inserted.produitSource).toBe('gsg-id');
    expect(inserted.chargeUtile).toEqual({ gsgId: 'user-1' });
    expect(inserted.id).toBeDefined(); // un identifiant propre à la ligne outbox, distinct de l'événement
  });

  it('n\'échoue JAMAIS le use-case appelant si l\'insertion outbox échoue (KER-VIS-04)', async () => {
    const insertMock = jest.fn().mockRejectedValue(new Error('connexion Postgres perdue'));
    const moduleRef = await Test.createTestingModule({
      providers: [
        OutboxEventPublisherService,
        { provide: OUTBOX_EVENT_REPOSITORY, useValue: { insert: insertMock } },
      ],
    }).compile();

    const service = moduleRef.get(OutboxEventPublisherService);

    // publish() ne doit jamais rejeter, quelle que soit l'erreur d'infrastructure sous-jacente
    // — un use-case métier ne doit jamais échouer à cause d'un problème de publication d'événement.
    await expect(
      service.publish({
        type: 'identity.user.registered',
        gsgOrgId: null,
        horodatage: new Date().toISOString(),
        produitSource: 'gsg-id',
        chargeUtile: {},
      }),
    ).resolves.toBeUndefined();
  });
});
