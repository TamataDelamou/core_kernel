-- ============================================================================
-- GSG Referential — Schéma PostgreSQL de référence (pays, devises, langues,
-- blocs régionaux, taux de change, villes — KER-REF-01..09, KER-ADM-03/04).
--
-- Vue DDD lisible à titre de documentation. Source de vérité exécutable :
-- src/referential/infrastructure/persistence/migrations/1755964800000-InitReferentialSchema.ts
--
-- Nommage (KER-NOM-01) : référentiel métier partagé en français. Aucune contrainte
-- de clé étrangère vers "utilisateur" (module GSG ID, service distinct — KER-VIS-03).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Table : pays (KER-REF-01, KER-REF-09)
-- ----------------------------------------------------------------------------
CREATE TABLE pays (
  id                              uuid PRIMARY KEY,
  code_iso                        varchar(2) NOT NULL,        -- ISO 3166-1 alpha-2
  nom                              varchar(150) NOT NULL,
  organisme_regional_principal    varchar(255),
  notes_souverainete              text,
  adresse_gabarit                 text,                        -- gabarit d'adresse postale
  fuseau_horaire                  varchar(64),                 -- IANA, ex. Africa/Conakry
  est_actif                       boolean NOT NULL DEFAULT true,
  statut_workflow                 varchar(20) NOT NULL DEFAULT 'brouillon'
                                   CHECK (statut_workflow IN ('brouillon', 'en_revision', 'valide', 'publie')),
  cree_le                         timestamptz NOT NULL DEFAULT now(),
  modifie_le                      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_pays_code_iso ON pays (code_iso);
CREATE INDEX idx_pays_statut_workflow ON pays (statut_workflow);

-- ----------------------------------------------------------------------------
-- Table : devise (KER-REF-02, KER-REF-08)
-- ----------------------------------------------------------------------------
CREATE TABLE devise (
  id                uuid PRIMARY KEY,
  code_iso4217      varchar(3) NOT NULL,           -- ISO 4217
  nom               varchar(150) NOT NULL,
  zone_monetaire    varchar(100),                  -- ex. BCEAO, BEAC
  decimales         int NOT NULL CHECK (decimales BETWEEN 0 AND 4),
  est_actif         boolean NOT NULL DEFAULT true,
  statut_workflow   varchar(20) NOT NULL DEFAULT 'brouillon'
                    CHECK (statut_workflow IN ('brouillon', 'en_revision', 'valide', 'publie')),
  cree_le           timestamptz NOT NULL DEFAULT now(),
  modifie_le        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_devise_code_iso4217 ON devise (code_iso4217);

-- ----------------------------------------------------------------------------
-- Table : langue (KER-REF-06)
-- ----------------------------------------------------------------------------
CREATE TABLE langue (
  id                uuid PRIMARY KEY,
  code_iso639       varchar(3) NOT NULL,           -- ISO 639
  nom               varchar(150) NOT NULL,
  est_actif         boolean NOT NULL DEFAULT true,
  statut_workflow   varchar(20) NOT NULL DEFAULT 'brouillon'
                    CHECK (statut_workflow IN ('brouillon', 'en_revision', 'valide', 'publie')),
  cree_le           timestamptz NOT NULL DEFAULT now(),
  modifie_le        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_langue_code_iso639 ON langue (code_iso639);

-- ----------------------------------------------------------------------------
-- Table : bloc_regional (KER-REF-07)
-- ----------------------------------------------------------------------------
CREATE TABLE bloc_regional (
  id                uuid PRIMARY KEY,
  code              varchar(20) NOT NULL,          -- ex. CEDEAO, UEMOA, OHADA
  nom               varchar(150) NOT NULL,
  type              varchar(20) NOT NULL
                    CHECK (type IN ('economique', 'juridique', 'monetaire', 'examinateur')),
  est_actif         boolean NOT NULL DEFAULT true,
  statut_workflow   varchar(20) NOT NULL DEFAULT 'brouillon'
                    CHECK (statut_workflow IN ('brouillon', 'en_revision', 'valide', 'publie')),
  cree_le           timestamptz NOT NULL DEFAULT now(),
  modifie_le        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_bloc_regional_code ON bloc_regional (code);

-- ----------------------------------------------------------------------------
-- Table : pays_devise (KER-REF-03) — many-to-many datée
-- ----------------------------------------------------------------------------
CREATE TABLE pays_devise (
  id                  uuid PRIMARY KEY,
  pays_id             uuid NOT NULL REFERENCES pays (id) ON DELETE CASCADE,
  devise_id           uuid NOT NULL REFERENCES devise (id) ON DELETE CASCADE,
  date_debut          date NOT NULL,
  date_fin            date,                          -- NULL = circulation en cours
  devise_principale   boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_pays_devise_pays_id ON pays_devise (pays_id);
CREATE INDEX idx_pays_devise_devise_id ON pays_devise (devise_id);

-- ----------------------------------------------------------------------------
-- Table : pays_langue (KER-REF-06)
-- ----------------------------------------------------------------------------
CREATE TABLE pays_langue (
  id          uuid PRIMARY KEY,
  pays_id     uuid NOT NULL REFERENCES pays (id) ON DELETE CASCADE,
  langue_id   uuid NOT NULL REFERENCES langue (id) ON DELETE CASCADE,
  statut      varchar(30) NOT NULL
              CHECK (statut IN ('officielle', 'nationale', 'enseignement_initial', 'vehiculaire')),
  ordre       int NOT NULL DEFAULT 0
);

CREATE INDEX idx_pays_langue_pays_id ON pays_langue (pays_id);
CREATE INDEX idx_pays_langue_langue_id ON pays_langue (langue_id);

-- ----------------------------------------------------------------------------
-- Table : pays_bloc_regional (KER-REF-07) — appartenance datée
-- Cas d'école : retrait Mali/Burkina Faso/Niger de la CEDEAO le 29 janvier 2025.
-- ----------------------------------------------------------------------------
CREATE TABLE pays_bloc_regional (
  id                 uuid PRIMARY KEY,
  pays_id            uuid NOT NULL REFERENCES pays (id) ON DELETE CASCADE,
  bloc_regional_id   uuid NOT NULL REFERENCES bloc_regional (id) ON DELETE CASCADE,
  date_adhesion      date NOT NULL,
  date_retrait       date,
  statut_actuel      varchar(20) NOT NULL DEFAULT 'membre'
                     CHECK (statut_actuel IN ('membre', 'suspendu', 'retire'))
);

CREATE INDEX idx_pays_bloc_regional_pays_id ON pays_bloc_regional (pays_id);
CREATE INDEX idx_pays_bloc_regional_bloc_id ON pays_bloc_regional (bloc_regional_id);

-- ----------------------------------------------------------------------------
-- Table : taux_change (KER-REF-04) — unique source de taux de change de la plateforme
-- ----------------------------------------------------------------------------
CREATE TABLE taux_change (
  id                uuid PRIMARY KEY,
  devise_base_id    uuid NOT NULL REFERENCES devise (id) ON DELETE CASCADE,
  devise_cible_id   uuid NOT NULL REFERENCES devise (id) ON DELETE CASCADE,
  taux              numeric(24,10) NOT NULL CHECK (taux > 0),  -- NUMERIC, jamais FLOAT/DOUBLE
  valid_du          timestamptz NOT NULL,
  valid_au          timestamptz,                                -- NULL = en vigueur jusqu'à nouvel ordre
  source            varchar(150) NOT NULL
);

CREATE INDEX idx_taux_change_base ON taux_change (devise_base_id);
CREATE INDEX idx_taux_change_cible ON taux_change (devise_cible_id);

-- ----------------------------------------------------------------------------
-- Table : ville (KER-ADM-03) — entité dédiée indexée
-- ----------------------------------------------------------------------------
CREATE TABLE ville (
  id                             uuid PRIMARY KEY,
  pays_id                        uuid NOT NULL REFERENCES pays (id) ON DELETE CASCADE,
  nom                            varchar(150) NOT NULL,
  referentiel_hierarchique_id    uuid,   -- référence optionnelle au futur Referential Engine (service distinct)
  est_actif                      boolean NOT NULL DEFAULT true,
  cree_le                        timestamptz NOT NULL DEFAULT now(),
  modifie_le                     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ville_pays_id ON ville (pays_id);
