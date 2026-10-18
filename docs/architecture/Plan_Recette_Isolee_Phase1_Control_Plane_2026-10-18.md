# Plan de préparation — Recette isolée Phase 1 du Control Plane GSG

**Date :** 18 octobre 2026
**Périmètre :** plan de préparation non-exécutoire pour le laboratoire/recette interservices Kernel GSG + TradeLink, première étape Guinée.
**Statut :** préparation documentaire seulement; en attente des signatures A1–A8 avant même de planifier le provisionnement. **Aucune ressource, réseau, base, identité workload ou secret n’a été provisionné**.
**Conditions préalables :** tous les IDs A1–A8 doivent être nommément attribués, signés par le référent responsable, porter une preuve datée et passer à `Validé` dans la note maître. L’approbation du propriétaire TradeLink (18 octobre 2026) ne remplace pas ces signatures. Confirmer également la portée du contrat, la sécurité, la gouvernance des données et la validation juridique/organisationnelle. Toute création de ressource nécessitera une autorisation séparée et un inventaire de coûts/risques.

## 1. Objet

Décrire concrètement comment préparer une recette qui vérifie les endpoints Push/Pull du Control Plane et la matrice de non-régression, sans aucun pont vers la production. Le document prépare une mise en œuvre future; il ne demande pas d’exécuter les commandes, d’appliquer les migrations aujourd’hui ni de créer des credentials.

Le périmètre pilote est une instance de recette TradeLink et une instance de recette Kernel. Les événements sont synthétiques et minimisés. Aucun paiement, fournisseur PSP, mouvement de fonds, donnée KYC ou activité utilisateur réelle n’est utilisé.

## 2. Gate préalable obligatoire

Le code reste **DORMANT**. Aucun environnement ne peut être planifié au niveau de ressources ni créé avant que les contrôles suivants soient tous documentés :

1. A1–A8 ont chacun le statut `Validé` dans la note maître avec ID de rôle, personne nominative, décision, preuve datée et signature vérifiable. Aucun statut ne peut être inféré de l’approbation générale du propriétaire.
2. L’architecte Kernel approuve l’ADR, les contrats API versionnés, l’identité workload et le schéma d’inventaire produit/région/pays/instance/environnement.
3. Le responsable sécurité approuve le plan réseau, l’issuer/PKI de test, les audiences/scopes et le threat model.
4. Le DPO approuve l’inventaire des champs, la minimisation, la résidence, la rétention et le jeu synthétique.
5. Le propriétaire de l’environnement autorise explicitement la création des ressources de test et approuve l’empreinte, le budget éventuel et la date de nettoyage.
6. Les responsables QA/produit approuvent la matrice de non-régression et les seuils de réussite.

Un seul A-status `À arbitrer`, une signature ou une approbation manquante, ou une configuration ambiguë maintient le code en état `DORMANT` et arrête la Phase 1.

## 3. Topologie cible à valider

```text
Contrôle administratif nominatif
           │ accès d’administration temporaire et journalisé
           ├───────────────────────────────┐
           ▼                               ▼
Réseau QA Kernel                    Réseau QA TradeLink
API Control Plane de test           routes internes de test
Base PostgreSQL dédiée              Base MySQL dédiée
JWKS/issuer de recette              identité workload de recette
           │                               │
           └──── seuls flux de test explicitement allowlistés ────┘

Production : zone séparée; aucune route, réplication, secret, DNS privé,
identité, base, tunnel ou dépendance partagée avec les réseaux QA.
```

Ce dessin n’attribue aucun fournisseur cloud, VPC, CIDR, région cloud ou mécanisme PKI non encore décidé. Les valeurs sont remplies par les propriétaires techniques après les signatures; elles ne doivent pas être inventées dans le code.

## 4. Isolation stricte des réseaux

### 4.1 Règle par défaut

- Séparer les projets/comptes/tenants, réseaux privés, sous-réseaux et politiques d’accès de recette des environnements de production.
- Refuser tout trafic QA→production et production→QA, y compris par route directe, transit, VPN, peering, proxy, tunnel, DNS privé, endpoint partagé ou compte de service.
- Refuser par défaut tout trafic sortant; n’autoriser que les destinations nécessaires et nommées de recette : APIs Kernel QA, routes internes TradeLink QA, JWKS/issuer QA, stockage des secrets QA, DNS/temps et télémétrie QA contrôlés.
- Exposer les routes de recette uniquement sur les réseaux privés autorisés. Pas d’URL publique de contrôle administratif; toute exception réseau doit être séparément approuvée et temporaire.
- Séparer les rôles d’administration, appliquer le moindre privilège, journaliser les changements de firewall et révoquer les accès temporaires après recette.

### 4.2 Tests de non-connectivité

Avant les tests fonctionnels, prouver au niveau réseau et application :

- résolution DNS des seuls noms de test autorisés;
- refus des FQDNs, ports, IP/CIDR et hôtes DB connus de production;
- absence de route et de peering vers les VPC/segments de production;
- échec des jetons d’essai sur endpoints de production par issuer, audience, environnement et identifiant de cible;
- refus d’un chemin de production vers l’issuer JWKS, coffre de secrets ou bases QA;
- inspection automatique de la configuration/IaC pour détecter identifiants d’environnement ou hôtes production.

**Acceptation :** aucun test de connectivité ou d’authentification croisée ne réussit; les refus sont capturés sans consigner de credential.

## 5. Isolation des bases de données

- Créer une base Kernel QA dédiée et une base TradeLink QA dédiée; aucun partage de cluster, compte administrateur, mot de passe, rôle, schema, backup ou réplication avec une base de production.
- Créer les schémas à partir des migrations versionnées. Les données sont des fixtures synthétiques générées; aucune sauvegarde ou extraction d’une base réelle n’est importée.
- Utiliser deux identités DB distinctes, à privilèges minimaux et propres à la recette; les credentials sont stockés uniquement dans le coffre QA, jamais dans Git, les logs ou variables frontend.
- Désactiver les chemins de réplication, fédération, ETL et export réel. Toute exportation de résultats doit être limitée au rapport de test nettoyé.
- Appliquer `up`, vérifier contraintes/index/idempotence, exercer le test de rétention sur données synthétiques, puis vérifier la restauration et le retour arrière dans des bases jetables.
- Tester l’arrêt de la base Kernel et l’indisponibilité de l’outbox sans perte de parcours utilisateur; tester l’indisponibilité MySQL sans compromettre ou dupliquer des événements.

**Acceptation :** des preuves d’instances/bases distinctes, aucun lien de réplication, comptes isolés, migrations et restauration testées uniquement sur les bases QA.

## 6. Identités et secrets de recette

- Après validation A2, utiliser l’issuer workload/PKI fourni et opéré par l’équipe désignée; ne pas fabriquer un issuer ad hoc dans l’application.
- Séparer les identités `kernel-qa` et `tradelink-qa`, avec `iss`, `aud`, `sub`, `scope`, `applicationId`, `instanceId` et `environment` spécifiques à la recette.
- Émettre des credentials courts, révoquables et rotatifs; limiter les clés JWKS aux hôtes QA autorisés et empêcher les redirections et origines inconnues.
- Ne jamais copier de bearer, certificat, clé privée, JWKS secret ou secret de prod vers le poste de recette ou la CI.
- Vérifier explicitement que JWT utilisateur/GSG ID et cookie Manus OAuth n’autorisent pas les endpoints Control Plane; les credentials workload ne créent aucune session utilisateur.

Les valeurs d’issuer, audiences, scopes et secrets restent vides dans cette proposition. Aucune valeur n’est générée ou sauvegardée ici.

## 7. Ordre d’exécution prévu après approbation

1. **Readiness review :** vérifier les huit signatures, les références juridiques/sectorielles, les propriétaires, les coûts et l’approbation formelle de la recette.
2. **Provisionnement cloisonné :** propriétaire réseau/plateforme crée deux espaces QA séparés et documente les deny rules; un autre référent vérifie la séparation.
3. **Bases :** créer les deux bases QA indépendantes; exécuter les migrations addititives après revue; injecter seulement les fixtures synthétiques.
4. **Sécurité machine :** configurer l’issuer/PKI de test approuvé et les identités propres aux deux instances; vérifier les refus croisés.
5. **Déploiement du code dormant :** déployer la branche/version revue dans l’espace QA, sans activer l’export avant que le contrat, la configuration et les flags de recette soient validés par les responsables.
6. **Smoke tests contractuels :** JWT workload positif, mauvais scope/issuer/audience/environnement/cible, payload invalide, rate limit, `no-store`, idempotence et erreur de base.
7. **Matrice de non-régression :** exécuter les tests utilisateurs décrits au §8; comparer aux résultats de référence.
8. **Pannes et reprise :** Kernel indisponible, timeout, retry, duplication, conflit de clé, outbox pleine, révocation d’identité, kill-switch, replay et purge synthétique.
9. **Clôture de recette :** dossier de preuves nettoyé, risques ouverts, rapport signé par les rôles requis, décision explicite d’arrêter, corriger ou préparer une phase pilote. Aucune promotion automatique.

## 8. Matrice de non-régression à exécuter

| ID | Parcours | Cas obligatoires | Condition de réussite |
|---|---|---|---|
| T1 | Consultation publique guest-first | Session vierge, lenteur, Kernel indisponible | Pages publiques chargées sans connexion; aucune redirection ou attente induite par le reporting |
| T2 | Actions protégées | Invité, connecté, session expirée, rôle non autorisé | La connexion reste requise seulement au moment de l’action; les refus locaux restent identiques |
| T3 | Manus OAuth/session | Callback, cookie, requête connectée, logout | Parcours de session inchangé; identité workload refusée comme session; cookie utilisateur refusé sur endpoint interne |
| T4 | Routes Control Plane | JWT valide/invalides, scopes, instance, environnement, no-store, 404 désactivé | Seul le workload QA allowlisté et le scope attendu accèdent à la route de recette |
| T5 | Panne Kernel | DNS indisponible, timeout, 5xx, retry | Aucun blocage visible du parcours utilisateur; retry borné asynchrone; aucune exception ou boucle infinie |
| T6 | Outbox/audit local | succès DB, rollback, doublon, timeout après commit, payload conflictuel | Atomicité locale; doublon identique idempotent; collision non identique en revue manuelle |
| T7 | Minimisation | canaris synthétiques pour identifiant personnel, KYC, texte libre | Aucun champ/canari exclu dans Kernel, endpoint GET, DB, log, trace, CI, captures ou rapport |
| T8 | M1 Gouvernance | hold, retrait, revue, journal/audit | Aucune altération de statut ou automatisation inattendue; référence locale inchangée |
| T9 | Score Business | données synthétiques de score et seuils V1–V4 non signés | Aucun score ou composant publié/recalculé par Control Plane; moteur toujours gelé |
| T10 | M2 Marketplace | consultation, qualité catalogue, aperçus d’ingestion synthétique | Accès guest-first/read-only; aucune création d’offre, stock, commande, réservation ou paiement |
| T11 | Isolation pays/environnement | jeton QA d’un pays sur une autre instance, QA→prod, prod→QA | Tous les cas inter-pays/inter-environnements refusés et auditables sans fuite |
| T12 | Saturation/revocation | quota dépassé, outbox pleine, token révoqué, kill-switch | Réponse contrôlée; activité locale non bloquée; alertes/état d’opération documentés |

**Seuil de sortie :** 100 % des cas obligatoires réussis, aucune fuite de secret/donnée, aucun incident P0/P1 ouvert, aucune régression guest-first/Auth/M1/Score/M2; tous les écarts et versions de code/config sont rattachés au procès-verbal. Les seuils doivent être approuvés par le Lead Dev, Architecte Sécurité et DPO affectés.

## 9. Contrôles de livraison et destruction

- Les résultats contiennent uniquement les versions, identifiants techniques non sensibles, cas réussis/échoués et références d’approbation.
- Captures, fichiers et logs ne contiennent pas de secrets, tokens, données personnelles ou détails bruts de payload.
- Chaque ressource, clé temporaire, règle firewall et compte QA est inscrite à un inventaire avec owner et date d’expiration.
- À la fin, révoquer les identités temporaires, désactiver l’ingestion, fermer les accès réseau et détruire les ressources de recette sur autorisation; conserver uniquement le procès-verbal dans la rétention approuvée.
- La destruction du laboratoire ne supprime aucune donnée de production et ne déclenche aucune purge des systèmes applicatifs.

## 10. Registre de préparation — pas un inventaire de ressources existantes

| Domaine | Valeur à fournir par l’équipe | Responsable à confirmer | Statut |
|---|---|---|---|
| A1–A8 | Huit lignes signées, chacune passée à `Validé`; A1/A3=`R-ARCH-K`, A2=`R-SEC`, A4/A7=`R-LD-K`, A5/A6=`R-DPO`, A8=`R-LD-TL` | Personne, autorité, signature et date à renseigner pour chaque ID de rôle dans la note maître | Bloquant — propriétaire a approuvé; ratification des référents en attente |
| Réseau Kernel QA | Nom de tenant/projet, sous-réseau, deny/allow rules, egress | Lead Dev Kernel + Sécurité réseau | Non provisionné |
| Réseau TradeLink QA | Nom de tenant/projet, sous-réseau, deny/allow rules, egress | Lead Dev TradeLink + Sécurité réseau | Non provisionné |
| Bases | PostgreSQL QA Kernel; MySQL QA TradeLink; identités de service séparées | Lead Dev Kernel / Lead Dev TradeLink | Non provisionnées |
| Issuer/PKI | URL/issuer QA, JWKS/CA, rotation, audience/scopes, coffre QA | Architecte Sécurité | Non désigné |
| Données | Fixtures synthétiques, cycle de rétention et résultat autorisé | DPO + QA | À approuver |
| Testeurs | responsables, fenêtres, procédure incident/rollback | Lead Devs + QA | À planifier après signatures |
| Go/No-Go | procès-verbal par phase signé | Architecte Kernel + Sécurité + propriétaire produit | Pas encore ouvert |

Ce registre est un modèle à remplir après les signatures; il ne déclare aucune ressource comme existante ou commandée.
