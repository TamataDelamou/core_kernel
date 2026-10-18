# Proposition d’architecture — Control Plane GSG et reporting interservices

**Dépôt :** `TamataDelamou/core_kernel`  
**Date :** 18 octobre 2026  
**Version :** 0.1 — **soumise à validation, non implémentée**  
**Branche de travail :** `proposal/control-plane-reporting-contract-2026-10-18`

## 1. Décision proposée

Faire évoluer le Kernel vers un **Control Plane centralisé** pour l’administration globale, la supervision et l’agrégation de reporting, tout en déplaçant les services de données opérationnels (identité/session, référentiels de base) vers leurs propriétaires dédiés.

La migration doit être **additive et par étapes**. On ne supprime ni module, ni route, ni table, ni mécanisme de session avant que son remplaçant soit en service et que tous ses consommateurs aient migré. La proposition conserve l’authentification Manus actuelle de TradeLink pendant toute la transition : le code audité ne s’authentifie pas auprès du Kernel et aucun remplacement d’identité n’est encore défini.

Le modèle recommandé sépare deux flux :

1. **Push asynchrone vers le Kernel** pour les événements d’audit filtrés et les instantanés de métriques, à partir d’une outbox locale et avec reprise/idempotence.
2. **Pull limité depuis le tableau de bord Kernel** pour un résumé de santé/métriques agrégées d’une instance, via une route dédiée et une identité machine; jamais au travers des routes métier ou d’une session d’utilisateur.

L’ingestion centrale ne devient pas la source de vérité de l’audit métier de l’application. Chaque application conserve son audit local faisant autorité et transmet au Control Plane une projection minimisée, uniquement selon une politique de données approuvée.

## 2. État observé dans les dépôts — référence pour la migration

### `core_kernel` (branche `main`, état vérifié le 18 octobre 2026)

- Le README présente **GSG ID — Identité et authentification fédérée** comme premier module codé, et énumère les routes `/v1/auth/*`, `/v1/users/*`, le référentiel profil et `/v1/audit/trail` (`README.md:1-9, 148-162`).
- `src/app.module.ts:8-17` charge encore les modules Identity, Referential, Org, Product, Audit, Referential Engine, Product Registry et App Config. L’application n’est donc pas encore un Control Plane exclusif.
- Le bootstrap impose le préfixe global `api` et la version URI `1` (`src/main.ts:34-35`). Les routes proposées ci-dessous doivent respecter `/api/v1/...` et être décrites dans un contrat OpenAPI.
- L’audit actuel consomme les événements Redis Streams et garde une dead-letter queue (`src/audit/audit.module.ts:30-50`, `src/audit/infrastructure/messaging/redis-streams-consumer.service.ts`). Le contrôleur expose une **consultation** paginée `/v1/audit/trail`, protégée par `JwtAuthGuard` et des rôles d’utilisateur (`src/audit/interface/http/controllers/audit.controller.ts:40-80`). Ce n’est pas un endpoint d’ingestion depuis une application, ni une identité machine.
- Le Kernel dispose d’un port `KernelEvent`/`EventPublisher` (`src/common/kernel-ports/event-publisher.interface.ts:12-28`) et d’une outbox PostgreSQL → Redis avec retry (`src/common/kernel-infrastructure/messaging/outbox-event-publisher.service.ts`, `src/common/kernel-infrastructure/outbox/outbox-relay.service.ts`). Cette chaîne est interne au Kernel; elle ne publie pas encore vers une instance cliente.
- `JwtAuthGuard` valide les JWT utilisateur avec un secret, issuer, audience et des rôles (`src/common/guards/jwt-auth.guard.ts:27-63`). Il n’existe pas de garde distincte d’identité machine, de scopes interservices, de configuration mTLS ni de module de métriques trouvé dans l’état observé.
- Aucun contrat OpenAPI, endpoint d’ingestion du reporting, URL de Control Plane ou mécanisme d’identité workload prêt à configurer n’a été trouvé dans la branche `main` consultée.

### TradeLink (dépôt et branche produit audités)

- La connexion utilisateur passe par le portail **Manus OAuth** (`client/src/const.ts:15-30`), le callback `/api/oauth/callback`, puis une session locale signée HS256 (`server/_core/oauth.ts:13-64`, `server/_core/sdk.ts:156-231`). Le contexte tRPC valide cette session (`server/_core/context.ts:11-28`). Ce n’est pas un appel d’authentification au Kernel GSG.
- TradeLink n’a pas de route d’export métrique ou audit vers le Kernel, ni de configuration d’URL/jeton Control Plane. L’audit est local; certains KPI sont explicitement synthétiques. Le modèle de session locale ne doit pas être confondu avec une identité de service.
- Le pays opérationnel affiché est à ce jour centré sur la Guinée; `shared/m1/phone.ts` est une liste de plans téléphoniques et non un registre d’activation pays/paiement. Aucun référentiel runtime de devises n’a été trouvé; les valeurs GNF du pilote M1 sont des fixtures. Il faut éviter de transformer ces fixtures en source de vérité.

## 3. Limites fonctionnelles proposées

### Le Control Plane possède

- l’inventaire des applications, environnements et instances autorisés;
- le statut de disponibilité, la supervision et des tableaux de bord globaux;
- l’agrégation de rapports opérationnels et d’audits minimisés, avec filtres d’accès, provenance et rétention;
- la gestion des politiques d’accès machine, des scopes et des autorisations de reporting, via un service d’identité workload désigné par l’architecture GSG.

### Les applications et services opérationnels possèdent

- l’authentification/session de leurs utilisateurs finaux tant qu’un service d’identité dédié approuvé ne les remplace pas;
- leur autorisation locale par action et leur journal d’audit de référence;
- les données métier, référentiels ou contrats réglementaires sous la responsabilité d’un service dédié et de son propriétaire;
- l’adaptation des données de reporting vers un schéma d’export explicitement autorisé.

Le Control Plane n’est pas un proxy d’accès aux données personnelles, aux dossiers KYC, aux documents, aux transactions ou aux tokens d’une application. Les anciens modules Identity et Referential du Kernel ne sont pas supprimés dans cette proposition : leur destination, leurs consommateurs et le plan de migration doivent être décidés avant décommissionnement. Les modules Org/Product/Product Registry/App Config doivent eux aussi être classés par le propriétaire d’architecture selon leur rôle réel (inventaire/admin du plan de contrôle ou service métier partagé).

## 4. Contrat HTTP à valider

Les noms et les payloads ci-dessous constituent une **proposition de contrat v1**, non un endpoint disponible.

### 4.1 Ingestion batch d’événements d’audit — Kernel

`POST /api/v1/control-plane/reporting/audit-events/batch`

Droits requis : `reporting.audit.write` pour l’instance d’origine et l’environnement visé. Corps JSON strict, taille et nombre d’éléments bornés. Exemple :

```json
{
  "schemaVersion": "1",
  "source": {
    "applicationId": "trade-link-africa",
    "instanceId": "tradelink-prod-eu-1",
    "environment": "production"
  },
  "batchId": "c5fb85a8-9b5a-4c8e-9064-26b8465fb4d5",
  "events": [
    {
      "eventId": "62bd0281-442b-4e21-aad7-04ba8055c46e",
      "occurredAt": "2026-10-18T14:00:00.000Z",
      "eventType": "kyc.review.decision_confirmed",
      "actorRef": "hmac:v1:7a17...",
      "actorRoleClass": "country_checker",
      "resourceType": "kyc_application",
      "resourceRef": "hmac:v1:4c0d...",
      "action": "decision_confirmed",
      "outcome": "success",
      "countryCode": "GN",
      "correlationId": "f9d9b6e1-7851-43ba-8a91-e563a41529c4"
    }
  ]
}
```

Réponse proposée : `202 Accepted`, avec `batchId`, nombre de lignes acceptées, doublons déjà reconnus et rejets indexés par `eventId`/code de validation. Rejouer un batch ne doit pas dupliquer un événement.

### 4.2 Ingestion batch d’instantanés métriques — Kernel

`POST /api/v1/control-plane/reporting/metrics/snapshots/batch`

Droits requis : `reporting.metrics.write`. Exemple :

```json
{
  "schemaVersion": "1",
  "source": {
    "applicationId": "trade-link-africa",
    "instanceId": "tradelink-prod-eu-1",
    "environment": "production"
  },
  "snapshotId": "42d5c25a-8cf1-4a2f-bf7c-fb04c082c1bc",
  "windowStart": "2026-10-18T13:55:00.000Z",
  "windowEnd": "2026-10-18T14:00:00.000Z",
  "metrics": [
    { "name": "http.server.requests", "kind": "counter", "value": 310, "unit": "requests", "dimensions": { "routeGroup": "trpc", "statusClass": "2xx" } },
    { "name": "http.server.request.duration", "kind": "histogram_summary", "value": 142, "unit": "ms_p95", "dimensions": { "routeGroup": "trpc" } }
  ]
}
```

Les unités, types (`counter`, `gauge`, `histogram_summary`), noms autorisés, cardinalité des dimensions, fréquence et limites de lot doivent être figés dans une annexe OpenAPI/JSON Schema. Les valeurs de l’exemple ne sont que des exemples synthétiques.

### 4.3 Endpoints de lecture limités — chaque instance

- `GET /api/v1/internal/control-plane/health` — état technique minimal et horodatage;
- `GET /api/v1/internal/control-plane/observability/summary?window=5m` — compteurs agrégés et latences techniques autorisés.

Droit requis : `control_plane.instance.summary.read`, lié à une seule instance/environnement. Aucun accès aux routes tRPC, aux dossiers individuels, aux audits bruts ou aux fonctions de mutation. Le tableau de bord central doit privilégier les données pushées dans l’agrégateur; la lecture pull sert seulement à vérifier la fraîcheur et la disponibilité technique.

### 4.4 Contrats de stockage et audit côté Kernel

- Ajouter un modèle de réception d’événements externe isolé de l’audit interne des opérations Kernel, par exemple `reporting_ingest_event` et `reporting_metric_snapshot` ou leurs équivalents de stockage approuvés.
- Conserver les index d’unicité sur `(source_instance_id, event_id)` et sur `snapshot_id`, et stocker `schema_version`, `received_at`, statut de traitement et provenance.
- Ne pas écrire dans `audit_evenement` en prétendant que l’événement externe est un événement métier interne; conserver une provenance d’origine explicite.
- Séparer les permissions de lecture dashboard des permissions d’écriture d’export; filtrer par instance, produit, environnement et rôle super-admin.

## 5. Sécurité interservices recommandée

### Identité machine

**Option préférée : JWT workload court, asymétrique (ES256 ou RS256)**, émis par le service d’identité workload/PKI désigné par GSG, et non par le Control Plane s’il abandonne la fourniture d’identité. Claims minimaux :

- `iss` : issuer workload explicitement approuvé;
- `sub` : identifiant stable de l’application/instance;
- `aud` : service destinataire exact (`gsg-control-plane-reporting` ou instance TradeLink);
- `exp` : durée courte (proposition : au plus 5 minutes), `iat`, `jti`;
- `scope` : permissions dédiées ci-dessus;
- `environment` et identifiant de clé `kid`.

Valider signature et algorithme en allowlist, `iss`, `aud`, `exp`, `nbf`, `jti` si protection anti-rejeu retenue, scopes, instance, environnement et éventuelle révocation. Refuser les JWT utilisateurs GSG ID, les tokens OAuth de navigateur, les cookies de session, les clés HMAC partagées entre applications et les tokens sans audience.

**Alternative : mTLS** entre workloads, avec certificats gérés/renouvelés par une PKI ou un service mesh approuvé, validation du SAN/identité de workload et révocation testée. Si la plateforme dispose déjà de cette PKI, elle peut être plus simple qu’un issuer JWT nouveau. Ne pas coder une pseudo-vérification mTLS dans l’application; elle doit être garantie par le runtime/proxy et transmise de manière fiable au service.

**Décision à valider par l’architecte :** mode par défaut et propriétaire de l’émission/rotation des identités de service. La présente proposition recommande JWT asymétriques courts si un issuer workload existe déjà; sinon, mTLS si la PKI/service mesh est déjà opéré. Aucun token ne doit être créé avant cette décision.

### Contrôles obligatoires supplémentaires

- Secret ou clé privée conservé dans un coffre de secrets/runtime, jamais en variable `VITE_*`, navigateur, dépôt, fichier de rapport ou log.
- TLS partout; réseau privé/allowlist si le déploiement le permet; rotation et révocation documentées.
- Limitation de débit et tailles de payload, validation stricte, quotas par instance, horloge UTC et filtrage des erreurs.
- Nonces/signatures par lot ou `Idempotency-Key` si le contrat le retient; protection contre rejeu et batch inter-environnements.
- Tableau de bord avec RBAC super-admin, journalisation des accès et séparation maker/checker pour les changements de politique sensible.

## 6. Minimisation et règles de données

### Audit — export autorisé sous réserve d’approbation

Exporter des événements explicitement allowlistés, réduits aux champs de l’exemple et dotés d’identifiants pseudonymisés déterministes uniquement si le rapprochement multi-événements est nécessaire. Les références doivent être générées par HMAC avec une clé distincte, stockée dans le coffre, versionnée et révocable.

**Ne pas exporter** : nom, email, téléphone, openId/GSG ID brut, texte libre `detail`/`reason`, IP, User-Agent, jetons ou cookies, données KYC, nom de fichier, URL signée, contenu de document, montant transactionnel détaillé, payload d’exception ou événement non classifié. Les événements d’accès/décision peuvent contenir des données personnelles même lorsqu’ils sont dits « audit ».

### Métriques

Commencer par l’observabilité technique et agrégée : requêtes par groupe de route/méthode/classe de statut, latences, taux d’erreur, disponibilité, âge/profondeur d’outbox et échecs d’export. Les dimensions doivent avoir une cardinalité bornée et n’inclure ni utilisateur, ni document, ni route avec identifiant.

Ne pas exporter le **Score Business**, ses composantes métier ou les montants dans cette tranche. Le moteur du Score Business de TradeLink demeure gelé tant que V1–V4 ne sont pas signés. Ne pas traiter les fixtures M1/M2 synthétiques comme des KPI de production.

### Source de vérité et rétention

- Source de vérité d’un audit : l’application qui a observé l’action; le Kernel conserve une copie de reporting avec provenance.
- Source de vérité d’une métrique : l’application/instance qui l’a calculée; le Kernel conserve une projection agrégée.
- Définir avant production la rétention par catégorie, la résidence, l’accès et les règles de suppression/anonymisation; un tableau de bord central n’autorise pas une centralisation illimitée.

## 7. Livraison, disponibilité et reprise

- Générer les événements localement via un adaptateur d’export. Pour l’audit qui doit survivre à un redémarrage, utiliser une outbox transactionnelle dans la base de l’application, atomique avec la ligne d’audit source lorsque l’architecture le permet.
- Livraison **au moins une fois**; l’unicité et l’idempotence côté Kernel empêchent les duplications. Ne pas promettre « exactly once » sur HTTP.
- Retry avec backoff exponentiel et jitter sur timeout, `429`/`5xx`; respecter `Retry-After`. Les erreurs de validation `4xx` ne sont pas rejouées sans correction.
- Isoler une dead-letter queue, l’alerter, donner une capacité de replay contrôlée et tracer le dernier succès/l’âge de la file. L’export reporting indisponible ne doit pas bloquer le parcours utilisateur, mais une perte durable de la copie centrale doit déclencher alerte; l’audit source local ne doit jamais être supprimé à l’acquittement central.
- Pour les métriques, autoriser la coalescence d’instantanés uniquement selon une politique documentée; ne pas coalescer ni jeter silencieusement des événements d’audit.
- Employer un circuit breaker et une limite de concurrence pour qu’une panne de Kernel ne propage pas de panne aux applications.

## 8. Plan de migration

### Phase 0 — Approbation du contrat

Valider les routes, schémas, données permises, politique de rétention, modèle d’authentification workload et responsabilités opérationnelles. Publier OpenAPI/JSON Schema, codes d’erreur, SLO, quotas et stratégie versionnée. **Aucun export ou changement d’auth dans cette phase.**

### Phase 1 — Control Plane d’ingestion dans le Kernel

Ajouter un module dédié reporting, les endpoints et la persistance/idempotence, une identité de service isolée des JWT utilisateurs, les garde-fous d’accès dashboard et les tableaux de bord de livraison. Ajouter tests contractuels, sécurité et migrations; aucune suppression des modules actuels.

### Phase 2 — Export côté TradeLink en environnement non-production

Ajouter une route d’export serveur à serveur, construire la projection allowlistée depuis les audits locaux, outbox/retries, métriques techniques et résumé de santé. Conserver les sessions Manus OAuth et les procédures guest-first. Utiliser des événements synthétiques/anonymisés; tester un endpoint Kernel dédié.

### Phase 3 — Canari et critères de bascule reporting

Mesurer l’exhaustivité, doublons, retard, rejet, DLQ, récupération après panne, rotation/révocation de credentials et isolation entre applications/environnements. Comparer échantillons local/Kernel sans exposer PII. Activer progressivement seulement après approbation sécurité et métier.

### Phase 4 — Délestage identité/référentiels

Pour chaque module Kernel ciblé, identifier le service dédié de destination, ses contrats, consommateurs, données et responsabilités. Migrer les consommateurs un par un, maintenir une période de compatibilité et rollback, comparer les résultats et obtenir la validation du propriétaire. L’authentification Manus de TradeLink reste en place jusqu’à approbation explicite de son fournisseur de remplacement; aucune session ou table utilisateur ne sera effacée pendant le cutover.

### Phase 5 — Décommissionnement contrôlé

Seulement après preuve qu’aucun client/produit ne dépend encore des routes, contrats ou tables retirés : plan de dépréciation/version, migration de données, communication interne, procédure de restauration, audit de sécurité et validation du propriétaire du Kernel. Les fonctions strictement Control Plane restent dans le Kernel; les services métier/référentiels sont hébergés par leur propriétaire dédié.

## 9. Gates de validation et tests d’acceptation

Le contrat ne sera prêt à implémenter que lorsque les réponses suivantes sont approuvées :

1. Le reporting central reçoit-il uniquement l’observabilité technique, ou également certains événements d’audit métier? Quelle classification/rétention/résidence s’applique?
2. Qui opère l’identité workload : issuer JWT asymétrique déjà existant, PKI/mTLS existante, ou service dédié? Qui délivre et révoque les droits par instance?
3. Le tableau de bord pousse-t-il les audits et métriques, consulte-t-il en plus un résumé santé, ou les deux? La proposition recommande **push pour audit/metrics et pull limité pour santé**.
4. Quels modules actuels de `core_kernel` sont destinés à être déplacés, vers quelles destinations, et qui est propriétaire de la migration? L’auth Manus locale de TradeLink reste maintenue jusque-là.
5. Quels SLO et seuils d’alerte s’appliquent à l’âge outbox, aux pertes, aux rejets, au DLQ et à la disponibilité du reporting?

Tests requis avant activation : validation OpenAPI; rejet d’issuer/audience/scope incorrects, token expiré, replay et mauvais environnement; déduplication et enregistrement idempotent; validation batch partielle; retries et `Retry-After`; panne/reprise Kernel; DLQ/replay audité; absence de fuite de données interdites; permission cross-tenant impossible; rotation/révocation; et vérification que les opérations métier continuent pendant une panne de reporting.

## 10. Portée de la présente validation

Une approbation de cette note validera uniquement la **direction et le contrat proposé**, pas la mise en production, l’émission de secrets, la suppression des modules actuels, le transfert de données personnelles ou la migration d’authentification. Après approbation, l’implémentation sera réalisée séparément dans les deux dépôts, par étapes, avec tests et un rapport de fin d’activité avant de passer à la suivante.

**Statut final de ce livrable : en attente de validation explicite de l’utilisateur.**
