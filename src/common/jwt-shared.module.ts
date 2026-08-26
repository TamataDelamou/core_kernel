import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

/**
 * `JwtAuthGuard` (common/guards/) est fourni comme provider par 6 modules distincts
 * (`audit`, `org`, `product`, `product-registry`, `referential`, `referential-engine`), et
 * injecte `JwtService`. Sans ce module partagé, chacun de ces 6 modules devait soit importer
 * `JwtModule.register({})` lui-même, soit importer `IdentityModule` juste pour obtenir
 * `JwtService` — aucun des deux n'avait été fait, provoquant un échec de démarrage de
 * `AppModule` entier (`Nest can't resolve dependencies of JwtAuthGuard`), invisible dans
 * tous les tests unitaires/d'intégration (qui mockent toujours des providers isolés, jamais
 * l'application complète) et détecté uniquement par `test:e2e`, qui boote `AppModule` en
 * entier — exactement la classe de bug que ce type de test existe pour attraper.
 *
 * `JwtModule.register({})` est enregistré VIDE ici comme partout ailleurs dans le projet :
 * chaque appel à `jwtService.signAsync`/`verifyAsync` fournit déjà son propre `secret` et ses
 * propres options explicitement (voir `jwt-token.service.ts`, `jwt-auth.guard.ts`) — la seule
 * chose que ce module apporte est l'instance injectable `JwtService` elle-même, rendue
 * disponible partout via `@Global()` plutôt que réimportée module par module.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  exports: [JwtModule],
})
export class JwtSharedModule {}
