# Plan de formalisation — Gouvernance panafricaine du Control Plane GSG et environnement de recette isolé

**Date :** 18 octobre 2026  
**Destinataire :** Architecte du Kernel GSG  
**Statut :** dossier de travail à examiner avec l’architecte; aucune décision d’exploitation, ouverture réseau ou activation n’est prise par ce document.  
**Contexte :** le rapport d’implémentation Control Plane TradeLink a été explicitement validé par le propriétaire le 18 octobre 2026. Il a demandé une formalisation avec l’architecte Kernel, une recette isolée, un déploiement progressif par phases, une gouvernance régionale panafricaine centralisée via le Kernel GSG et une vigilance renforcée sur l’intégrité des parcours utilisateurs existants.

## 1. Objet et recommandation d’architecture

Formaliser un cadre commun, réutilisable par les plateformes GSG, pour superviser leurs environnements à travers le Control Plane du Kernel, sans reproduire dans chaque application les décisions transverses d’administration et de reporting.

La recommandation est de centraliser dans le Control Plane GSG :

- l’inventaire des produits, pays, régions, instances et environnements autorisés;
- les politiques d’accès interservices, les scopes, les identités workload et leurs cycles de rotation/révocation;
- les rapports techniques agrégés, l’état de santé et les audits explicitement minimisés;
- la visibilité opérationnelle, les changements de phase, les alertes et la gouvernance maker-checker.

La centralisation ne doit pas transformer le Kernel en proxy des parcours métier ou des données individuelles. Les applications conservent leurs responsabilités opérationnelles et la source de vérité de leurs événements métier. Les responsabilités de l’authentification/session des utilisateurs et des référentiels opérationnels restent locales ou reviennent à des services dédiés, conformément à la nouvelle directive sur le rôle du Kernel. Leur retrait ne fait pas partie de cette étape.

La gouvernance est panafricaine dès la conception; le déploiement, lui, est progressif : commencer par une recette isolée en Guinée, puis ouvrir de manière séquencée les pays et corridors d’Afrique de l’Ouest après les critères d’admission convenus. La Guinée est le premier périmètre de validation, pas une architecture exclusivement guinéenne.

## 2. Périmètre et frontières

### Inclus dans le Control Plane partagé

- une vue centrale par produit, région, pays, instance et environnement;
- des métriques d’exploitation à cardinalité bornée et des synthèses de disponibilité;
- l’ingestion de seules catégories d’audit allowlistées, avec provenance, idempotence et rétention approuvée;
- des contrôles globaux et versionnés des phases de déploiement;
- l’administration des identités workload et de la séparation des permissions lecture/écriture;
- une trace des opérations d’administration et des décisions de politique.

### Hors du périmètre central par défaut

- création de session ou authentification interactive des utilisateurs finaux;
- profil individuel, documents KYC, données de compte, panier, commande, réservation ou détail commercial;
- données brutes d’audit, texte libre, payloads, cookies, tokens utilisateur et identifiants directs;
- mutations métier au moyen du dashboard global;
- traitement, détention, routage ou règlement des fonds;
- centralisation des Score Business, de ses composantes, seuils ou autres KPI métier avant leur gouvernance propre. Le moteur TradeLink demeure gelé tant que V1–V4 ne sont pas signés.

Un accès administratif central à une instance reste limité à la supervision de synthèses. Toute action corrective sur les données de l’application doit passer par un parcours métier local, autorisé, tracé et protégé par ses propres contrôles.

## 3. Modèle de gouvernance régionale

Le Kernel doit permettre une politique uniforme, avec des paramètres scindés par région, pays, produit, instance et environnement. Les décisions communes ne doivent pas imposer une même vague d’activation à tous les marchés.

Chaque enregistrement d’instance devra porter, selon un schéma versionné et approuvé :

- un identifiant stable du produit, de l’instance et de l’environnement;
- une appartenance régionale et un pays opérationnel, lorsqu’ils sont pertinents;
- une phase (`laboratoire`, `recette`, `pilote`, `extension`, `suspendue` ou `retirée`);
- la version du contrat de reporting et la politique applicable;
- les capacités effectivement vérifiées, distinctes des capacités déclarées ou documentées;
- le propriétaire opérationnel local, les contacts d’escalade par rôle et la date de revue;
- les statuts séparés d’autorisation, de configuration, de test et d’activation réelle.

Le tableau de bord devra distinguer sans ambiguïté : « couvert dans la documentation », « techniquement compatible », « juridiquement examiné », « autorisé », « configuré en recette », « testé » et « activé ». Une documentation commerciale ou une simple présence nationale ne constitue pas une preuve d’activation.

La gouvernance des changements qui élargissent la collecte, les accès ou une phase de déploiement devrait appliquer un contrôle maker-checker, une approbation horodatée, un historique de politique immuable au niveau applicatif et un retour arrière préparé. Ne pas qualifier le journal applicatif de WORM si aucun stockage WORM vérifiable n’est en place.

## 4. Déploiement progressif par phases

Les phases sont des gates, pas des dates prévisionnelles. Le passage à la phase suivante exige une preuve, un responsable et une approbation consignés dans le Kernel.

### Phase 0 — Contrat d’architecture et gouvernance

1. Confirmer le rôle du Kernel comme Control Plane exclusif et lister les responsabilités qui restent dans les applications ou services dédiés.
2. L’architecte approuve le contrat OpenAPI/JSON Schema commun et décide du mode d’identité de service : issuer JWT asymétrique court existant, ou PKI/mTLS gérée; ne pas concevoir un émetteur improvisé dans TradeLink.
3. Définir les identifiants de régions, pays, applications, instances et environnements ainsi que les règles de provenance.
4. Définir l’allowlist des audits, le vocabulaire des métriques, les limites de lots, les scopes, les quotas, la rétention, la résidence des données, les rôles dashboard et l’escalade.
5. Définir les résultats d’acceptation des parcours utilisateurs et le propriétaire de leur recette.

**Sortie requise :** décision d’architecture consignée, contrat versionné et matrice de responsabilités approuvés. Cette phase ne permet aucun déploiement.

### Phase 1 — Laboratoire isolé, sans données réelles

1. Créer des environnements distincts du développement courant et de la production : Kernel de test, instance TradeLink de test, bases et comptes de service séparés.
2. Utiliser exclusivement des données synthétiques clairement étiquetées; ne pas importer de données utilisateur, KYC, vendeur, client ou transaction de production.
3. Utiliser une identité workload/PKI de test dédiée, avec audience, scopes, instances et environnement non-production explicitement allowlistés; ne jamais réutiliser une identité de production.
4. Limiter la connectivité réseau aux seules routes de reporting approuvées et aux hôtes JWKS de test. Refuser explicitement toute combinaison d’identité, audience, instance ou environnement production↔recette.
5. Appliquer les migrations additives uniquement aux bases jetables ou de recette après revue, sauvegarde appropriée et procédure de retour testée.
6. Vérifier l’absence de secrets dans Git, les traces, les fixtures et les artefacts de CI.

**Sortie requise :** tests contractuels interservices réels entre deux environnements de test isolés, aucun échange avec une production et aucune charge personnelle.

### Phase 2 — Pilote de recette en Guinée

1. Enregistrer la Guinée comme premier périmètre de gouvernance de la recette; définir une instance dédiée et des données synthétiques pour ses rôles, langues et parcours pertinents.
2. Tester uniquement les opérations de reporting/observabilité autorisées. Aucun paiement, mouvement de fonds, compte PSP, réservation ou action irréversible n’est inclus.
3. Vérifier l’export d’événements allowlistés, l’idempotence, les conflits manuels, les retries, la rétention, les quotas, les limites de payload et le comportement Kernel indisponible.
4. Rejouer les scénarios guest-first, Manus OAuth, sessions, permissions et données locales, avec preuves avant/après et comparaison aux tests de référence.
5. Vérifier que le résumé central ne révèle aucun identifiant utilisateur, détail de dossier ou payload d’audit.

**Sortie requise :** procès-verbal de recette Guinée approuvé par l’architecte et le responsable produit/sécurité; aucune activation réelle n’en découle automatiquement.

### Phase 3 — Extension contrôlée en Afrique de l’Ouest

1. Après réussite du pilote Guinée, choisir le pays suivant selon les besoins observés, les règles locales, l’état d’opération des services, la capacité d’exploitation et la qualité des preuves — pas selon une simple promesse de couverture.
2. Rejouer chaque gate par pays/corridor, dans son propre périmètre et avec des données synthétiques locales; les preuves, comptes et identités restent isolés par environnement.
3. Ajouter progressivement des pays à une vague seulement si leurs critères sont satisfaits indépendamment; un blocage local ne bloque pas les régions déjà stables et ne doit pas conduire à contourner les règles locales.
4. Maintenir une vue régionale consolidée des statuts et métriques, tout en conservant les autorisations et la résidence requises par juridiction.

**Sortie requise :** dossier d’admission distinct par pays, puis approbation explicite de chaque vague. Aucun ordre des pays au-delà de « Guinée puis Afrique de l’Ouest progressivement » n’est présumé dans ce document.

### Phase 4 — Décision de production et activation

La production est une décision distincte. Elle exige, au minimum : contrat/API final signé; identité workload ou mTLS exploitée; revue sécurité; autorisations des workloads et audiences; rétention/capacité/résidence approuvées; migrations examinées et exécutées avec plan de retour; déclencheur durable supervisé; tests de panne/reprise et alertes; preuve de non-régression des parcours; responsable opérationnel et approbation maker-checker. L’activation doit se faire par produit/instance et peut être suspendue indépendamment.

### Phase 5 — Exploitation, élargissement et retrait

Surveiller la fraîcheur des données, profondeur/âge de l’outbox, erreurs/rejets, quotas, rétention et état des workloads. Prévoir révocation immédiate d’une identité, bascule kill-switch, mise en quarantaine et revue manuelle. Avant l’ajout d’un nouveau produit, d’un nouveau type d’événement ou d’une nouvelle région, réappliquer les gates de minimisation et de non-régression. Un retrait doit préserver la source de vérité locale et ne pas déclencher de purge non autorisée.

## 5. Environnement de recette isolé — contrôles minimaux

- **Réseaux :** segments non-production séparés; aucun chemin de recette vers les API, JWKS, bases ou bus de production; règles d’egress et de firewall allowlistées et vérifiées.
- **Identités :** issuer/PKI de test et certificats de test séparés; identifiant du workload, audience, environnement et instance vérifiés; durée courte, rotation et révocation éprouvées.
- **Données :** jeu synthétique, minimisé et non ré-identifiable; jamais de clonage ou d’anonymisation naïve d’une base personnelle comme substitut.
- **Secrets :** coffre de recette distinct; références absentes des logs, traces, captures, commits et variables frontend.
- **Bases :** Kernel PostgreSQL de test et TradeLink MySQL de test distincts des bases produit; migration `up`/`down` et restauration testées avant de qualifier la recette.
- **Activation :** flags fermés par défaut; configuration de recette rejetée si elle cible une instance production; aucune activation implicite après réussite d’un test.
- **Observabilité :** horodatage UTC, corrélation par identifiants techniques non sensibles, alertes de queue/retard et métriques sans cardinalité libre.
- **Sortie :** conserver seulement les résultats de test, versions de contrat et approbations nécessaires selon une durée décidée; ne pas conserver indéfiniment les payloads de recette.

## 6. Matrice d’intégrité des flux utilisateurs existants

L’ajout du Control Plane ne doit ni modifier le parcours utilisateur ni faire dépendre une action produit de la disponibilité du Kernel.

| Parcours/contrôle | Invariant à préserver | Scénario de recette et preuve attendue |
|---|---|---|
| Consultation publique guest-first | Les écrans publics et la lecture de données de démonstration accessibles sans compte restent consultables | Ouvrir la page en session vierge et sous throttling; comparer routes, contenu et console aux références; aucune redirection de connexion induite par le Control Plane |
| Action protégée | Seule l’action pertinente demande la connexion; les contrôles locaux restent en vigueur | Tester invité, utilisateur authentifié, session expirée et rôle insuffisant; vérifier refus propres, sans élévation ni session machine créée |
| Manus OAuth et session | Le flux OAuth existant, callback, cookies et session signée demeurent inchangés | Tests de connexion/déconnexion et session; token workload refusé sur une route utilisateur, cookie utilisateur refusé sur les routes privées Control Plane |
| Isolation des workloads | Le jeton machine est limité au scope, produit, instance et environnement autorisés | Tests positifs et négatifs de signature, issuer, audience, scope, sujet, cible, environnement, expiration, révocation et allowlist; aucun accès aux routes métier via le jeton |
| Continuité applicative | Panne, délai ou indisponibilité du Kernel ne bloque pas la consultation, l’authentification ni les actions locales | Couper l’endpoint Kernel en recette; mesurer latence et erreurs côté utilisateur; confirmer reprise asynchrone, retries bornés et absence de propagation d’exception |
| Atomicité et doublons | Un audit local obligatoire et sa mise en file sont cohérents; un rejeu ne duplique pas et un conflit ne s’écrase pas | Simuler succès/échec de transaction, timeout après commit, duplicate identique et clé réutilisée avec contenu différent; démontrer idempotence ou revue manuelle |
| Minimisation | Aucun utilisateur, dossier KYC, document, texte libre ou identifiant direct n’est centralisé | Injecter des valeurs-canaris dans des champs exclus; vérifier DB Kernel, outbox, logs, réponses GET, traces et rapports CI sans la valeur ni sa dérivée prévisible |
| Gouvernance M1 | Les statuts de vérification, retraits, holds et audits locaux ne changent pas | Rejouer tests M1 critiques et faire une revue ciblée de différentiel; aucune purge, automatisation juridique ou modification de rétention implicite |
| Score Business | Le moteur demeure gelé tant que V1–V4 ne sont pas signés | Vérifier qu’aucun endpoint, flux métrique ou tableau global ne publie ou ne recalcule score/composantes; aucune fixture synthétique ne devient donnée réelle |
| Catalogue/Marketplace M2 | Les lectures restent read-only et guest-first; aucune ingestion ne crée/édite une offre | Rejouer tests M2.1–M2.4, confirmer 0 mutation fournisseur, commande, réservation, paiement ou écriture dans les prototypes d’ingestion |
| Données inter-pays | Chaque instance, environnement et permission reste dans son périmètre | Tester un token d’un pays sur une instance d’un autre pays, une recette sur production et les rôles dashboard; toutes les tentatives croisées doivent échouer et être auditées sans fuite |

La preuve de non-régression doit être conservée comme résultats de tests et version de contrat, sans stocker d’identifiants de personnes réelles. Les tests applicatifs déjà verts ne remplacent pas les tests d’intégration du réseau et de l’identité en recette.

## 7. Critères d’acceptation communs

Le passage de la recette isolée à un pilote de phase n’est possible que si tous ces critères sont satisfaits :

1. Contrat OpenAPI/JSON Schema signé, avec version, exemples synthétiques, limites et compatibilité documentés.
2. Threat model approuvé couvrant identité workload, secrets, JWKS/PKI, rejeu, scopes, limites, isolation multi-tenant, résidence et compromission d’une instance.
3. Tests en environnements isolés réussis; refus négatifs prouvés; migrations réversibles testées uniquement en base non-production.
4. Matrice de non-régression des parcours utilisateur complétée par module; aucun échec P0/P1 non traité.
5. Preuve de minimisation et revue des champs par les responsables produit, sécurité et protection des données.
6. Outbox bornée et backpressure définis; panne Kernel sans impact utilisateur; procédure manuelle de reprise et de purge approuvée.
7. Rétention locale et Kernel, résidence/juridiction, accès dashboard, propriétaire d’incident, SLA et kill switch approuvés.
8. Passage de phase consigné par maker-checker; aucun déploiement ou activation par simple fusion de code.

## 8. Livrables de formalisation à obtenir de l’architecte Kernel

1. Décision d’architecture (ADR) établissant les fonctions Control Plane, les services qui conservent identité et données référentielles, et le modèle multi-région.
2. Contrat OpenAPI/JSON Schema officiel pour les deux sens Push/Pull, les codes d’erreur, limites, idempotence et versions.
3. Modèle d’identité interservices : issuer/PKI possédé, claims, scopes, audience, rotation, révocation, identité de test et séparation par environnement.
4. Modèle d’inventaire Control Plane des pays/régions/instances, states/phases et preuves d’activation; règle pour ne jamais confondre documentation, autorisation et service live.
5. Politique de minimisation, catégories allowlistées, rétention, résidence, accès et procédure d’incident.
6. Schéma d’isolation et guide de création/destruction de l’environnement de recette, y compris gestion des bases et certificats synthétiques.
7. Stratégie d’ordonnancement externe durable, quotas, queue capacity, alerting, retry/replay et maintien en revue manuelle.
8. Plan de déploiement par phase : recette Guinée, puis séquencement ouest-africain à choisir sur critères observables, avec rollback par instance.
9. Matrice de tests non-régression des flux utilisateur TradeLink, puis modèle réutilisable par les autres plateformes.

## 9. Décisions déjà prises et questions laissées à l’architecte

### Déjà prises par le propriétaire

- Vision panafricaine; la plateforme doit servir les pays de manière progressive et non être limitée à la Guinée.
- Commencer par la Guinée puis progresser graduellement en Afrique de l’Ouest.
- La gouvernance et le reporting transverses sont centralisés au Kernel GSG; les applications ne doivent pas redessiner les mêmes fonctions pour chaque produit.
- Priorité à l’intégrité des flux utilisateurs déjà en place.
- Le rapport technique Control Plane du 18 octobre 2026 a été explicitement validé; cette validation n’autorise ni activation production, ni migration production, ni opération commerciale.

### À trancher par l’architecte Kernel

- Quel service/owner est le Control Plane, et quels modules historiques restent dans des services dédiés sans être recréés dans chaque app?
- Quel issuer workload/PKI/mTLS existe réellement et qui l’opère? Quelles identités distinctes pour recette, pilote et production?
- Quelle source de vérité et quel workflow maker-checker gèrent les pays, phases et statuts d’activation?
- Quels champs d’audit et métriques sont approuvés pour chaque produit, région et pays? Quelle résidence et quelles rétentions sont admissibles?
- Quels mécanismes durablement opérés déclenchent les exports; quelles limites de queue, SLO, quotas et alertes s’appliquent?
- Quelles preuves et approbations donnent le droit de passer de la recette Guinée au pays ouest-africain suivant?

## 10. État immédiat et prochaine gate

Le code de reporting existe dans les branches dédiées et reste désactivé par défaut; les tests locaux et les quality gates GitHub des commits de code ont réussi. Le prototype ne fournit pas encore une recette interservices configurée : aucun issuer de recette, aucun hôte JWKS réel, aucun worker durable et aucune base de recette approuvée n’ont été créés ou utilisés.

La prochaine étape recommandée est une **revue de conception avec l’architecte Kernel**, suivie de l’ADR, du contrat versionné et du plan d’environnement isolé. Ensuite, l’architecte et les propriétaires concernés pourront autoriser la création de ressources de recette dédiées. Jusqu’à ces décisions, ne pas appliquer les migrations, ne pas créer de credential workload, ne pas connecter un runtime à un endpoint et ne pas modifier les parcours utilisateurs existants.
