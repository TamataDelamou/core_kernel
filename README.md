# GSG ID — Identité et authentification fédérée

Module **GSG ID** du GSG Platform Kernel (Cahier de Conception v3.0), implémentant
intégralement les règles **KER-ID-01 à KER-ID-06** ainsi que les principes transverses
**KER-VIS**, **KER-ARC** et **KER-NOM** applicables à ce service.

Ce module est le premier brique du noyau livrée en code de production. Il sert de
référence pour l'implémentation des briques suivantes (Org Registry, Registre Produits,
GSG Referential, GSG Referential Engine, Event Bus, Audit).

## 0. Modèle d'authentification de référence (correction — Supabase natif)

**Ce document corrige une hypothèse antérieure.** Une première version de ce module avait
implémenté un flux OTP entièrement géré par GSG ID (génération de code, dispatch WhatsApp
via Meta Cloud API, dispatch e-mail via Resend), sur la base d'un schéma pensé pour Firebase
(`AdminSDK.createCustomToken`). Ce schéma a été retiré : le document de référence réel
("Modèle d'authentification — Migration Firebase → Supabase") établit que **Supabase Auth
est nativement le fournisseur OTP de chaque produit GSG** :

- **Téléphone** : `supabase.auth.signInWithOtp({ phone, options: { channel: 'sms' | 'whatsapp' } })`
  puis `verifyOtp({ phone, token, type: 'sms' })` — provider Twilio/MessageBird/Vonage,
  canal WhatsApp via Twilio (Twilio Verify) sans backend custom.
- **Email** : `signInWithOtp({ email })` → Magic Link (flux PKCE) ou code OTP e-mail
  (template personnalisé avec `{{ .Token }}`), puis `verifyOtp({ email, token, type: 'email' })`.

**GSG ID ne génère et ne vérifie jamais lui-même un code OTP.** Son rôle, conforme à
KER-ID-02 ("l'intégration à un produit déjà en production se fait par ajout d'une simple
table de correspondance... sans modification du système d'authentification déjà en place"),
est de **vérifier la session Supabase déjà authentifiée par le produit** et de la relier à
un profil GSG ID unique — c'est le mécanisme `SupabaseSessionExchangeUseCase` décrit en
section 1 ci-dessous. Le "système déjà en place" est ici Supabase Auth lui-même.

## 1. Portée fonctionnelle

- **Authentification fédérée OIDC/OAuth2** (KER-ID-01) : un utilisateur s'authentifie une
  fois auprès de GSG ID pour accéder à tous les produits GSG auxquels son organisation
  est abonnée.
- **Pont d'identité Supabase** (KER-ID-02, section 0 ci-dessus) : `POST /v1/auth/sso/supabase`
  échange une session Supabase déjà authentifiée (SMS, WhatsApp, Magic Link ou OTP e-mail)
  contre une session GSG ID, avec dédup automatique par email/téléphone déjà confirmé.
- **Intégration a posteriori non destructive, cas générique** (KER-ID-02) :
  `POST /v1/external-identities/link` reste disponible pour tout produit qui ne serait
  *pas* sur Supabase et disposerait déjà d'une session GSG ID active, sans passer par
  l'échange décrit ci-dessus.
- **GSG ID en option, jamais en remplacement forcé** (KER-ID-03) : ce service n'impose
  aucune migration ; l'intégration reste additive (KER-VIS-01).
- **MFA implémenté une seule fois, réutilisable par tous les produits** (KER-ID-04) :
  TOTP (RFC 6238) + codes de récupération à usage unique, exposés via `/v1/mfa/*`.
  S'applique aux comptes créés par mot de passe classique ; un compte provisionné via le
  pont Supabase peut activer le MFA GSG ID de la même façon une fois sa session établie.
- **Références au GSG Referential portées par le profil** (KER-ID-05) : `pays_id`,
  `unite_administrative_id`, `ville_id`, `langue_id`, `devise_id`, `fuseau_horaire`.
- **Téléphone au format E.164 strict** (KER-ID-06), validé par Value Object dédié.
- **RBAC granulaire** : rôles globaux (noyau) ou scopés par organisation (`gsg_org_id`),
  cohérent avec KER-ORG-03 (une organisation reste libre de son périmètre produit).
- **Comptes sans mot de passe et/ou sans email** : un profil créé via le pont Supabase peut
  n'avoir qu'un téléphone (cas WhatsApp-only, courant sur les marchés où GSG opère) — voir
  `User.registerViaVerifiedExternalIdentity`. Un tel compte ne peut jamais s'authentifier
  par mot de passe GSG ID (`passwordHash` null), seulement via le pont Supabase.

## 2. Architecture

Clean Architecture / Domain-Driven Design, quatre couches strictement découplées :

```
src/identity/
├── domain/            # Entités, Value Objects, ports (interfaces) — zéro dépendance framework
├── application/        # Use-cases (orchestration), DTOs
├── infrastructure/     # Adaptateurs concrets : TypeORM, Argon2, JWT, TOTP, Redis Streams
└── interface/http/     # Contrôleurs NestJS, DTOs de validation d'entrée
```

Le domaine ne connaît ni NestJS, ni TypeORM, ni Express : toute dépendance technique est
injectée via un port (interface) défini dans `domain/services` ou `domain/repositories`,
et résolue par `identity.module.ts`. Ce découplage est ce qui permettra, demain, de faire
évoluer le stockage ou le bus d'événements sans toucher à la logique métier — conforme à
**KER-ARC-01** (adaptateur dédié) et **KER-VIS-03** (bases hétérogènes possibles par produit).

### Ports et infrastructure transverses au noyau

Certains éléments ne sont pas spécifiques à un module produit du noyau mais communs à tous
(GSG ID, GSG Referential, et les briques futures) :

- `src/common/kernel-ports/` — ports partagés, ex. `EventPublisher` (KER-EVT-01). Un module
  produit ne redéfinit jamais son propre port d'événement : il consomme celui-ci.
- `src/common/kernel-infrastructure/` — implémentations concrètes de ces ports, ex.
  `RedisEventPublisherService`. Fourni une seule fois par `KernelInfrastructureModule`
  (`@Global()`, importé dans `AppModule`), pour n'ouvrir qu'une seule connexion Redis
  Streams partagée par tout le noyau plutôt qu'une par module.

Cette séparation elle-même est une application directe de **KER-VIS-05** (un seul
référentiel/mécanisme transverse, jamais dupliqué — y compris au sein du noyau lui-même).

### Conformité KER-NOM (convention de nommage)

- **Services et identifiants techniques en anglais** (KER-NOM-03) : `GSG ID`, classes
  TypeScript, endpoints REST, noms de tables du service lui-même.
- **Références au référentiel métier partagé en français** (KER-ID-05, KER-NOM-01) :
  colonnes `pays_id`, `unite_administrative_id`, `ville_id`, `langue_id`, `devise_id`,
  `fuseau_horaire` — jamais traduites, pour rester directement interopérables avec le
  GSG Referential (section 6-7 du Cahier) et le Referential Engine (section 8) une fois
  ces services développés.

### Découplage inter-services (KER-VIS-03)

Aucune contrainte de clé étrangère physique n'est posée entre `utilisateur.pays_id` et
une éventuelle table `pays` : GSG Referential est un service distinct, appelé exclusivement
par API. L'intégrité référentielle applicative est de la responsabilité du use-case
appelant (`UpdateUserReferentielUseCase`), qui pourra, une fois GSG Referential développé,
valider l'existence du `pays_id` via un appel HTTP avant persistance.

### Disponibilité découplée (KER-ARC-03, KER-VIS-04)

La publication d'événements (`RedisEventPublisherService`) ne bloque jamais un use-case :
toute erreur de publication est journalisée et absorbée, jamais propagée. Un produit qui
n'intègre aucune brique du noyau — y compris GSG ID — reste pleinement fonctionnel.

## 3. Sécurité (OWASP)

| Contrôle | Implémentation |
|---|---|
| Stockage de mot de passe | Argon2id (m=19 MiB, t=2, p=1) — `Argon2PasswordHasherService` |
| Anti-brute-force | Verrouillage de compte après 5 échecs consécutifs (15 min), + rate limiting par endpoint (`@Throttle`) |
| Anti-énumération de comptes | Vérification Argon2 exécutée même si l'utilisateur n'existe pas (temps de réponse uniformisé) ; message d'erreur générique |
| Rotation des refresh tokens | Chaque `refresh` invalide l'ancien jeton et en émet un nouveau dans la même famille ; un rejeu détecté révoque toute la famille |
| MFA | TOTP RFC 6238 + codes de récupération hashés (SHA-256, usage unique) ; secret chiffré au repos (AES-256-GCM) |
| Téléphone | Format E.164 strict, validé par Value Object (`libphonenumber-js`) |
| En-têtes HTTP | `helmet` (CSP, HSTS, no-referrer) |
| Validation d'entrée | `class-validator` avec `whitelist: true, forbidNonWhitelisted: true` — tout champ non déclaré est rejeté |
| Fuite d'information | Filtre d'exception global : stack traces jamais renvoyées au client, uniquement un `errorId` de corrélation journalisé côté serveur |
| Secrets | `.env` jamais commité ; validation fail-fast au démarrage (longueur minimale des secrets JWT/MFA) |

## 4. Démarrage local

```bash
cp .env.example .env
# Renseigner JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (32+ caractères)
# et MFA_ENCRYPTION_KEY_HEX : openssl rand -hex 32

docker compose up -d gsg-id-postgres gsg-id-redis
npm install
npm run migration:run
npm run start:dev
```

L'API écoute par défaut sur `http://localhost:3000/api/v1`.

## 5. Endpoints principaux

| Méthode | Route | Description | Auth |
|---|---|---|---|
| POST | `/v1/auth/register` | Inscription (KER-ID-05/06) | Publique, rate-limited |
| POST | `/v1/auth/login` | Authentification ; renvoie `mfa_required` si MFA actif | Publique, rate-limited |
| POST | `/v1/auth/mfa/verify` | Finalise le login après challenge MFA | Publique (jeton de challenge court), rate-limited |
| POST | `/v1/auth/refresh` | Rotation du refresh token | Publique (refresh token requis) |
| POST | `/v1/auth/sso/supabase` | Échange session Supabase ↔ session GSG ID (KER-ID-02, section 0) | Publique, rate-limited |
| POST | `/v1/mfa/enroll/start` | Démarre l'enrôlement TOTP (QR code) | JWT |
| POST | `/v1/mfa/enroll/confirm` | Confirme l'enrôlement (code à 6 chiffres) | JWT |
| GET | `/v1/users/me` | Profil courant, y compris référentiel (KER-ID-05) | JWT |
| PATCH | `/v1/users/me/referentiel` | Met à jour pays/langue/devise/fuseau horaire | JWT |
| POST | `/v1/users/:gsgId/roles` | Attribution de rôle | JWT + rôle `kernel.admin` ou `org.owner` |
| POST | `/v1/external-identities/link` | Liaison identité externe (KER-ID-02) | JWT |

### Prérequis pour `/v1/auth/sso/supabase`

- Le projet Supabase du produit appelant doit être ajouté à `SUPABASE_ALLOWED_PROJECT_URLS`
  (liste blanche stricte, anti-SSRF — voir `JoseSupabaseSessionVerifier`).
- **Le projet Supabase doit utiliser les clés de signature JWT asymétriques** (fonctionnalité
  "JWT Signing Keys", RSA ou EC — Authentication > JWT Keys dans le dashboard Supabase).
  Un projet resté sur l'ancien secret HS256 partagé expose un JWKS vide
  (`/auth/v1/jwks`) et la vérification échouera systématiquement. C'est un prérequis
  opérationnel à valider avant d'intégrer un produit, pas une option.

### Résilience du cache JWKS (`JoseSupabaseSessionVerifier`)

Le JWKS de chaque projet Supabase autorisé est mis en cache localement, avec un
comportement volontairement plus robuste que le cache opaque par défaut de `jose` :

| Propriété | Comportement | Pourquoi |
|---|---|---|
| **TTL court** (`SUPABASE_JWKS_CACHE_TTL_SECONDS`, 300s par défaut) | Le jeu de clés est réutilisé pendant ce délai avant tout nouvel appel réseau. | Évite d'interroger Supabase à chaque authentification. |
| **Single-flight** | Plusieurs vérifications concurrentes sur cache expiré ne déclenchent qu'**un seul** appel réseau — les autres attendent son résultat. | Sans ça, un pic de trafic juste après expiration du TTL déclencherait autant d'appels sortants que de requêtes entrantes simultanées ("thundering herd"). |
| **Timeout réseau** (`SUPABASE_JWKS_FETCH_TIMEOUT_MS`, 4000ms par défaut) | Tout appel au JWKS Supabase est abandonné après ce délai. | Un point de terminaison lent ne doit jamais faire attendre indéfiniment une requête d'authentification. |
| **Repli sur clés périmées** | Si le rafraîchissement échoue (timeout, panne réseau), le dernier jeu de clés connu est réutilisé plutôt que de faire échouer la vérification. | **C'est la garantie centrale** : un ralentissement ou une panne du JWKS Supabase ne bloque jamais l'authentification de toute la plateforme GSG ID — seul le tout premier appel jamais réussi pour un projet ne peut en bénéficier. |
| **Rafraîchissement forcé sur échec** | Un `kid` inconnu ou une signature invalide déclenche un rafraîchissement immédiat hors TTL (rotation de clé légitime côté Supabase), suivi d'un seul nouvel essai. | Une rotation de clé ne doit pas obliger à attendre l'expiration du TTL normal pour redevenir opérationnelle. |
| **Cooldown anti-martèlement** (`SUPABASE_JWKS_FORCED_REFRESH_COOLDOWN_SECONDS`, 10s par défaut) | Le rafraîchissement forcé ci-dessus ne peut se déclencher plus d'une fois par intervalle, par projet. | Sans ce plafond, un flot de jetons forgés deviendrait un vecteur pour marteler le JWKS Supabase à chaque tentative. |

Couvert par `test/unit/identity/domain/supabase-jwks-cache.spec.ts` : appel réseau unique
en cas de succès, réutilisation du cache tant que le TTL est valide, déduplication
single-flight sous concurrence, repli effectif sur clés périmées, rafraîchissement forcé
sur rotation de clé, et non-déclenchement d'un second rafraîchissement forcé pendant le
cooldown.

## 6. Événements publiés (KER-EVT-01)

Catalogue exhaustif dans `src/identity/domain/events/identity-event-catalog.ts`. Chaque
événement respecte le schéma commun du noyau : `type`, `gsgOrgId`, `horodatage`,
`produitSource`, `chargeUtile`. Publié sur Redis Streams (`gsg.identity`), consommable par
tout produit s'y abonnant librement (KER-EVT-02) — aucun couplage direct de code.

## Prochaines briques du noyau

Org Registry (module suivant, déjà livré — voir section suivante) et GSG Referential
Engine (section 8 — méta-modèle générique, hiérarchie administrative) restent à construire
au-delà du Referential lui-même, selon le même modèle d'architecture.

---

# Org Registry — organisations clientes, filiales, abonnements

Module implémentant **KER-ORG-01 à KER-ORG-04** (section 4 du Cahier).

## Portée fonctionnelle

- **Registre central** (KER-ORG-01) : attribue un `gsg_org_id` global à chaque organisation
  cliente. KER-ORG-02 (intégration a posteriori) ne nécessite aucune table de correspondance
  côté Org Registry — le produit existant stocke directement ce `gsg_org_id` dans son propre
  champ de référence, contrairement à GSG ID où l'identité produit préexistante imposait une
  table `correspondance_identite_externe`.
- **Filiales** : une organisation peut avoir une `organisationMereId`, formant un arbre de
  filiation. `ReattachOrganisationUseCase` détecte et refuse tout rattachement qui créerait
  un cycle (remontée d'arbre bornée par la profondeur réelle de la hiérarchie).
- **Unités opérationnelles** : agences/antennes internes à une organisation, sans `gsg_org_id`
  propre (contrairement à une filiale) mais avec leur propre référentiel — c'est le mécanisme
  concret derrière "une organisation peut ouvrir une agence dans un autre pays sans qu'aucune
  ligne de code applicatif ne soit modifiée" (KER-ORG-04).
- **Référentiel indépendant par organisation** (KER-ORG-04) : `paysId`, `uniteAdministrativeId`,
  `villeId`, `deviseId`, `langueId`, `fuseauHoraire` — jamais hérités automatiquement d'une
  maison mère ; chaque organisation et chaque unité opérationnelle porte les siens.
- **Abonnements produit** (KER-ORG-03) : une organisation choisit librement le sous-ensemble
  de produits GSG auquel elle est abonnée (`actif`/`suspendu`/`resilie`) ; aucun mécanisme
  n'impose ni ne déduit un abonnement à partir d'un autre.

## Fermeture du contrôle de portée (KER-ORG-03 ↔ GSG ID)

`AssignRoleUseCase` (module GSG ID) injecte désormais `OrganisationLookupPort`
(`common/kernel-ports/organisation-lookup.port.ts`), implémenté par `OrganisationLookupAdapter`
dans ce module. Toute tentative d'attribuer un rôle scopé à un `gsgOrgId` qui n'existe pas ou
correspond à une organisation désactivée est refusée avec `InvalidOrganizationScopeError`
(HTTP 400). Avant Org Registry, ce contrôle était impossible à faire — `gsgOrgId` était un UUID
non vérifié. `IdentityModule` importe `OrgModule` (dépendance à sens unique, aucun cycle).

## Endpoints principaux

| Méthode | Route | Description | Auth |
|---|---|---|---|
| POST | `/v1/org/organisations` | Création (attribue le gsg_org_id) | JWT + `kernel.admin` |
| GET | `/v1/org/organisations/:id` | Détail | JWT + `kernel.admin`/`org.owner` |
| GET | `/v1/org/organisations/:id/filiales` | Filiales directes | JWT + `kernel.admin`/`org.owner` |
| PATCH | `/v1/org/organisations/:id/referentiel` | Référentiel propre (KER-ORG-04) | JWT + `kernel.admin`/`org.owner` |
| POST | `/v1/org/organisations/:id/reattach` | Rattachement filiale (détection de cycle) | JWT + `kernel.admin` |
| POST | `/v1/org/unites-operationnelles` | Création d'agence/antenne | JWT + `kernel.admin`/`org.owner` |
| POST | `/v1/org/organisations/:organisationId/abonnements` | Souscription à un produit | JWT + `kernel.admin` |
| POST | `/v1/org/.../abonnements/:id/resiliate` | Résiliation | JWT + `kernel.admin` |

## Prochaines briques

Le **Triptyque d'Or (GSG ID — GSG Referential — Org Registry)** est maintenant complet.
Restent : le **GSG Referential Engine** (section 8 — méta-modèle générique, hiérarchie
administrative), le **Registre central des produits** (section 5, actuellement simulé par
des `produitId` UUID libres), le **bus d'événements** en tant que consommateur documenté,
et l'**audit centralisé** (section 12) qui agrège les événements déjà publiés par les trois
modules existants.

---

# GSG Referential — pays, devises, langues, blocs régionaux

Module implémentant **KER-REF-01 à KER-REF-09** (section 6 du Cahier) et **KER-ADM-03/04**
(section 7 — hors hiérarchie administrative générique, qui relève du Referential Engine,
service distinct non couvert ici).

## Portée fonctionnelle

- **Pays** (KER-REF-01) : source unique de vérité, code ISO 3166-1 alpha-2, gabarit d'adresse
  et fuseau horaire IANA (KER-REF-09).
- **Devise** (KER-REF-02) : alignée ISO 4217, avec `decimales` officiel (0 pour XOF/GNF, 3
  pour KWD) et zone monétaire régulatrice (KER-REF-08, ex. XOF → BCEAO).
- **Pays ↔ Devise** (KER-REF-03) : relation many-to-many datée ; une seule devise principale
  active à la fois par pays, sans empêcher la circulation de devises secondaires.
- **Taux de change** (KER-REF-04) : unique source de la plateforme. `ResolveExchangeRateUseCase`
  ne renvoie **jamais** de parité 1:1 implicite — absence de taux valide à l'instant demandé
  = erreur explicite (`NoValidExchangeRateError`, HTTP 404 via le filtre global).
- **Langue** (KER-REF-06) : alignée ISO 639, avec rattachement pays (statut officielle/
  nationale/enseignement_initial/véhiculaire, ordre).
- **Bloc régional** (KER-REF-07) : appartenance datée, modélisant explicitement le retrait
  du Mali, du Burkina Faso et du Niger de la CEDEAO le 29 janvier 2025 comme cas d'école.
- **Ville** (KER-ADM-03) : entité dédiée indexée, référence optionnelle et non contrainte
  vers un futur nœud `referentiel_hierarchique` du Referential Engine.
- **Workflow de publication** (KER-AUD-04, KER-ENG-07) : toute entité structurelle
  (pays, devise, langue, bloc régional) suit `brouillon → en_revision → valide → publie`.
  Seules les entrées `publie` sont renvoyées par défaut aux produits consommateurs ; les
  statuts intermédiaires ne sont visibles que via les endpoints réservés au rôle
  `kernel.admin` (back-office transversal commun à tout le portefeuille).

## Découplage inter-services

Aucune contrainte de clé étrangère physique n'existe entre `ville.referentiel_hierarchique_id`
et une future table du Referential Engine (service distinct, section 8 du Cahier, non couvert
par ce module) : conforme à KER-VIS-03, l'intégration se fera exclusivement par API le moment
venu. De même, GSG Referential ne référence jamais `utilisateur` (module GSG ID) directement.

## Endpoints principaux

| Méthode | Route | Description | Auth |
|---|---|---|---|
| GET | `/v1/referential/pays` | Liste des pays publiés (ou tous si `kernel.admin`) | Publique / JWT |
| POST | `/v1/referential/pays` | Création (statut initial : brouillon) | JWT + `kernel.admin` |
| POST | `/v1/referential/pays/:id/workflow/*` | Transitions de workflow | JWT + `kernel.admin` |
| GET | `/v1/referential/devises` | Liste des devises publiées | Publique |
| POST | `/v1/referential/devises/attach-to-pays` | Rattachement devise↔pays daté | JWT + `kernel.admin` |
| GET | `/v1/referential/taux-change/resolve` | Résout un taux à un instant donné (KER-REF-04) | Publique |
| POST | `/v1/referential/taux-change` | Enregistre un nouveau taux | JWT + `kernel.admin` |
| GET | `/v1/referential/langues` | Liste des langues publiées | Publique |
| GET | `/v1/referential/blocs-regionaux` | Liste des blocs régionaux publiés | Publique |
| POST | `/v1/referential/blocs-regionaux/adhesions/:id/retrait` | Retrait daté (cas CEDEAO) | JWT + `kernel.admin` |
| GET | `/v1/referential/villes/par-pays/:paysId` | Villes d'un pays | Publique |

## Événements publiés (KER-EVT-01)

Catalogue dans `src/referential/domain/events/referential-event-catalog.ts`. Les événements
`*.published` permettent aux produits consommateurs d'invalider leur cache local d'AppConfig
dès qu'une donnée référentielle devient effectivement utilisable.

## Prochaines briques du noyau

Le **Triptyque d'Or (GSG ID — GSG Referential — Org Registry)** est complet (voir la section
Org Registry plus haut dans ce document). Restent : le **GSG Referential Engine** (section 8,
méta-modèle générique), le **Registre central des produits** (section 5, actuellement simulé
par des `produitId` UUID libres non vérifiés), et l'**audit centralisé** (section 12) qui
agrégera les événements déjà publiés par les trois modules existants.

---

# GSG Product Catalog — référentiel produit, offres, grilles tarifaires

Module implémentant **KER-PRD** (extension du registre central des produits, section 5 du
Cahier, avec un niveau de granularité commerciale — catalogues, plans, entitlements, tarifs
— non couvert par la table `produit` minimale de KER-PROD-01).

## Portée fonctionnelle

- **Multi-catalogues & scopes** : un `Catalogue` cible soit tout le portefeuille
  (`portefeuille_global`), soit une organisation précise (`organisation`, référence un
  `gsg_org_id` vérifié via `OrganisationLookupPort`), soit une zone géographique
  (`zone_geographique`, référence un `pays_id`).
- **Produits & Offres** : un `Produit` (ex. "Pack Association Essentiel") porte plusieurs
  `Offre` — Abonnement, Usage ou Ponctuel — avec un invariant de domaine strict : une offre
  `ponctuel` n'accepte qu'une période de facturation `unique`, et inversement un abonnement
  ou une offre à l'usage ne peut jamais être facturé en `unique` (`IncompatibleBillingPeriodError`).
- **Features & Entitlements** : des `Feature` transversales (ex. `export-pdf`), rattachées à
  une offre via `OffreEntitlement` avec une limite optionnelle (`null` = illimité).
- **Grilles tarifaires versionnées** : chaque `GrilleTarifaire` porte un `montantMinorUnit`
  entier (jamais de virgule flottante, cohérent avec KER-REF-05), une devise, et une fenêtre
  de validité `[dateEffective, dateFin)`. La version s'incrémente automatiquement à chaque
  nouvelle grille pour une même offre.
- **Cycle de vie à 4 états** : Brouillon → Validé → Publié → Archivé, appliqué à `Catalogue`,
  `Produit`, `Offre` et `GrilleTarifaire`. Workflow **local** à ce module
  (`product/domain/entities/catalog-workflow.ts`), volontairement distinct de celui de GSG
  Referential — les réutiliser aurait exigé d'importer du code interne à `referential`,
  contraire à l'isolation stricte exigée par la directive de développement de ce module.

## Isolation stricte (Shared Kernel uniquement)

Aucun fichier de `src/product/` — domaine, application, infrastructure ou interface — n'importe
une classe de `identity/`, `referential/` ou `org/`. Les deux seules dépendances inter-modules
sont deux imports de **module NestJS** dans `product.module.ts` (`OrgModule`, `ReferentialModule`),
strictement pour que le conteneur de dépendances résolve les ports partagés — jamais pour accéder
à leur code métier. Vérifié explicitement par grep sur les lignes d'import réelles (voir
historique de développement) : zéro import de `org/domain`, `org/application`,
`referential/domain` ou `referential/application` depuis `product/`.

### Ports transverses utilisés (et étendus)

- **`CurrencyValidationPort`** (nouveau, `common/kernel-ports/currency-validation.port.ts`) :
  `isCertified(deviseId)` — implémenté par `CurrencyValidationAdapter` côté GSG Referential.
  Une devise est "certifiée" si elle est publiée (workflow KER-AUD-04) ET active. **Interdiction
  absolue** : `CreateGrilleTarifaireUseCase` refuse toute création si `isCertified` renvoie
  `false`, avant même de persister quoi que ce soit (`UncertifiedCurrencyError`).
- **`OrganisationLookupPort`** (étendu) : nouvelle méthode `isDescendantOrSelf(organisationId,
  ancestorOrganisationId)`, implémentée côté Org Registry en réutilisant
  `OrganisationRepository.isDescendantOf` déjà existant. Ferme le contrôle de portée
  catalogue↔organisation : une filiale hérite du catalogue de sa maison mère, jamais l'inverse.

## Règle d'incompatibilité de grilles tarifaires

KER-PRD interdit deux grilles **publiées** pour la même offre et la même devise dont les
fenêtres de validité se chevauchent — sinon le prix applicable à un instant donné serait
ambigu. Portée par une fonction pure testable isolément
(`rangesOverlap`/`assertNoOverlapWithExisting`, bornes de début inclusives, bornes de fin
exclusives — une succession propre de tarifs n'est jamais un chevauchement). Le contrôle est
appliqué **deux fois** : à la création (contre les grilles déjà publiées) et à nouveau à la
publication elle-même (`TransitionGrilleTarifaireWorkflowUseCase.publish`), pour couvrir le cas
où une autre grille aurait été publiée entre-temps.

## Endpoints principaux

| Méthode | Route | Description | Auth |
|---|---|---|---|
| POST | `/v1/product/catalogues` | Création (scope validé si "organisation") | JWT + `kernel.admin` |
| GET | `/v1/product/catalogues/:id/pour-organisation/:organisationId` | Lecture avec fermeture du scope hiérarchique | JWT + `kernel.admin`/`org.owner` |
| POST | `/v1/product/produits` | Création d'un produit dans un catalogue | JWT + `kernel.admin` |
| POST | `/v1/product/offres` | Création d'une offre (invariant type/période vérifié) | JWT + `kernel.admin` |
| POST | `/v1/product/features` | Création d'une fonctionnalité | JWT + `kernel.admin` |
| POST | `/v1/product/features/entitlements/par-offre/:offreId` | Rattachement d'un entitlement | JWT + `kernel.admin` |
| POST | `/v1/product/offres/:offreId/grilles-tarifaires` | Création (devise certifiée requise) | JWT + `kernel.admin` |
| GET | `/v1/product/offres/:offreId/grilles-tarifaires/prix-actif` | Résolution du prix applicable à un instant | JWT + `kernel.admin`/`org.owner` |

## Événements publiés (KER-EVT-01)

Catalogue dans `src/product/domain/events/product-event-catalog.ts` — `ProductCreated`,
`CatalogPublished`, etc. (noms français en interne, alignés sur le schéma commun du noyau :
`type`, `gsgOrgId`, `horodatage`, `produitSource`, `chargeUtile`).

---

# Résilience de l'Event Bus & Module Audit Centralisé (Section 12)

## Transactional Outbox (`common/kernel-infrastructure/outbox/`)

Avant cette passe, `EVENT_PUBLISHER` (implémenté par l'ancien `RedisEventPublisherService`)
publiait directement vers Redis Streams (`XADD` synchrone) au moment de l'appel
`eventPublisher.publish(...)` dans un use-case. Un ralentissement ou une panne de Redis à cet
instant précis se traduisait par un échec silencieux — "best effort", simple log d'avertissement
— avec un risque réel de perte d'événement.

`OutboxEventPublisherService` remplace cette implémentation : `publish()` insère désormais une
ligne dans la table Postgres `evenement_outbox` (même base que l'entité métier qui vient d'être
sauvegardée) plutôt que d'appeler Redis. **Aucun des ~40 use-cases existants dans les 4 modules
n'a eu besoin d'être modifié** pour bénéficier de ce changement : ils dépendent tous
exclusivement du port `EVENT_PUBLISHER` (`common/kernel-ports/event-publisher.interface.ts`),
jamais de son implémentation concrète — c'est le bénéfice direct de l'architecture
ports-adaptateurs posée dès le premier module (GSG ID).

`OutboxRelayService` (tâche de fond, démarrée avec `KernelInfrastructureModule`) relaie ensuite
les lignes `en_attente` vers Redis Streams par lots, avec retry par ligne
(`OUTBOX_MAX_RETRIES`, défaut 10) avant bascule en statut terminal `echec` (visible pour
investigation ops — jamais silencieusement abandonné).

### Atomicité complète (Priorité 1 — retrofit terminé)

L'insertion dans `evenement_outbox` et la sauvegarde de l'entité métier partagent désormais
**la même transaction Postgres**, sans qu'aucun des ~40 use-cases existants n'ait eu besoin
d'être modifié. Trois pièces rendent cela possible :

1. **`TransactionContextService`** (`common/kernel-infrastructure/persistence/`) — porte
   l'`EntityManager` transactionnel ambiant via `AsyncLocalStorage`, propagé automatiquement
   à travers toute chaîne d'`await`, sans paramètre explicite à faire transiter.
2. **`TransactionInterceptor`** (`common/interceptors/`, enregistré globalement via
   `APP_INTERCEPTOR`) — ouvre une transaction pour toute requête HTTP d'écriture
   (`POST`/`PATCH`/`PUT`/`DELETE`), jamais pour une lecture.
3. **`TransactionalRepository<Entity>`** (classe de base) — chaque repository TypeORM du
   noyau en hérite désormais. Son seul rôle : exposer un getter `repo` qui résout soit
   l'`EntityManager` transactionnel ambiant (si actif), soit le repository par défaut injecté.

Le point clé du retrofit : **aucune méthode métier de repository n'a été réécrite**. Chaque
classe continue d'appeler `this.repo.findOne(...)`, `this.repo.save(...)` exactement comme
avant — seul le type réel de `this.repo` change dynamiquement. Le retrofit n'a donc touché
que le constructeur et la clause `extends` de chaque classe :

```typescript
export class TypeOrmPaysRepository extends TransactionalRepository<PaysOrmEntity> implements PaysRepository {
  constructor(
    @InjectRepository(PaysOrmEntity) repo: Repository<PaysOrmEntity>,
    transactionContext: TransactionContextService,
  ) {
    super(repo, transactionContext);
  }
  // ... toutes les méthodes existantes, inchangées
}
```

**27 repositories retrofités** : 6 (identity) + 9 (referential) + 3 (org) + 6 (product) +
2 (audit) + 1 (`TypeOrmOutboxEventRepository` lui-même — condition nécessaire pour que
l'insertion outbox rejoigne la même transaction que l'entité métier). Vérifié explicitement
par recherche systématique : aucune ancienne déclaration `private readonly repo` ne subsiste.

Conséquence concrète : si `CreatePaysUseCase` sauvegarde un `Pays` puis publie un événement,
et que l'insertion outbox échoue pour une raison quelconque (contrainte violée, connexion
perdue en plein milieu), **toute la transaction est annulée — le `Pays` n'est pas non plus
persisté**. C'est la garantie at-least-once stricte demandée : un événement publié correspond
toujours à une mutation métier réellement commit, jamais l'inverse.

## Module Audit (`src/audit/`)

Consomme le flux Redis Streams partagé (`gsg.kernel.events`) via un **Consumer Group**
(`XREADGROUP`/`XACK`), avec réclamation des messages bloqués (`XPENDING`/`XCLAIM`) et bascule
en **Dead-Letter Queue** après un nombre configurable de tentatives de livraison.
`AuditModule` est isolé du domaine des 4 autres modules — vérifié explicitement : aucun
fichier de `src/audit/` n'importe de code de domaine ou d'application appartenant à
`identity`, `referential`, `org` ou `product`. Une seule exception délibérée et documentée :
`AuditModule` importe le **module** `OrgModule` (jamais son domaine) pour la résolution DI
d'`ORGANISATION_LOOKUP_PORT`, condition de la fermeture du contrôle de portée décrite
ci-dessous.

### Deux boucles indépendantes (`RedisStreamsConsumerService`)

1. **Lecture** : `XREADGROUP ... BLOCK` en continu, ne lit que les messages jamais délivrés
   (`>`). Succès → `XACK` immédiat. Échec → le message N'est PAS acquitté, il reste "pending".
2. **Réclamation** (toutes les `AUDIT_CONSUMER_CLAIM_INTERVAL_MS`, défaut 15s) : `XPENDING`
   avec filtre `IDLE` inspecte les messages bloqués depuis plus de
   `AUDIT_CONSUMER_CLAIM_IDLE_MS` (défaut 30s — consommateur crashé en cours de traitement,
   ou échec de traitement). Ceux ayant dépassé `AUDIT_CONSUMER_MAX_DELIVERIES` (défaut 5)
   basculent en DLQ et sont acquittés ; les autres sont réclamés (`XCLAIM`) et retraités.

### Idempotence et défense en profondeur

- **Déduplication stricte** : `evenement_id` porte une contrainte d'unicité en base — un
  message retraité après une réclamation (crash d'un autre consommateur en cours de
  traitement, message déjà persisté juste avant le crash) ne crée jamais de doublon dans le
  journal d'audit.
- **Rédaction KER-AUD-03** : `redactSensitiveFields` (fonction pure,
  `audit/domain/services/redaction.ts`) remplace par `[REDACTED]` tout champ dont le nom
  correspond à une liste de motifs sensibles (mot de passe, jeton, code, secret...), à
  n'importe quelle profondeur d'imbrication. C'est une **défense en profondeur** — les
  producteurs sont déjà censés ne jamais inclure ce type de donnée dans une charge utile
  d'événement, cette rédaction protège contre un oubli, pas contre une politique absente.

### Fermeture du contrôle de portée multi-tenant (Priorité 2 — terminée)

`GET /v1/audit/trail` applique désormais deux régimes stricts :

- **`kernel.admin`** : vue transverse sans restriction — `gsgOrgId` reste un filtre optionnel.
- **`org.owner`** (ou tout rôle non-admin autorisé à atteindre l'endpoint) : `gsgOrgId`
  devient **obligatoire** (`AuditTrailScopeRequiredError`, HTTP 400 si absent), et doit
  correspondre à une organisation que l'appelant possède lui-même **ou dont il possède une
  organisation mère** (héritage descendant de la hiérarchie de filiales — même sémantique que
  le scope catalogue de Product Catalog), vérifié via `OrganisationLookupPort.isDescendantOrSelf`
  (`AuditTrailAccessDeniedError`, HTTP 403 sinon) — jamais une simple comparaison de chaîne
  côté client.

Ce contrôle s'appuie sur une extension du JWT lui-même : le claim `roles` (codes à plat) ne
suffisait pas à savoir à quelle(s) organisation(s) un `org.owner` est rattaché. Un nouveau
claim **`gsgOrgIds`** a été ajouté (`AuthenticateUserUseCase`, `RefreshTokenUseCase`,
`JwtTokenService`, `JwtAuthGuard`) — les organisations pour lesquelles l'utilisateur détient
au moins un rôle scopé (KER-ORG-03), résolues une fois à l'émission du jeton plutôt qu'à
chaque requête.

### Endpoints

| Méthode | Route | Description | Auth |
|---|---|---|---|
| GET | `/v1/audit/trail` | Consultation paginée (KER-AUD-01), scope fermé pour `org.owner` | JWT + `kernel.admin`/`org.owner` |
| GET | `/v1/audit/dead-letter` | Liste des entrées en échec définitif | JWT + `kernel.admin` |
| POST | `/v1/audit/dead-letter/:id/replay` | Rejeu manuel — jamais automatique | JWT + `kernel.admin` |

### Variables d'environnement ajoutées

```bash
# Renommé depuis EVENT_BUS_STREAM_PREFIX=gsg.identity — désormais partagé par tout le noyau.
EVENT_BUS_STREAM_PREFIX=gsg.kernel.events

OUTBOX_POLL_INTERVAL_MS=1000
OUTBOX_BATCH_SIZE=50
OUTBOX_MAX_RETRIES=10

AUDIT_CONSUMER_GROUP=audit-consumers
AUDIT_CONSUMER_BATCH_SIZE=10
AUDIT_CONSUMER_BLOCK_MS=5000
AUDIT_CONSUMER_MAX_DELIVERIES=5
AUDIT_CONSUMER_CLAIM_IDLE_MS=30000
AUDIT_CONSUMER_CLAIM_INTERVAL_MS=15000
```

### Ce qui reste (prochaine itération)

- Alerte opérationnelle (au-delà du log `error`) quand une ligne outbox atteint le statut
  `echec` ou qu'une entrée DLQ est créée — actuellement observable uniquement via requête
  directe sur les deux tables ou lecture des logs applicatifs.
- Test d'intégration Redis réel (Priorité 4 de la feuille de route) : `docker compose` +
  suite dédiée validant physiquement `XREADGROUP`, `XCLAIM` et la bascule DLQ après échecs
  répétés — actuellement, seule la logique de traitement extraite est testée (voir section
  Tests plus bas).
- Le `TransactionInterceptor` englobe toute la requête HTTP dans une transaction, y compris
  les appels sortants effectués par des ports comme `OrganisationLookupPort` ou
  `CurrencyValidationPort` (lectures inter-modules) — sans conséquence négative connue (ce
  sont des lectures), mais à garder en tête si un futur port inter-module devait un jour
  écrire.

---

# GSG Referential Engine (Section 8 — méta-modèle complet)

Module implémentant **l'intégralité du §8 du Cahier** : les quatre tables du méta-modèle
générique (`niveau_administratif` en satellite, `referentiel_hierarchique`,
`referentiel_regle`, `corpus_versionne`, `corpus_element`), plus la gouvernance KER-ENG-05/06.
Construit en deux passes : la hiérarchie administrative d'abord (débloquant
`ville.referentiel_hierarchique_id`, le cas concret qui bloquait le triptyque d'or), puis les
règles et le contenu versionné — désormais un futur EduRéussite (programmes scolaires) ou
GlobalStock ERP (régimes fiscaux) trouve les quatre tables prévues, pas seulement l'arbre.

## Cinq entités

- **`NiveauAdministratif`** : définition configurable par pays de la séquence des niveaux
  (KER-ADM-01) — "Région/Préfecture/Sous-préfecture" pour un pays, "District/Comté" pour un
  autre ne sont que des lignes différentes dans cette même table, jamais un changement de
  schéma. Unicité `(paysId, rang)`.
- **`NoeudHierarchique`** : les entités géographiques concrètes, organisées en arbre via le
  **Materialized Path** recommandé par la directive (`chemin` = `/ancêtre1/.../soi-même/`),
  plutôt qu'une clé `parent_id` seule nécessitant des CTE récursives pour remonter/descendre
  l'arbre. `rangNormalise` est toujours dérivé (`parent.rangNormalise + 1`), jamais fourni en
  entrée — aucune validation de "saut de niveau" n'est nécessaire, il est structurellement
  impossible d'en créer un.
- **`ReferentielRegle`** : règle métier (taux de TVA, seuil d'agrément) rattachée à un
  `NoeudHierarchique`. Invariant fermé au niveau use-case, pas seulement documenté :
  `CreateReferentielRegleUseCase` refuse tout rattachement à un nœud dont
  `estNoeudTerminal !== true` (`RegleNotAttachedToTerminalNodeError`).
- **`CorpusVersionne`** : contenu réglementaire ou pédagogique versionné (programme scolaire,
  directive) — **workflow propre à 3 états** (`brouillon → publie → archive`), délibérément
  distinct des 4 états de gouvernance structurelle de `NoeudHierarchique`/`ReferentielRegle`
  (voir `corpus-workflow.ts` pour la justification).
- **`CorpusElement`** : élément de contenu (chapitre, article) rattaché à un `CorpusVersionne`
  ET à un `NoeudHierarchique`, avec sa propre hiérarchie — un simple `parentId`, pas un
  Materialized Path (profondeur attendue faible, contrairement à la hiérarchie administrative).

## Gouvernance (KER-ENG-05/06) — `MetadonneesGouvernance`, Value Object partagé

`organismeCertificateur` (obligatoire, non vide) et `statutConfiance`
(`ELEVE`/`MOYEN`/`A_VERIFIER`) portés par `ReferentielRegle` et `CorpusVersionne` — jamais
rétrofités sur `NoeudHierarchique`/`NiveauAdministratif` dans cette passe, périmètre exact de
la directive d'exécution qui a demandé cette extension.

**KER-ENG-06 appliqué à la frontière du port, pas seulement documenté** :
`RegleLookupPort.getReglesForNoeud()` ne peut structurellement pas renvoyer une règle au
statut `A_VERIFIER` — le repository (`findPublieesEtVerifieesByNoeud`) filtre déjà
`statut_workflow = 'publie'`, `est_actif = true` et `statut_confiance != 'A_VERIFIER'` en une
seule requête indexée, avant même que l'adaptateur n'y touche. Testé explicitement : un mock
de repository qui renvoie `[]` produit `[]` côté port, jamais un contournement.
`CorpusLookupPort.getCorpusPublie()` suit le même principe pour le statut `brouillon`.

**Aucun module du noyau ne consomme encore ces deux ports à ce jour** — aucun produit comme
EduRéussite ou GlobalStock n'existe dans ce dépôt. Ils sont exposés par anticipation, exactement
l'esprit du méta-modèle générique de la section 8, prêts à l'adoption par un futur cahier produit.

## Le bénéfice concret du Materialized Path

La détection de cycle de réattachement — un problème classiquement coûteux en SQL récursif —
se réduit à une comparaison de chaînes :

```typescript
export function wouldCreateCycle(cheminNoeud: string, cheminCandidatNouveauParent: string): boolean {

  return cheminCandidatNouveauParent.startsWith(cheminNoeud);
}
```

Si le chemin du candidat nouveau parent commence par le chemin du nœud qu'on déplace, le
candidat est un descendant (ou le nœud lui-même) — cycle refusé. Fonction pure, testée
indépendamment de toute base de données. La recherche de descendants suit le même principe
(`chemin LIKE :prefix || '%'`, un seul index B-tree, aucune récursion).

## Isolation stricte — et l'exception qui la rend concrète

Aucun fichier de `src/referential-engine/` n'importe le domaine ou l'application de
`referential`, `org`, `product`, `identity` ou `audit` — vérifié explicitement. La relation
inter-modules va dans un SEUL sens :

- `referential-engine` **expose** `REFERENTIAL_ENGINE_LOOKUP_PORT` (`common/kernel-ports/`).
- `referential` **importe le module** `ReferentialEngineModule` (jamais son domaine) pour
  consommer ce port dans `CreateVilleUseCase` : un `referentielHierarchiqueId` fourni est
  désormais vérifié — il doit référencer un nœud existant **et publié**, sinon
  `UnpublishedHierarchicalNodeError` (HTTP 400). C'est la fermeture réelle de KER-ADM-03,
  pas une simple déclaration d'intention.

Cette relation à sens unique n'est pas un hasard : elle évite un cycle entre modules NestJS.

### Garde-fou KER-ADM-04 complet — enfants ET villes rattachées

Les deux volets sont désormais implémentés et testés :

- **Enfants** : `assertNoPublishedChildren`, appelé par `ReattachNoeudUseCase` et
  `SetNoeudActivationUseCase` — refuse si un enfant direct est publié et actif.
- **Villes** : `compteur_villes_rattachees`, une table d'indexation locale alimentée par
  `VilleRattacheeConsumerService` — un Consumer Group Redis Streams **distinct** de celui
  d'Audit (même flux partagé `gsg.kernel.events`, groupe propre), qui écoute
  `referential.ville.created`/`referential.ville.moved` et met à jour le compteur via un
  **upsert atomique en SQL brut** (`ON CONFLICT ... DO UPDATE`, `GREATEST(..., 0)`) plutôt
  qu'un "lire, incrémenter en mémoire, réécrire" — deux villes créées sur le même nœud à
  quelques millisecondes d'écart ne se marchent jamais dessus.

Ce mécanisme évite exactement le cycle entre modules identifié dans la limite précédente :
`referential-engine` n'appelle jamais `referential` de façon synchrone, il **écoute** ce que
`referential` publie déjà sur le bus partagé. Aucun `forwardRef()`, aucune dépendance
circulaire entre les deux modules NestJS.

**Nuance assumée** : `MoveVilleUseCase` n'existait pas avant cette passe — `Ville` ne
disposait d'aucune opération de déplacement, ni d'un événement `VILLE_MOVED`. Les deux ont dû
être construits pour que le compteur puisse exister ; par ailleurs `VILLE_CREATED` ne portait
même pas `referentielHierarchiqueId` dans son payload avant correction — sans ce champ, aucun
consommateur n'aurait jamais pu savoir quel nœud incrémenter.

**Simplification délibérée par rapport à `RedisStreamsConsumerService` (Audit)** : aucune
Dead-Letter Queue ici. `compteur_villes_rattachees` est un cache local eventually-consistent
(KER-VIS-03 — la source de vérité reste dans `referential`), jamais une source de vérité en
soi. En cas d'échec de traitement répété, la réclamation (XCLAIM) retente indéfiniment plutôt
que d'archiver dans une DLQ qui n'aurait pas de sens pour un simple compteur — si un message
échoue vraiment en boucle, c'est un bug à corriger, pas un cas à mettre de côté.

## Endpoints

| Méthode | Route | Description | Auth |
|---|---|---|---|
| POST | `/v1/referential-engine/niveaux-administratifs` | Définit un niveau pour un pays | JWT + `kernel.admin` |
| GET | `/v1/referential-engine/niveaux-administratifs/par-pays/:paysId` | Liste les niveaux d'un pays | Publique |
| POST | `/v1/referential-engine/noeuds` | Création (racine si `parentId` absent) | JWT + `kernel.admin` |
| GET | `/v1/referential-engine/noeuds/:id/descendants` | Tous les descendants (Materialized Path) | Publique |
| POST | `/v1/referential-engine/noeuds/:id/reattach` | Réattachement (cycle + KER-ADM-04 vérifiés) | JWT + `kernel.admin` |
| POST | `/v1/referential-engine/noeuds/:id/workflow/publish` | Publication (KER-AUD-04) | JWT + `kernel.admin` |
| POST | `/v1/referential-engine/regles` | Création (nœud terminal obligatoire) | JWT + `kernel.admin` |
| POST | `/v1/referential-engine/regles/:id/workflow/publish` | Publication d'une règle | JWT + `kernel.admin` |
| POST | `/v1/referential-engine/corpus` | Création d'un corpus versionné | JWT + `kernel.admin` |
| POST | `/v1/referential-engine/corpus/:id/publish` | Publication (workflow à 3 états) | JWT + `kernel.admin` |
| POST | `/v1/referential-engine/corpus/:id/archive` | Archivage | JWT + `kernel.admin` |
| POST | `/v1/referential-engine/corpus-elements` | Rattachement d'un élément (même corpus + cycle vérifiés) | JWT + `kernel.admin` |
| POST | `/v1/referential-engine/corpus-elements/:id/reattach` | Réattachement (cycle vérifié) | JWT + `kernel.admin` |

## Événements publiés

Noms alignés sur la directive : `AdministrativeHierarchyNodeCreated`,
`AdministrativeNodePublished`, `BranchReattached` (`referential-engine/domain/events/`).
Consommés automatiquement par le module Audit déjà bâti — aucun câblage supplémentaire requis,
`ProcessStreamEventUseCase` traite tout le flux partagé quel que soit le producteur.

---

# Registre Central des Produits (Section 5, KER-PROD-01/02/04)

Module `src/product-registry/`, isolé (vérifié explicitement : aucun import du domaine
`product`/`org` dans `product-registry/`). Élimine les deux derniers `produitId` UUID libres
non vérifiés du Kernel :

- **`Catalogue`** (Product Catalog) porte désormais `produitId`, validé à la création via
  `ProductLookupPort` — orthogonal au `scope` existant (`produitId` dit QUEL produit du
  portefeuille, `scope` dit QUI peut y accéder).
- **`AbonnementProduit`** (Org Registry) valide de la même façon `produitId` avant toute
  souscription.

Sens de dépendance à sens unique dans les deux cas : `product` et `org` importent le
**module** `ProductRegistryModule` (jamais son domaine) pour résoudre `PRODUCT_LOOKUP_PORT` ;
`ProductRegistryModule` n'importe rien en retour. Testé explicitement : une création de
catalogue avec un `produitId` fantôme échoue avant même de consulter `OrganisationLookupPort`
(`UnregisteredProductError`, HTTP 400) ; une souscription avec un `produitId` fantôme échoue
avant même de rechercher un abonnement existant.

`ProduitPortefeuille` porte aussi `briquesConsommees` (KER-PROD-04 — liste fermée alignée sur
les modules réellement livrés : `gsg_id`, `org_registry`, `gsg_referential`,
`referential_engine`, `event_bus`, `audit`, `billing`, `design_system`) et
`ProduitPaysDeploiement` (KER-PROD-02 — une ligne par `(produitId, paysId)`, mise à jour en
place, jamais historisée comme `taux_change`).

---

# Suite Redis physique (`test/integration/redis/`)

**Écrite mais jamais exécutée par moi** : ce bac à sable n'a pas d'accès réseau/Docker. Comme
pour `test/e2e/auth.e2e-spec.ts` déjà présent, ces fichiers dépendent d'une instance
PostgreSQL et Redis réelles — je ne peux valider leur correction que par relecture attentive,
pas par un run réel. Je le dis explicitement plutôt que de laisser croire à une validation
que je n'ai pas faite.

## Ce que la suite valide, que les tests mockés ne peuvent pas prouver

| Fichier | Ce qui est réellement exercé |
|---|---|
| `outbox-relay-to-redis.redis-spec.ts` | `OutboxRelayService` en conditions réelles : cycle démarré via `onModuleInit`, insertion Postgres, `XADD` réel, message retrouvé par `XRANGE` avec les bons champs. |
| `consumer-loop-and-audit.redis-spec.ts` | `XREADGROUP ... BLOCK` réel (pas mocké), persistance réelle dans `audit_evenement`, et surtout `XPENDING` confirmant un **ACK réel** — un mock de `handleMessage()` ne peut jamais prouver que le message a quitté la Pending Entries List. |
| `claim-and-dlq.redis-spec.ts` | Le point le plus délicat : `ProcessStreamEventUseCase` mocké pour échouer systématiquement (seul ce maillon est simulé — tout le reste, `XPENDING`, `XCLAIM`, l'incrémentation du compteur de livraison, est Redis lui-même), jusqu'à bascule DLQ réelle et `XACK` final réel. |
| `dead-letter-replay-api.redis-spec.ts` | Seul fichier à démarrer l'application HTTP complète (`AppModule`, comme le test e2e existant) : `POST /v1/audit/dead-letter/:id/replay` en conditions réelles, y compris le refus HTTP 400 d'un second rejeu et HTTP 401 sans jeton. |

## Isolation entre fichiers

Chaque fichier appelle `isolateRedisNamespaceForThisFile()` en tout premier (avant tout
bootstrap NestJS), qui génère un suffixe aléatoire et surcharge
`EVENT_BUS_STREAM_PREFIX`/`AUDIT_CONSUMER_GROUP` pour CE fichier. Sans cela, plusieurs
fichiers tournant contre le même Redis réel se disputeraient les messages d'un flux/groupe
partagé — un message du fichier A pourrait être consommé par l'instance du fichier B. Exécuté
en `--runInBand` (un seul worker) par précaution supplémentaire, principalement pour éviter
une contention de pool de connexions Postgres entre plusieurs `TypeOrmModule.forRoot()`
simultanés plutôt que par nécessité stricte du côté Redis.

## Exécution

```bash
docker compose up -d
npm run migration:run
npm run test:redis
```

**Jamais exécuté par `npm test`** — vérifié explicitement : les fichiers `*.redis-spec.ts`
ne correspondent pas au motif `*.spec.ts` de `jest.config.js` (le caractère précédant "spec"
est un tiret, pas un point). Configuration dédiée : `test/jest-redis.json`.

## Un bug trouvé et corrigé en écrivant ces tests

En préparant le test de rejeu via API, j'ai découvert que `AuditController.replay` ne
mappait `DeadLetterEntryNotFoundError`/`DeadLetterEntryAlreadyReplayedError` vers aucun code
HTTP explicite — elles auraient remonté en 500 générique plutôt qu'en 404/400. Corrigé avant
d'écrire le test dessus, plutôt que d'écrire un test autour d'un bug déjà présent.

---

# Moteur d'héritage & AppConfig (§9/§10, KER-INH & KER-CFG)

Module `src/app-config/`, isolé (aucun import du domaine `identity`/`org`/`referential` —
vérifié explicitement, seuls les modules NestJS sont importés, pour la résolution DI de
leurs ports). Ferme deux écarts identifiés lors du dernier audit contre le Cahier : l'absence
de moteur de résolution d'héritage et l'absence d'un point d'entrée AppConfig unique.

## Ordre de résolution retenu (5 niveaux)

**Utilisateur → Agence/Unité → Organisation → Pays → Configuration Globale** — plus précis
que le regroupement "Organisation/Agence" de KER-INH-01, sur directive explicite : une agence
l'emporte sur le défaut de son organisation mère, jamais l'inverse. Vérifié avant construction
que `UniteOperationnelle` porte bien son propre référentiel indépendant (KER-ORG-04) — la
structure de données existait déjà, seul le moteur de résolution manquait.

## Le résolveur est pur, testable sans aucune dépendance I/O

```typescript
export function resolveChamp(niveaux: readonly NiveauReferentielPartiel[], champ: ChampHeritable): string | null {
  for (const niveau of niveaux) {
    const valeur = niveau[champ];
    if (valeur !== null && valeur !== undefined) return valeur;
  }
  return null;
}
```

KER-INH-02 tient dans cette boucle : `null` et `undefined` signifient tous deux "non défini
à CE niveau", jamais "vide partout" — la résolution continue vers le niveau suivant plutôt
que de s'arrêter. Testé explicitement, y compris le cas d'une agence "transparente" (sans
référentiel propre configuré) qui laisse correctement passer vers l'organisation mère.

## Orchestration cross-module (`ResolveAppConfigUseCase`)

Trois nouveaux ports transverses, chacun implémenté par le module qui possède la donnée,
jamais consommé directement (KER-VIS-03) :

| Port | Implémenté par | Niveau de la chaîne |
|---|---|---|
| `UserReferentialLookupPort` | `identity` | Utilisateur |
| `OrganisationReferentialLookupPort` | `org` | Agence/Unité + Organisation |
| `ReferentialDefaultsLookupPort` | `referential` | Pays (devise/langue principales, fuseau, gabarit d'adresse) |

`ORGANISATION_LOOKUP_PORT` (déjà existant) referme la portée : `gsgOrgId` doit à la fois
figurer dans le claim `gsgOrgIds` du jeton **et** référencer une organisation active — jamais
une organisation arbitraire devinée dans l'URL. `uniteOperationnelleId`, optionnel, est
vérifié appartenir à `gsgOrgId` avant tout usage.

## Configuration Globale — le niveau de repli qui ferme KER-INH-02

Singleton administrable (`kernel.admin` uniquement), pré-rempli dès la migration. Si même
cette ligne n'existe pas encore (premier démarrage, avant toute action d'un admin),
`DEFAUTS_ABSOLUS` (code) prend le relais — mais uniquement dans ce cas précis, jamais comme
substitut à une configuration réellement administrable.

## Endpoints

| Méthode | Route | Description | Auth |
|---|---|---|---|
| GET | `/v1/app-config?gsgOrgId=...&uniteOperationnelleId=...` | **Point d'entrée unique** — KER-CFG-02, un seul appel au démarrage client | JWT |
| GET | `/v1/app-config/global` | Consultation de la configuration globale | JWT + `kernel.admin` |
| PATCH | `/v1/app-config/global` | Mise à jour de la configuration globale | JWT + `kernel.admin` |

## Internationalisation — `locale` et `traduction` (KER-NOM-04)

Module `referential` (`locale-et-traduction.entity.ts`), sans aucune référence à
`Pays`/`Langue` — ni FK physique ni applicative, exactement comme dans n'importe quel système
i18n standard : le code BCP 47 est auto-suffisant.

- **`Locale`** : code BCP 47 (sous-ensemble strict validé par regex — langue 2-3 lettres,
  région 2 lettres ou 3 chiffres UN M49 ; documenté comme sous-ensemble délibéré, pas la RFC
  5646 intégrale), libellé, statut par défaut, statut actif.
- **`Traduction`** : association clé/valeur paramétrée par locale, unicité `(localeId, cle)`.

### L'invariant "une seule locale par défaut", posé à deux niveaux

`SetLocaleParDefautUseCase` retire le statut de l'ancien défaut avant de poser le nouveau —
deux sauvegardes séquentielles, mais **jamais divisibles en pratique** grâce au
`TransactionInterceptor` déjà posé pour l'atomicité Outbox : les deux appels tombent dans la
même transaction Postgres. Testé explicitement, y compris l'idempotence (aucune écriture
inutile si la locale ciblée est déjà celle par défaut).

Le filet de sécurité ultime reste néanmoins en base : un **index unique partiel**
(`CREATE UNIQUE INDEX ... ON locale (est_par_defaut) WHERE est_par_defaut = true`) — garanti
par Postgres lui-même, indépendamment de toute discipline applicative, y compris si ce
use-case était un jour contourné par un accès direct.

### `GET /v1/app-config` — `locale` désormais certifiée, plus une dérivation

`ReferentialDefaultsLookupPort.resolveLocale()` résout en 3 temps, du plus spécifique au plus
général — jamais `` `${langueCode}-${paysCode}` `` construit à la volée sans vérifier qu'une
telle locale existe et est active :

1. La combinaison **exacte** langue-pays (ex. `fr-GN`), si elle existe et est active.
2. La **langue seule** (ex. `fr`), si la combinaison exacte n'existe pas.
3. La **locale par défaut** du noyau, en dernier recours.
4. `null` uniquement si absolument aucune locale n'a jamais été configurée (premier démarrage).

Testé sur les 3 niveaux indépendamment, y compris le cas d'une locale trouvée mais
**désactivée** (continue vers le niveau suivant plutôt que de l'utiliser quand même) et le
cas où `langueCode`/`paysCode` sont tous deux absents (saut direct au niveau 3).

## Ce que la réponse AppConfig ne couvre toujours pas

- **`fournisseursPaiement`** : toujours un tableau vide. KER-BIL (Billing Core) est une
  brique différée par défaut (section 13 du Cahier) — le champ existe dans la réponse pour
  respecter la forme exacte attendue par les clients, jamais rempli avec une donnée inventée.
- **`formatDate`/`formatNombre` par pays** : résolus uniquement aux niveaux Utilisateur/
  Agence/Organisation/Global — `Pays` ne porte pas ces deux champs (contrairement à
  `adresseGabarit`/`fuseauHoraire`, déjà présents depuis KER-REF-09). Un produit voulant un
  format de date par défaut différent par pays doit aujourd'hui le définir au niveau
  Organisation, pas Pays.

---

# Tests

Trois niveaux, séparés par commande et par répertoire :

| Niveau | Répertoire | Commande | Dépendances externes |
|---|---|---|---|
| Unitaire (domaine) | `test/unit/` | `npm test` | Aucune — domaine pur, zéro mock nécessaire |
| Intégration (application) | `test/integration/` | `npm test` | Aucune — use-cases avec ports mockés (`@nestjs/testing`) |
| E2E (API réelle) | `test/e2e/` | `npm run test:e2e` | PostgreSQL + Redis réels, migrés (`docker compose up -d && npm run migration:run`) |

`npm test` exécute unitaire + intégration ensemble (même config `jest.config.js`, aucune
dépendance externe, rapide, adapté à la CI sur chaque commit). `npm run test:e2e` est
volontairement séparé car il démarre une vraie instance Nest (`AppModule`) contre une base
réelle — plus lent, à exécuter avant chaque déploiement plutôt qu'à chaque sauvegarde.

## Ce qui est couvert

**Domaine (invariants métier)**
- `User` : verrouillage anti-brute-force au seuil exact (5 échecs), fenêtre de verrouillage,
  réinitialisation après succès, statuts de compte, référentiel KER-ID-05.
- `RefreshToken` : rotation, détection de rejeu (OWASP ASVS 3.3.1), expiration, révocation,
  priorité révocation > expiration.
- `Email` / `PhoneE164` : normalisation, rejet des formats invalides, égalité par valeur.
- Workflow de publication (KER-AUD-04) : les 5 transitions autorisées et les 6 refusées,
  `publie` comme état terminal, appliqué concrètement à `Pays` (KER-REF-01).
- `TauxChange` : validation à la création, résolution temporelle (`isValidAt`) sur les bornes
  inclusives, cas `validAu = null` ("en vigueur jusqu'à nouvel ordre").
- `Organisation` : auto-filiation refusée, référentiel indépendant par filiale (KER-ORG-04),
  réattachement, activation/désactivation.
- `AbonnementProduit` : les transitions valides et invalides (KER-ORG-03), indépendance de
  deux abonnements d'une même organisation.
- Workflow catalogue à 4 états (KER-PRD, `product/domain/entities/catalog-workflow.ts`) : les
  4 transitions autorisées et les 8 refusées, `archive` comme état terminal absolu.
- `CatalogueScope` (Value Object) : construction par type, égalité par valeur, refus d'un
  scope non global sans cible.
- `Offre` : invariant de compatibilité type/période de facturation — les 6 combinaisons
  (abonnement/usage/ponctuel × mensuelle/annuelle/unique) testées individuellement.
- `GrilleTarifaire` : validation du montant (entier, positif ou nul), de la version, de la
  fenêtre de validité ; et surtout `rangesOverlap`/`assertNoOverlapWithExisting` — la règle
  d'incompatibilité de grilles tarifaires, avec les cas limites (succession propre non
  chevauchante, devises différentes non comparées, republication de soi-même).

**Application (use-cases avec ports mockés)**
- `AssignRoleUseCase` : le test le plus important de cette passe — vérifie que la fermeture
  du contrôle de portée fonctionne réellement (rôle global jamais vérifié auprès d'Org
  Registry, rôle scopé refusé si l'organisation n'existe pas ou est désactivée, aucune
  persistance en cas de refus).
- `ResolveExchangeRateUseCase` : refus explicite quand aucun taux valide n'existe (KER-REF-04)
  — le cœur de cette règle, avec plusieurs scénarios (aucun taux, taux expiré, plusieurs
  candidats historiques, devise vers elle-même).
- `ReattachOrganisationUseCase` : détection de cycle de filiation, découplée de la logique de
  parcours d'arbre réelle (mockée) pour tester uniquement la décision du use-case.
- `CreateGrilleTarifaireUseCase` : refus explicite d'une devise non certifiée (KER-PRD, via
  `CurrencyValidationPort` mocké), incrémentation automatique de version, refus de
  chevauchement avec une grille déjà publiée.
- `TransitionGrilleTarifaireWorkflowUseCase.publish` : re-vérification du chevauchement au
  moment précis de la publication (pas seulement à la création).
- `CreateCatalogueUseCase` / `AssertOrganisationCanAccessCatalogueUseCase` : validation du
  scope organisation à la création, fermeture du contrôle d'accès à la consultation (une
  organisation accède à son propre catalogue et à celui de ses maisons mères, jamais à celui
  d'une organisation sans lien de filiation) — le test vérifie même l'ordre exact des
  arguments passés à `isDescendantOrSelf`.
- `SupabaseSessionExchangeUseCase` : les trois niveaux de résolution d'identité (SSO par
  mapping existant, dédup par email vérifié, dédup par téléphone — avec priorité email
  testée explicitement), création si aucune correspondance.
- `JoseSupabaseSessionVerifier` : liste blanche anti-SSRF (aucun appel réseau tenté hors
  liste), et cache JWKS local — appel réseau unique en cas de succès, réutilisation tant
  que le TTL est valide, déduplication single-flight sous 5 vérifications concurrentes,
  repli effectif sur un jeu de clés périmé quand le réseau tombe, rafraîchissement forcé
  sur rotation de clé (`kid` inconnu), et non-déclenchement d'un second rafraîchissement
  forcé pendant le cooldown anti-martèlement.
- `redactSensitiveFields` / `shouldMoveToDeadLetter` (Audit) : rédaction à profondeur
  arbitraire (objets et tableaux imbriqués), variantes de casse/séparateur, garde-fou
  anti-boucle sur structure profondément imbriquée ; seuil exact de bascule DLQ.
- `ProcessStreamEventUseCase` : idempotence stricte par `evenementId` (aucune double
  persistance), rédaction avant sauvegarde, rejet des messages structurellement invalides
  (champs absents, JSON malformé, charge utile non-objet) sans jamais consulter le
  repository dans ce dernier cas.
- `OutboxEventPublisherService` : insertion outbox conforme à l'événement publié, et surtout
  — jamais de propagation d'erreur vers le use-case appelant même si l'insertion échoue
  (KER-VIS-04 : le noyau ne bloque jamais un produit).
- `OutboxRelayService` : publication et marquage "publie" en cas de succès, marquage d'échec
  sans interrompre le traitement des lignes suivantes du même lot, protection de ré-entrance
  (un cycle à la fois), et absence de propagation d'exception depuis le balayage périodique.
- `RedisStreamsConsumerService` : reconstruction correcte d'un message à partir des champs
  plats Redis, ACK sur succès, **absence d'ACK sur échec** (le point le plus important de
  la fiabilité at-least-once — un message non acquitté doit rester "pending"), et absence de
  propagation d'exception depuis le traitement d'un message (la boucle de lecture ne doit
  jamais s'arrêter à cause d'un message problématique).
- `TransactionContextService` / `TransactionalRepository` : propagation du manager ambiant à
  travers plusieurs niveaux d'`await` (y compris un vrai passage par la microtask queue),
  étanchéité entre deux contextes concurrents, résolution du repository transactionnel quand
  un contexte est actif vs repli sur le repository par défaut sinon — **c'est le mécanisme
  qui garantit l'atomicité Outbox**, testé indépendamment de toute base réelle.
- `TransactionInterceptor` : ouverture d'une transaction pour chacune des 4 méthodes
  d'écriture, absence totale d'ouverture pour une lecture ou hors contexte HTTP, propagation
  correcte de la valeur de retour et des erreurs (condition du rollback automatique).
- `QueryAuditTrailUseCase` : `kernel.admin` jamais restreint (avec ou sans filtre), `org.owner`
  refusé sans `gsgOrgId`, autorisé sur sa propre organisation et sur une filiale, refusé sur
  une organisation sans lien de filiation, et vérification de chaque organisation possédée
  avant un refus définitif (cas d'un `org.owner` de plusieurs organisations).
- `wouldCreateCycle` (Referential Engine) : les 6 configurations de chemins qui comptent
  vraiment — aucun chevauchement, descendant direct, descendant profond, nœud sur lui-même,
  remontée vers le parent, et le piège classique du faux positif par préfixe de caractères
  bruts sans séparateur (`/racine/A/` vs `/racine/AB/`).
- `assertNoPublishedChildren` / workflow local du Referential Engine : le garde-fou KER-ADM-04
  (refuse un enfant publié ET actif, mais pas un enfant publié et désactivé), et les 4 états
  exacts du workflow sans ARCHIVE (contrairement à Product Catalog).
- `CreateNoeudUseCase` : refus de créer une racine ou un enfant si le `NiveauAdministratif`
  correspondant au rang n'est pas défini pour le pays — c'est la garantie concrète que
  KER-ADM-01 tient sa promesse ("jamais de modification de schéma pour un nouveau pays").
- `ReattachNoeudUseCase` / `SetNoeudActivationUseCase` : refus effectif si un enfant est
  publié, refus effectif d'un cycle réel (nœud rattaché à son propre petit-enfant), et
  réattachement légitime qui recalcule correctement le chemin.
- `CreateVilleUseCase` (retrofit KER-ADM-03) : aucun appel au port si
  `referentielHierarchiqueId` est absent, refus si le nœud référencé n'existe pas ou n'est
  pas publié, création normale sinon.
- `MetadonneesGouvernance` (KER-ENG-05/06) : organisme certificateur vide refusé, statut de
  confiance inconnu refusé, `estVerifie` faux uniquement pour `A_VERIFIER`.
- `wouldCreateCycleInCorpus` : détection de cycle sans Materialized Path (marche
  d'ascendance), y compris le cas limite d'auto-rattachement et l'absence de boucle infinie
  face à une boucle déjà existante ailleurs dans les données.
- `assertCorpusTransitionAllowed` : les 3 états exacts du workflow corpus, sans
  "en_revision" ni "valide" — distinct du workflow à 4 états des nœuds/règles.
- `CreateReferentielRegleUseCase` : refus effectif si le nœud n'est pas terminal ou n'existe
  pas, création avec `codeDomaine` hérité du nœud, refus d'un organisme certificateur vide
  avant tout accès au repository.
- `RegleLookupAdapter`/`CorpusLookupAdapter` : délégation stricte au filtre du repository
  (jamais un second appel non filtré), tableau vide si rien n'est publié/vérifié, assemblage
  correct corpus + éléments.
- `ReattachNoeudUseCase`/`SetNoeudActivationUseCase` (garde-fou villes) : refus effectif si
  le compteur local est supérieur à zéro, autorisation si à zéro, et confirmation que les
  garde-fous enfants/villes restent indépendants et cumulatifs.
- `MoveVilleUseCase` : refus si la ville ou le nouveau nœud n'existe pas, publication de
  `VILLE_MOVED` avec l'ancien ET le nouveau nœud, cas du détachement complet (`null`) sans
  validation de nœud inutile.
- `VilleRattacheeConsumerService` : acquittement immédiat de tout message hors périmètre
  (le gros du trafic du flux partagé), incrémentation/décrémentation correctes sur
  création/déplacement y compris le détachement, et absence d'ACK sur échec de traitement.
- `Locale` (KER-NOM-04) : validation BCP 47 stricte sur 5 codes valides et 6 codes rejetés
  (casse, séparateur, longueur de région), état initial toujours non-défaut/actif.
- `SetLocaleParDefautUseCase` : bascule atomique ancien→nouveau défaut (deux sauvegardes
  distinctes), une seule sauvegarde si aucun défaut n'existait, idempotence si la cible est
  déjà le défaut.
- `ReferentialDefaultsLookupAdapter.resolveLocale` : les 3 niveaux de repli testés
  indépendamment, y compris une locale trouvée mais désactivée (continue vers le niveau
  suivant plutôt que de l'utiliser), et le cas `null`/`null` (saut direct au niveau 3).
- `resolveChamp`/`resolveTousLesChamps` (app-config) : niveau le plus spécifique gagne,
  `null` et `undefined` traités identiquement comme "non défini ici" (jamais un blocage de
  la remontée), repli jusqu'au dernier niveau, résolution indépendante de chaque champ, cas
  concret d'une agence "transparente" laissant passer vers l'organisation mère.
- `ResolveAppConfigUseCase` : fermeture de portée JWT (`gsgOrgId` hors `gsgOrgIds` refusé),
  organisation désactivée refusée, unité hors organisation refusée, priorité effective de
  chaque niveau jusqu'au repli Global réel, absence totale d'échec même sans configuration
  globale jamais initialisée, résolution du pays puis résolution de `locale` via la table
  certifiée (KER-NOM-04).

**E2E**
- Parcours `register → login → refresh` sur une instance Nest réelle : validation stricte des
  DTO (rejet d'un champ non déclaré), message d'erreur générique anti-énumération, protection
  JWT sur `/users/me`, exposition correcte du référentiel KER-ID-05.

## Ce qui n'est pas encore couvert (prochaine itération suggérée)

- Tests unitaires domaine pour `Devise`, `Langue`, `BlocRegional`, `PaysBlocRegional` (même
  pattern que `Pays` déjà testé — transitions de workflow génériques déjà couvertes par
  `workflow-and-pays.spec.ts`, il reste les invariants spécifiques : décimales de devise,
  codes ISO 639/4217, cas CEDEAO daté).
- Tests d'intégration sur les contrôleurs HTTP eux-mêmes (au-delà des use-cases) : guards
  RBAC (`RolesGuard`) avec un utilisateur insuffisamment privilégié, sérialisation des
  réponses.
- Tests d'intégration sur les repositories TypeORM contre une base réelle (actuellement
  seuls les use-cases sont testés, avec les repositories mockés au niveau du port).
- E2E MFA complet (enrollment → confirmation → login avec challenge) et Org Registry
  (création filiale → tentative de cycle via l'API réelle → 400).

---

# CI/CD — `.github/workflows/kernel-ci.yml`

Cinq jobs : `lint`, `build`, `test-unit-integration` (parallèles, aucune dépendance externe),
`test-e2e-and-redis-physical` (le **quality gate**), et `quality-gate` qui agrège les quatre
premiers via `needs` — c'est ce dernier job qu'une règle de protection de branche GitHub doit
référencer (Settings → Branches → Require status checks), pour n'avoir qu'un seul check à
cocher plutôt que quatre.

## Le quality gate — première exécution automatisée de la suite Redis physique

`test/integration/redis/*.redis-spec.ts` existait depuis plusieurs passes de ce projet,
toujours documenté comme "écrit mais jamais exécuté par moi — pas d'accès Docker dans ce bac
à sable". Ce workflow ferme cette lacune : deux service containers réels (`postgres:16-alpine`,
`redis:7-alpine`), tous deux avec `healthcheck`, migrations exécutées avant tout test, puis
`npm run test:e2e` et **`npm run test:redis`** — ce dernier est nommé explicitement comme le
verrou d'intégration à franchir avant tout marquage v1.0.

## Deux limites honnêtes, découvertes en construisant ce workflow, corrigées avant de le livrer

1. **Aucun `package-lock.json` n'existe dans ce dépôt.** Le projet a été construit dans un
   environnement sans accès réseau, donc `npm install` n'a jamais réellement tourné.
   `npm ci` (et le cache `actions/setup-node`) exigent tous deux un lockfile déjà présent —
   j'ai utilisé `npm install` partout à la place, plus lent et moins strictement
   reproductible. **Avant la première exécution réelle de ce workflow** : lancer
   `npm install` en local, committer le `package-lock.json` généré, puis remplacer les 4
   `npm install` par `npm ci` et réajouter `cache: npm` sous chaque `actions/setup-node@v4`
   (note laissée en tête du fichier YAML lui-même, pas seulement ici).
2. **Aucun `.eslintrc.js` n'existait**, alors que `npm run lint` (dans `package.json`)
   l'appelait déjà silencieusement en échec. Créé maintenant (config `@typescript-eslint`
   raisonnable, alignée sur le style déjà en place dans les 214 fichiers du projet) — mais
   **jamais exécutée réellement** ici non plus. Le premier passage CI peut révéler des
   problèmes de style préexistants sur du code jamais linté : c'est le comportement attendu
   d'un premier passage CI, pas un défaut de ce workflow.

## Secrets CI

Toutes les valeurs du job `test-e2e-and-redis-physical` (`JWT_ACCESS_SECRET`,
`MFA_ENCRYPTION_KEY_HEX`, etc.) sont des **valeurs jetables, propres à ce fichier**, jamais
réutilisées en production — mais respectent strictement les contraintes de
`validation.schema.ts` (OWASP ASVS 2.10 : 32+ caractères pour les secrets JWT, exactement 64
caractères hexadécimaux pour la clé MFA), vérifiées programmatiquement avant livraison plutôt
que supposées correctes.
