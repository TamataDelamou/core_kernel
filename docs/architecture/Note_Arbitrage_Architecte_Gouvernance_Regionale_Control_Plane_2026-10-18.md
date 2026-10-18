# Note d’arbitrage — Gouvernance régionale du Control Plane GSG

**Destinataire :** Architecte du Kernel GSG  
**Date :** 18 octobre 2026  
**Version :** 0.2 — validation du propriétaire TradeLink enregistrée le 18 octobre 2026; arbitrages des référents A1–A8 en attente de signature.
**Décisions propriétaires déjà explicites :** vision panafricaine; centralisation du Control Plane via Kernel GSG; démarrage par une recette isolée en Guinée puis progression par phases en Afrique de l’Ouest; protection prioritaire de l’intégrité des flux utilisateurs existants.  
**État d’exécution :** code interservices en état **DORMANT**, flags fermés; aucune identité de recette, secret, certificat, base de recette ou déploiement n’a été provisionné. Aucune migration n’a été appliquée. Le dépôt TradeLink `main` contient aussi le code après synchronisation automatique d’un checkpoint antérieur (commit `71cf061e`); le dépôt Kernel `main` reste au commit `59d59342`, antérieur à la branche de fonctionnalité. Aucun historique ne sera réécrit ni commit de code supplémentaire publié pendant ce gel.

**Portée contractuelle :** l’approbation du propriétaire valide cette orientation et demande aux référents désignés de trancher. Elle ne constitue pas une signature au nom de l’architecte Kernel, de l’Architecte Sécurité, du DPO ou des Lead Devs. Le caractère opposable en interne dépend des règles de signature de l’organisation; toute prétention d’opposabilité juridique doit être confirmée par une personne habilitée en droit/contrats. Cette note n’est pas, à elle seule, un avis juridique ni un contrat exécuté.

## 1. Objet de la revue

Obtenir les décisions d’architecture communes nécessaires avant de créer l’environnement de recette interservices. Le but est que les plateformes GSG utilisent un socle commun, sans refaire une conception similaire dans chaque produit, tout en conservant les responsabilités opérationnelles locales.

Cette note ne demande pas l’activation du reporting. Elle ne propose ni intégration PSP, ni flux financier, ni remplacement des sessions utilisateur. Elle sollicite l’architecte sur la propriété des interfaces, l’identité workload, l’inventaire multi-région, la gouvernance de données, l’exploitation et les gates de passage de phase.

## 2. Recommandation soumise

Adopter un Control Plane central, opéré par le Kernel GSG, qui gère l’inventaire des produits et environnements, la gouvernance des identités machine, l’agrégation de reporting strictement minimisé, les politiques d’accès et les preuves de passage entre phases.

Conserver dans chaque application la session et l’autorisation de ses utilisateurs, les données métier et leurs audits de référence, les actions produit, ainsi que les contrôles nécessaires pour maintenir la continuité des parcours locaux. Le Kernel ne devient pas un proxy de tRPC, des dossiers individuels, des documents KYC, des données commerciales ou des mutations métier.

Centraliser la gouvernance dès la conception, mais activer progressivement les instances : **laboratoire isolé → recette Guinée → extension ouest-africaine par pays → décision de production distincte**. Chaque phase est attachée à une preuve, un propriétaire, une revue et une approbation explicites. Le pays suivant ne doit pas être fixé par présomption; il est choisi sur l’état de préparation et les besoins vérifiables.

## 3. Arbitres et décisions à confirmer

| ID | Décision demandée | Recommandation de travail (non signée) | Référent responsable (ID de rôle) | Statut |
|---|---|---|---|---|
| A1 | Propriétaire architectural du Control Plane et limites des modules historiques | Kernel GSG comme Control Plane; inventorier Identity/Referential et autres modules avant tout retrait ou déplacement. Aucun module historique n’est supprimé dans cette tranche. | `R-ARCH-K` — Architecte Kernel | À arbitrer — approbation propriétaire reçue; ratification requise |
| A2 | Identité machine de recette, pilote et production | Réutiliser un issuer workload asymétrique existant si l’architecture le possède; sinon utiliser la PKI/service mesh mTLS géré déjà approuvé. Ne créer ni bearer statique partagé ni issuer ad hoc dans TradeLink. Identités et audiences séparées par environnement. | `R-SEC` — Architecte Sécurité | À arbitrer — approbation propriétaire reçue; ratification requise |
| A3 | Répertoire des applications, pays, régions et phases | Source de vérité centrale versionnée; statut de documentation distinct du statut de licence, configuration, test et activation. Instance ciblée par chaque identité machine. | `R-ARCH-K` — Architecte Kernel | À arbitrer — approbation propriétaire reçue; ratification requise |
| A4 | Contrat d’observabilité Push/Pull | Versionner OpenAPI/JSON Schema, scopes séparés, allowlists de champs et types, taille de lots, fenêtres, codes d’erreur, quotas, idempotence et réponse no-store. | `R-LD-K` — Lead Dev Kernel | À arbitrer — approbation propriétaire reçue; ratification requise |
| A5 | Politique des données | N’autoriser que métriques techniques agrégées et événements explicitement classifiés; conserver localement l’audit source. Exclure identité directe, KYC, texte libre, données commerciales détaillées et Score Business tant que V1–V4 restent non signés. | `R-DPO` — Data Protection Officer | À arbitrer — approbation propriétaire reçue; ratification requise |
| A6 | Résidence, rétention et accès dashboard | Définir politiques par catégorie et juridiction, durée, capacité/quotas et règles de lecture; accès par RBAC super-admin et journaux d’accès, avec maker-checker pour les changements sensibles. | `R-DPO` — Data Protection Officer | À arbitrer — approbation propriétaire reçue; ratification requise |
| A7 | Déclencheur et exploitation | Choisir un worker/Heartbeat externe durable, supervisé, avec backoff, file bornée, backpressure, revue manuelle, alertes et procédure de reprise. Pas de cron ni de timer en processus. | `R-LD-K` — Lead Dev Kernel | À arbitrer — approbation propriétaire reçue; ratification requise |
| A8 | Modèle de validation utilisateur | Adopter la matrice §6 comme gate de non-régression par module avant chaque phase. Une panne du Kernel ne doit pas bloquer une action locale. | `R-LD-TL` — Lead Dev TradeLink | À arbitrer — approbation propriétaire reçue; ratification requise |

Les ID de référent sont attribués; les personnes nominatives restent à désigner par l’architecte/secrétariat de gouvernance. Référentiel des rôles : `R-ARCH-K` = Architecte Kernel; `R-SEC` = Architecte Sécurité; `R-LD-K` = Lead Dev Kernel; `R-DPO` = Data Protection Officer; `R-LD-TL` = Lead Dev TradeLink. Chaque personne désignée devra confirmer son acceptation du rôle et son pouvoir de signature.

**Règle de statut et de gel :** la validation du propriétaire est reçue, mais A1–A8 restent `À arbitrer` jusqu’à la décision et à la signature vérifiable de chaque référent attribué; ajouter nom, date, décision/preuve et référence de signature. Le code Control Plane reste **DORMANT** et aucune modification du code fonctionnel, activation, provisionnement ou migration ne peut être faite pendant cette période. Le gel ne peut être levé qu’après passage explicite de chacune des huit lignes à `Validé` et une autorisation distincte de démarrer la Phase 1. Toute modification du contrat exige une nouvelle revue.

## 4. Phases et critères de passage

| Phase | Périmètre | Gates minimales de sortie |
|---|---|---|
| 0 — Arbitrage | ADR, responsabilités, modèle multi-région, identité, données, contrat, rétention et orchestration | A1–A8 nominativement attribués, signés et `Validé`; contrat API versionné; risques et owners enregistrés. Toute ligne différée reste un blocage à la Phase 1 et maintient le code `DORMANT`. |
| 1 — Laboratoire isolé | Kernel et TradeLink de test, bases dédiées, données synthétiques et identité workload/PKI de test | Aucun chemin réseau vers production; migrations up/down réversibles testées; refus croisés environnement/instance démontrés; aucune donnée personnelle |
| 2 — Recette Guinée | Première instance non-production, sans flux de paiement; collecte et lecture limitées à l’observabilité approuvée | Matrice d’intégrité réussie; comportement de panne/reprise, quota, idempotence et rétention démontrés; procès-verbal signé par architecte et propriétaires |
| 3 — Extension Afrique de l’Ouest | Un pays à la fois ou petites vagues justifiées; gouvernance centralisée et périmètres locaux explicites | Dossier d’admission local par pays; preuve d’autorisation/configuration/recette distincte; revue de résidence et d’exploitation; maker-checker par vague |
| 4 — Décision de production | Activer une instance après approbation, sans activation par fusion seule | Identité de production distincte; migration approuvée; restauration/rollback testés; SLO, alertes, rétention, capacité, kill switch et responsables signés |
| 5 — Exploitation et évolution | Supervision, révocation, reprise, changement de politique, ajout de produits ou retraits | Revue régulière, provenance et audit admin; gestion d’incident éprouvée; minimisation renouvelée pour chaque nouvel événement/produit |

## 5. Préconditions de la recette isolée

La recette ne commence qu’après arbitrage A1–A8 ou résolution des seules décisions nécessaires à cette phase. Elle requiert :

- instances de test du Kernel et de TradeLink, réseaux, bases et secrets séparés de tous les environnements de production;
- données synthétiques déterministes et marquées comme telles; aucun clonage de base personnelle;
- identité workload de test et JWKS/PKI de test, avec issuer, audience, sujets, scopes et allowlist explicites;
- pare-feu/egress autorisant uniquement les routes de test approuvées; tests prouvant qu’un jeton de recette ne peut viser une cible de production, ni l’inverse;
- migration additive appliquée seulement à des bases jetables/de recette après revue, répétition up/down et procédure de restauration;
- journalisation sans jetons ni payloads sensibles, métriques à cardinalité bornée, réponse `Cache-Control: no-store` et politique de conservation limitée;
- aucun contact réseau avec un PSP, aucun paiement, compte marchand, réserve de fonds, commande réelle ou mutation de données de production.

## 6. Matrice minimale de protection des utilisateurs

| Contrôle | Attente d’acceptation en recette |
|---|---|
| Guest-first | Visite anonyme des écrans publics inchangée; aucune redirection d’authentification déclenchée par le reporting |
| Authentification utilisateur | Manus OAuth, callback, cookies, session et déconnexion inchangés; aucun JWT workload utilisable comme session |
| Actions protégées | Invité, utilisateur authentifié, session expirée et rôles insuffisants testés; seules les actions pertinentes demandent une connexion |
| Isolation interservices | Cookie/OAuth refusé sur Control Plane; jeton machine refusé sur les routes utilisateur; scopes, cible d’instance, produit, pays et environnement validés |
| Panne du Kernel | Kernel inaccessible, timeout ou HTTP 5xx n’interrompt ni consultation ni action métier locale; retries asynchrones, bornés et observables |
| Atomicité/idempotence | Écriture audit et outbox cohérentes; retry identique dédupliqué; réutilisation d’une clé avec payload différent placée en revue manuelle |
| Minimisation | Valeurs-canaris dans PII/texte libre/KYC absentes de la base Kernel, réponses GET, logs, traces et rapports; seuls les champs allowlistés transitent |
| M1 — Gouvernance/confiance | Pas d’altération de hold, retrait, KYC, identité de demande, journal local, accès admin ou processus maker-checker |
| Score Business | Pas d’exposition ou recalcul central; le moteur reste gelé jusqu’à signature V1–V4 |
| M2 — Marketplace | Lectures toujours read-only/guest-first; aucun import, création d’offre, stock, commande, réservation ou paiement déclenché |
| Interruption/suspension | Kill switch arrête le reporting sans affecter le service utilisateur; outbox bornée et procédure d’examen/reprise disponibles |

Tout échec bloquant d’authentification, d’autorisation, de minimisation, d’isolation inter-pays ou de continuité utilisateur empêche le passage de phase jusqu’à correction et re-test.

## 7. Gouvernance panafricaine et modèle opérationnel

L’inventaire central doit représenter chaque produit, région, pays, instance et environnement sans supposer que tous les pays disposent du même opérateur, cadre réglementaire ou niveau de maturité. Il faut conserver des états distincts pour :

1. marché étudié/documenté;
2. fournisseur techniquement documenté;
3. autorisation/éligibilité réglementaire vérifiée;
4. identité et connectivité configurées en recette;
5. tests de recette réussis;
6. pilote ou production activé et observé.

Le tableau de bord global présente le niveau de preuve et la fraîcheur, pas un score universel « prêt » opaque. Les permissions sont scindées entre administration d’inventaire, politiques de reporting, lecture super-admin et opération locale. Les actions sensibles exigent maker-checker et restent traçables.

Les données centrales se limitent au besoin de supervision. La résidence, les accès, l’usage secondaire et les durées doivent être décidés par catégorie et par juridiction. La centralisation ne vaut ni permission de transfert transfrontalier ni justification d’une conservation uniforme.

## 8. Contrats techniques déjà préparés

Les éléments préparés et publiés sur les branches dédiées, mais non activés :

- Kernel : `POST /api/v1/control-plane/reporting/audit-events/batch` et `POST /api/v1/control-plane/reporting/metrics/snapshots/batch`, avec scopes séparés, validation DTO stricte, provenance et idempotence;
- TradeLink : deux routes GET privées de santé et de résumé borné, protégées par JWT workload et `404` quand la lecture est désactivée;
- TradeLink : projection d’audit minimale, métriques techniques bornées, outbox transactionnelle additive et worker de push sans déclencheur durable;
- migration Kernel et TradeLink présentes dans les branches, mais non appliquées à une base.

Les noms, versions et payloads doivent être comparés aux contrats finaux de l’architecte avant toute configuration interservices. Le code existant est un point de départ révisable, pas un contrat signé.

## 9. Formulaire de retour de revue

L’approbation du propriétaire TradeLink est consignée ci-dessous. Chaque référent remplit sa ligne, ajoute son nom/autorité, sa décision et sa signature vérifiable. Le statut reste `À arbitrer` tant que la ligne n’est pas signée; seuls les responsables des rôles désignés peuvent faire passer leur ligne à `Validé`.

| ID | Décision / commentaire du référent | ID de rôle / propriétaire | Nom du signataire et autorité | Signature / date | Preuve / référence | Statut |
|---|---|---|---|---|---|---|
| A1 | À compléter | `R-ARCH-K` |  |  |  | À arbitrer |
| A2 | À compléter | `R-SEC` |  |  |  | À arbitrer |
| A3 | À compléter | `R-ARCH-K` |  |  |  | À arbitrer |
| A4 | À compléter | `R-LD-K` |  |  |  | À arbitrer |
| A5 | À compléter | `R-DPO` |  |  |  | À arbitrer |
| A6 | À compléter | `R-DPO` |  |  |  | À arbitrer |
| A7 | À compléter | `R-LD-K` |  |  |  | À arbitrer |
| A8 | À compléter | `R-LD-TL` |  |  |  | À arbitrer |

**Approbation du propriétaire :** validée par le propriétaire TradeLink le 18 octobre 2026; cette approbation n’est pas la signature des référents ci-dessus.
**Ratification juridique/organisationnelle :** nom et signature d’une personne habilitée à engager les équipes/l’organisation : ____________________ ; fonction : ____________________ ; date/référence : ____________________. L’opposabilité juridique doit être confirmée par la fonction juridique habilitée; ne pas la déduire de l’approbation produit.

## 10. Liens de contexte

- [Plan de gouvernance panafricaine, phases et recette isolée](Plan_Gouvernance_Panafricaine_Control_Plane_Recette_2026-10-18.md)
- [Plan opératoire non-exécutoire de préparation Phase 1](Plan_Recette_Isolee_Phase1_Control_Plane_2026-10-18.md)
- [Proposition initiale du contrat Control Plane](Proposition_Control_Plane_Reporting_Interservices_2026-10-18.md)
- [Rapport d’implémentation Kernel](Implementation_Control_Plane_Reporting_2026-10-18.md)

**Décision demandée maintenant :** l’architecte/secrétariat désigne les personnes portant les rôles référents, puis chaque référent signe sa ligne; le statut passe à `Validé` seulement après signature et preuve. Jusqu’à ce que les huit lignes soient ainsi validées, le code reste dormant et la Phase 1 n’est que planifiée; aucun credential, réseau, migration, endpoint ou instance de recette ne doit être créé/activé. L’approbation propriétaire est acquise; le contrat interne et sa portée opposable restent soumis aux règles de signature et à la revue juridique/organisationnelle habilitée.
