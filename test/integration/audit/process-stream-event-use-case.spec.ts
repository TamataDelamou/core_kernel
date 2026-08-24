import { Test } from '@nestjs/testing';
import { ProcessStreamEventUseCase, StreamMessage } from '../../../src/audit/application/use-cases/process-stream-event.use-case';
import { AUDIT_EVENEMENT_REPOSITORY } from '../../../src/audit/domain/repositories/audit.repositories';
import { InvalidStreamMessageError } from '../../../src/audit/domain/exceptions/audit.exceptions';

function buildMessage(overrides: Partial<StreamMessage> = {}): StreamMessage {
  return {
    outboxId: 'outbox-1',
    type: 'identity.user.registered',
    gsgOrgId: null,
    horodatage: new Date('2026-01-01T00:00:00Z').toISOString(),
    produitSource: 'gsg-id',
    chargeUtileBrute: JSON.stringify({ gsgId: 'user-1', password: 'ne-doit-jamais-apparaitre' }),
    ...overrides,
  };
}

async function buildUseCase(overrides: { existsMock?: jest.Mock; saveMock?: jest.Mock }) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      ProcessStreamEventUseCase,
      {
        provide: AUDIT_EVENEMENT_REPOSITORY,
        useValue: {
          existsByEvenementId: overrides.existsMock ?? jest.fn().mockResolvedValue(false),
          save: overrides.saveMock ?? jest.fn().mockResolvedValue(undefined),
        },
      },
    ],
  }).compile();

  return moduleRef.get(ProcessStreamEventUseCase);
}

describe('ProcessStreamEventUseCase (intégration application)', () => {
  it('persiste un message valide et jamais encore traité', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const useCase = await buildUseCase({ saveMock });

    await useCase.execute(buildMessage());

    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('rédige les champs sensibles avant persistance (KER-AUD-03)', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const useCase = await buildUseCase({ saveMock });

    await useCase.execute(buildMessage());

    const auditEvenement = saveMock.mock.calls[0][0];
    const snapshot = auditEvenement.toSnapshot();
    expect(snapshot.chargeUtile.password).toBe('[REDACTED]');
    expect(snapshot.chargeUtile.gsgId).toBe('user-1');
  });

  it('IDEMPOTENCE : ne persiste jamais deux fois le même evenementId (outboxId)', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined);
    const useCase = await buildUseCase({ existsMock: jest.fn().mockResolvedValue(true), saveMock });

    await useCase.execute(buildMessage());

    expect(saveMock).not.toHaveBeenCalled();
  });

  it('rejette un message sans outboxId sans jamais consulter le repository', async () => {
    const existsMock = jest.fn();
    const useCase = await buildUseCase({ existsMock });

    await expect(useCase.execute(buildMessage({ outboxId: '' }))).rejects.toThrow(
      InvalidStreamMessageError,
    );
    expect(existsMock).not.toHaveBeenCalled();
  });

  it('rejette une charge utile JSON malformée', async () => {
    const useCase = await buildUseCase({});

    await expect(
      useCase.execute(buildMessage({ chargeUtileBrute: '{invalide' })),
    ).rejects.toThrow(InvalidStreamMessageError);
  });

  it('rejette une charge utile qui n\'est pas un objet JSON (ex. tableau ou primitif)', async () => {
    const useCase = await buildUseCase({});

    await expect(
      useCase.execute(buildMessage({ chargeUtileBrute: '[1, 2, 3]' })),
    ).rejects.toThrow(InvalidStreamMessageError);

    await expect(
      useCase.execute(buildMessage({ chargeUtileBrute: '"juste-une-chaine"' })),
    ).rejects.toThrow(InvalidStreamMessageError);
  });
});
