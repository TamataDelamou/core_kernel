-- ============================================================================
-- GSG ID — Schéma PostgreSQL de référence (module identité et authentification
-- fédérée du GSG Platform Kernel, KER-ID-01..06).
--
-- Ce fichier est une vue DDL lisible du schéma, à titre de référence et de
-- documentation. La source de vérité exécutable reste la migration TypeORM :
-- src/identity/infrastructure/persistence/migrations/1755878400000-InitIdentitySchema.ts
--
-- Convention de nommage (KER-NOM-03) : tables et colonnes techniques du service
-- GSG ID en français (aligné sur l'ensemble du noyau — voir note ci-dessous) ;
-- seules les colonnes référençant le GSG Referential partagé (pays_id, devise_id,
-- langue_id, unite_administrative_id, ville_id) sont des clés applicatives vers
-- un service distinct : AUCUNE contrainte de clé étrangère physique inter-service
-- n'est posée ici (KER-VIS-03 : accès exclusivement par API/événements).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Table : utilisateur — profil GSG ID (KER-ID-01, KER-ID-05, KER-ID-06)
-- ----------------------------------------------------------------------------
CREATE TABLE utilisateur (
  gsg_id                            uuid PRIMARY KEY,
  email                             varchar(254) NOT NULL,
  email_verifie                     boolean NOT NULL DEFAULT false,
  phone                             varchar(20),                 -- format E.164 (KER-ID-06)
  phone_verifie                     boolean NOT NULL DEFAULT false,
  password_hash                     varchar(255) NOT NULL,       -- Argon2id
  nom_affichage                     varchar(120) NOT NULL,
  statut                            varchar(20) NOT NULL DEFAULT 'actif'
                                     CHECK (statut IN ('actif', 'suspendu', 'desactive')),
  mfa_active                        boolean NOT NULL DEFAULT false,

  -- Références vers le GSG Referential (KER-ID-05) — résolues par le service Referential,
  -- jamais dupliquées ni contraintes physiquement ici (KER-VIS-05).
  pays_id                           uuid,
  unite_administrative_id           uuid,
  ville_id                          uuid,
  langue_id                         uuid,
  devise_id                         uuid,
  fuseau_horaire                    varchar(64),                 -- IANA, ex. Africa/Conakry

  cree_le                           timestamptz NOT NULL DEFAULT now(),
  modifie_le                        timestamptz NOT NULL DEFAULT now(),
  dernier_auth_le                   timestamptz,
  tentatives_echouees_consecutives  int NOT NULL DEFAULT 0,
  verrouille_jusqua                 timestamptz
);

CREATE UNIQUE INDEX uq_utilisateur_email ON utilisateur (email);

-- ----------------------------------------------------------------------------
-- Table : role — RBAC granulaire, global au noyau ou scopé à une organisation
-- ----------------------------------------------------------------------------
CREATE TABLE role (
  id            uuid PRIMARY KEY,
  code          varchar(100) NOT NULL,          -- ex. 'kernel.admin', 'org.owner'
  nom           varchar(150) NOT NULL,
  description   text NOT NULL,
  gsg_org_id    uuid,                            -- NULL = rôle global du noyau (KER-ORG-03)
  permissions   jsonb NOT NULL DEFAULT '[]',
  cree_le       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_role_code_org
  ON role (code, COALESCE(gsg_org_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX idx_role_gsg_org_id ON role (gsg_org_id);

-- ----------------------------------------------------------------------------
-- Table : attribution_role_utilisateur
-- ----------------------------------------------------------------------------
CREATE TABLE attribution_role_utilisateur (
  id            uuid PRIMARY KEY,
  gsg_id        uuid NOT NULL REFERENCES utilisateur (gsg_id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES role (id) ON DELETE CASCADE,
  gsg_org_id    uuid,
  assigne_par   uuid NOT NULL,                   -- gsg_id de l'acteur (traçabilité KER-AUD)
  assigne_le    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attribution_role_gsg_id ON attribution_role_utilisateur (gsg_id);

-- ----------------------------------------------------------------------------
-- Table : jeton_rafraichissement — rotation + détection de rejeu (OWASP ASVS 3.3)
-- ----------------------------------------------------------------------------
CREATE TABLE jeton_rafraichissement (
  id             uuid PRIMARY KEY,
  gsg_id         uuid NOT NULL REFERENCES utilisateur (gsg_id) ON DELETE CASCADE,
  token_hash     varchar(255) NOT NULL,          -- SHA-256 du jeton — jamais le jeton en clair
  family_id      uuid NOT NULL,                  -- lignée de rotation ; révocation en cascade
  emis_le        timestamptz NOT NULL DEFAULT now(),
  expire_le      timestamptz NOT NULL,
  consomme_le    timestamptz,
  revoque_le     timestamptz,
  ip_emission    varchar(45) NOT NULL,
  user_agent     text NOT NULL
);

CREATE INDEX idx_jeton_rafraichissement_gsg_id ON jeton_rafraichissement (gsg_id);
CREATE INDEX idx_jeton_rafraichissement_family_id ON jeton_rafraichissement (family_id);

-- ----------------------------------------------------------------------------
-- Table : facteur_mfa (KER-ID-04)
-- ----------------------------------------------------------------------------
CREATE TABLE facteur_mfa (
  id                          uuid PRIMARY KEY,
  gsg_id                      uuid NOT NULL REFERENCES utilisateur (gsg_id) ON DELETE CASCADE,
  type                        varchar(20) NOT NULL DEFAULT 'totp',
  secret_chiffre              text NOT NULL,      -- AES-256-GCM, jamais en clair au repos
  statut                      varchar(30) NOT NULL DEFAULT 'en_attente_activation'
                               CHECK (statut IN ('en_attente_activation', 'actif', 'revoque')),
  codes_recuperation_hashes   jsonb NOT NULL DEFAULT '[]',
  cree_le                     timestamptz NOT NULL DEFAULT now(),
  active_le                   timestamptz
);

CREATE INDEX idx_facteur_mfa_gsg_id ON facteur_mfa (gsg_id);

-- ----------------------------------------------------------------------------
-- Table : correspondance_identite_externe (KER-ID-02)
-- ----------------------------------------------------------------------------
CREATE TABLE correspondance_identite_externe (
  id                 uuid PRIMARY KEY,
  gsg_id             uuid NOT NULL REFERENCES utilisateur (gsg_id) ON DELETE CASCADE,
  produit_id         uuid NOT NULL,               -- référence vers le Registre central des produits
  external_user_id   varchar(255) NOT NULL,       -- identifiant dans le système existant du produit
  lie_le             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_correspondance_produit_external_id
  ON correspondance_identite_externe (produit_id, external_user_id);
CREATE INDEX idx_correspondance_gsg_id ON correspondance_identite_externe (gsg_id);
