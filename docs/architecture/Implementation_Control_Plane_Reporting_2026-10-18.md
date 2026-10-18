# Réalisation technique — reporting Control Plane interservices

**Dépôt :** `core_kernel`  
**Branche :** `feature/control-plane-reporting-ingestion-2026-10-18`  
**Date :** 18 octobre 2026  
**Statut :** implémentation du contrat serveur prête pour revue; activation opérationnelle et migration de base non effectuées.

## Résumé

Le dépôt Kernel reçoit maintenant un module séparé de reporting interservices. Il expose deux routes versionnées pour des audits applicatifs minimisés et des snapshots de métriques techniques. L’identité est distincte des JWT utilisateurs GSG ID : le guard exige un jeton de workload signé par une clé asymétrique récupérée par JWKS HTTPS, avec issuer, audience, sujet, durée courte, environnement, workload allowlisté et scopes indépendants.

Le reporting reste **désactivé par défaut**. Aucun token de service, issuer workload, JWKS de production, hôte d’application, credential ni certificat n’a été créé ou ajouté. La nouvelle migration SQL est additive et son fichier est généré, mais elle n’a pas été exécutée sur une base. Ainsi, aucun endpoint de reporting n’est ouvert et aucun événement n’est transmis en environnement réel à l’issue de cette tranche.

## Routes du contrat livré

| Méthode et route | Scope requis | Réponse nominale | Résultat |
|---|---|---|---|
| `POST /api/v1/control-plane/reporting/audit-events/batch` | `reporting.audit.write` | `202 Accepted`, `batchId`, nombre accepté/doublon | Déduplique par événement et vérifie que les doublons ont le même hash |
| `POST /api/v1/control-plane/reporting/metrics/snapshots/batch` | `reporting.metrics.write` | `202 Accepted`, `snapshotId` et statut | Un snapshot par `(source, instance, environnement, snapshotId)` |

Les DTO rejettent les propriétés inconnues via les pipes strictes de l’application, bornent les lots et limitent les dimensions. Les erreurs typées sont rendues en `400` (payload), `403` (source/identité) ou `409` (clé idempotente réutilisée avec un contenu différent). Une configuration valide ne donne pas automatiquement accès : le `sub`, `applicationId`, `instanceId` et `environment` doivent correspondre à une ligne explicite de `REPORTING_ALLOWED_WORKLOADS`, et le scope correspondant doit être présent.

## Persistance et rétention

La migration `src/reporting/infrastructure/persistence/migrations/1792336265207-InitControlPlaneReporting.ts` crée les tables isolées `reporting_audit_event` et `reporting_metric_snapshot`. Elle ajoute l’unicité scoped aux événements et snapshots, `schema_version`, la provenance et les dates de réception; elle ne modifie pas les tables d’audit métier internes au Kernel. La migration `down` ne supprime que ces deux tables.

Le service de rétention est inactif tant que le reporting n’est pas explicitement activé et que les deux durées ne sont pas renseignées. Les durées de rétention sont des paramètres d’environnement à déterminer et à approuver par le propriétaire du déploiement; aucune durée métier ou juridique n’est seedée dans la migration.

## Sécurité et minimisation

- Algorithmes admis par défaut : `RS256` et `ES256`; le JWT doit présenter `iss`, `aud`, `sub`, `exp`, `iat`, `token_use=workload`, identifiant d’application/instance, environnement et scope. Son âge maximal est cinq minutes.
- Le JWKS doit être HTTPS et son nom d’hôte appartenir à `REPORTING_JWKS_ALLOWED_HOSTS`. Le vérificateur n’utilise pas les secrets JWT de session des utilisateurs.
- L’allowlist de workloads et l’allowlist d’événements audit doivent être explicites avant activation. Les types inconnus sont refusés au use case.
- Les événements audit sont stockés avec hash canonique. Une répétition identique est idempotente; le même identifiant portant un autre contenu devient un conflit.
- Les métriques sont restreintes à une liste de noms/types/unités, une fenêtre ≤24 h, des valeurs bornées et des dimensions à vocabulaire limité. Les compteurs HTTP exigent route et classe de statut; les percentiles de durée ne portent que le groupe de route.
- Les payloads d’exception, champs libres, PII et données KYC ne sont pas admis par le DTO. Les lots et métriques conservent leur source et version de schéma.
- Les échecs ne journalisent ni corps ni jeton. Les refus ne deviennent pas des écritures partielles; le reporting ne change aucun flux d’identité, de référentiel ou de décision métier.

## Configuration requise pour un futur déploiement

L’exemple d’environnement reste inchangé. Avant activation, l’architecte/administrateur devra approuver et configurer, dans le gestionnaire de secrets du déploiement :

- `REPORTING_INGEST_ENABLED=true` seulement après mise en œuvre d’un issuer workload/PKI désigné;
- `REPORTING_JWT_ISSUER`, `REPORTING_JWT_JWKS_URL`, `REPORTING_JWT_AUDIENCE`, `REPORTING_JWKS_ALLOWED_HOSTS`;
- `REPORTING_ALLOWED_WORKLOADS` et `REPORTING_ALLOWED_AUDIT_EVENT_TYPES` pour chaque application/instance/environnement;
- les durées `REPORTING_AUDIT_RETENTION_DAYS` et `REPORTING_METRICS_RETENTION_DAYS`, ainsi que les limites de lots convenues;
- les permissions dashboard de lecture, séparées des scopes d’écriture.

**Blocage opérationnel restant :** aucun issuer de workload/PKI ni aucune source de jetons de service n’est actuellement désigné dans le dépôt. Le choix approuvé par la proposition reste : JWT asymétrique court si un issuer existant est disponible; sinon, mTLS géré par une PKI/service mesh approuvé. Ne pas activer le reporting avant que l’architecte ait confirmé ce point, fourni la configuration JWKS/issuer et la liste des workloads, puis validé la migration sur l’environnement cible.

## Contrôles exécutés

Sur `core_kernel` :

- `npm test -- --runInBand test/unit/reporting test/integration/reporting` — **8 suites, 33 tests réussis**;
- `npm test -- --runInBand` — **50 suites, 399 tests réussis**;
- `npm run build` — réussite.

Les tests couvrent la validation fail-closed, JWT RS256 réel avec JWKS en mémoire, scope/workload allowlist, rejet DTO, routage HTTP réel, fenêtres/mesures, unicité/rejeu, migration et rétention. La suite complète affiche le log d’erreur attendu d’un test d’échec de connexion outbox historique; le test passe.

## Décisions et actions de mise en service reportées

1. L’architecte Kernel désigne le fournisseur d’identité workload ou la PKI/mTLS existante; il n’y a pas de clé ni de token à partager par chat.
2. La gouvernance détermine la rétention, les événements de chaque produit qui peuvent être exportés et les lecteurs autorisés du dashboard.
3. La migration est revue puis exécutée uniquement sur un environnement cible approuvé.
4. Le contracteur applicatif TradeLink doit terminer son adaptateur/outbox et sa preuve E2E avant toute activation. Manus OAuth reste inchangé tant qu’un remplacement distinct n’est pas explicitement approuvé.

Aucune sélection de PSP, opération de paiement, modification du Score Business, seuil V1–V4, changement d’authentification utilisateur ou purge d’audit n’est couvert par ce livrable.
