import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, firstValueFrom, throwError } from 'rxjs';
import { TransactionInterceptor } from '../../../src/common/interceptors/transaction.interceptor';

function buildHttpContext(method: string): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method }),
    }),
  } as unknown as ExecutionContext;
}

function buildCallHandler(returnValue: unknown = { ok: true }): CallHandler {
  return { handle: () => of(returnValue) };
}

describe('TransactionInterceptor (unitaire) — Priorité 1, atomicité Outbox', () => {
  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
    'ouvre une transaction pour une requête %s',
    async (method) => {
      const runInTransactionMock = jest.fn().mockImplementation((work: () => Promise<unknown>) => work());
      const interceptor = new TransactionInterceptor({ runInTransaction: runInTransactionMock });

      const result$ = interceptor.intercept(buildHttpContext(method), buildCallHandler());
      await firstValueFrom(result$);

      expect(runInTransactionMock).toHaveBeenCalledTimes(1);
    },
  );

  it('n\'ouvre JAMAIS de transaction pour une requête GET', async () => {
    const runInTransactionMock = jest.fn();
    const interceptor = new TransactionInterceptor({ runInTransaction: runInTransactionMock });
    const handler = buildCallHandler();
    const handleSpy = jest.spyOn(handler, 'handle');

    const result$ = interceptor.intercept(buildHttpContext('GET'), handler);
    await firstValueFrom(result$);

    expect(runInTransactionMock).not.toHaveBeenCalled();
    expect(handleSpy).toHaveBeenCalledTimes(1);
  });

  it('n\'ouvre jamais de transaction hors contexte HTTP (ex. futur transport RPC/CLI)', async () => {
    const runInTransactionMock = jest.fn();
    const interceptor = new TransactionInterceptor({ runInTransaction: runInTransactionMock });
    const nonHttpContext = { getType: () => 'rpc' } as unknown as ExecutionContext;

    const result$ = interceptor.intercept(nonHttpContext, buildCallHandler());
    await firstValueFrom(result$);

    expect(runInTransactionMock).not.toHaveBeenCalled();
  });

  it('propage la valeur de retour du handler à travers la transaction', async () => {
    const runInTransactionMock = jest.fn().mockImplementation((work: () => Promise<unknown>) => work());
    const interceptor = new TransactionInterceptor({ runInTransaction: runInTransactionMock });

    const result$ = interceptor.intercept(buildHttpContext('POST'), buildCallHandler({ id: 'created-1' }));
    const result = await firstValueFrom(result$);

    expect(result).toEqual({ id: 'created-1' });
  });

  it('propage une erreur du handler pour déclencher le ROLLBACK côté TransactionManager', async () => {
    // Un CallHandler réel ne lève jamais d'exception synchrone : les échecs remontent comme
    // notification d'erreur de l'Observable — c'est ce que ce test reproduit fidèlement.
    const erreurMetier = new Error('violation de contrainte métier');
    const runInTransactionMock = jest.fn().mockImplementation((work: () => Promise<unknown>) => work());
    const interceptor = new TransactionInterceptor({ runInTransaction: runInTransactionMock });
    const handlerEnErreur: CallHandler = { handle: () => throwError(() => erreurMetier) };

    const result$ = interceptor.intercept(buildHttpContext('POST'), handlerEnErreur);
    await expect(firstValueFrom(result$)).rejects.toThrow('violation de contrainte métier');
  });
});
