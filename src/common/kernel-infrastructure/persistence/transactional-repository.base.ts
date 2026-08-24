import { ObjectLiteral, Repository } from 'typeorm';
import { TransactionContextService } from './transaction-context.service';

/**
 * Classe de base pour tout repository TypeORM du noyau. Le principe est délibérément
 * minimal : exposer un getter `repo` qui résout soit l'EntityManager transactionnel ambiant
 * (si TransactionInterceptor a ouvert une transaction pour la requête HTTP en cours), soit le
 * repository par défaut injecté (hors requête, ou si aucune transaction n'est active).
 *
 * Bénéfice direct de ce choix : AUCUNE méthode existante de repository n'a besoin d'être
 * réécrite. Chaque classe concrète continue d'appeler `this.repo.findOne(...)`,
 * `this.repo.save(...)`, etc. exactement comme avant — seul le type de retour de `this.repo`
 * change dynamiquement selon le contexte. Le retrofit ne touche donc que le constructeur et
 * la clause `extends` de chaque classe, jamais le corps de ses méthodes métier.
 */
export abstract class TransactionalRepository<Entity extends ObjectLiteral> {
  protected constructor(
    private readonly defaultRepo: Repository<Entity>,
    private readonly transactionContext: TransactionContextService,
  ) {}

  protected get repo(): Repository<Entity> {
    const manager = this.transactionContext.getManager();
    return manager ? manager.getRepository<Entity>(this.defaultRepo.target) : this.defaultRepo;
  }
}
