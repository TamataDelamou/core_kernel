-- ============================================================================
-- Org Registry — Schéma PostgreSQL de référence (KER-ORG-01..04).
-- Vue DDL lisible ; source de vérité exécutable :
-- src/org/infrastructure/persistence/migrations/1756051200000-InitOrgSchema.ts
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Table : organisation (KER-ORG-01, KER-ORG-04)
-- ----------------------------------------------------------------------------
CREATE TABLE organisation (
  id                          uuid PRIMARY KEY,          -- gsg_org_id
  nom                         varchar(200) NOT NULL,
  organisation_mere_id        uuid REFERENCES organisation (id) ON DELETE SET NULL,

  -- Référentiel propre à CETTE organisation (KER-ORG-04) — jamais hérité automatiquement
  -- de la maison mère : une filiale peut être dans un autre pays sans code applicatif modifié.
  pays_id                     uuid,
  unite_administrative_id     uuid,
  ville_id                    uuid,
  devise_id                   uuid,
  langue_id                   uuid,
  fuseau_horaire              varchar(64),

  est_actif                   boolean NOT NULL DEFAULT true,
  cree_le                     timestamptz NOT NULL DEFAULT now(),
  modifie_le                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_organisation_mere_id ON organisation (organisation_mere_id);

-- ----------------------------------------------------------------------------
-- Table : unite_operationnelle — agence/antenne interne, pas de gsg_org_id propre
-- ----------------------------------------------------------------------------
CREATE TABLE unite_operationnelle (
  id                          uuid PRIMARY KEY,
  organisation_id             uuid NOT NULL REFERENCES organisation (id) ON DELETE CASCADE,
  nom                         varchar(200) NOT NULL,
  pays_id                     uuid,
  unite_administrative_id     uuid,
  ville_id                    uuid,
  devise_id                   uuid,
  langue_id                   uuid,
  fuseau_horaire              varchar(64),
  est_actif                   boolean NOT NULL DEFAULT true,
  cree_le                     timestamptz NOT NULL DEFAULT now(),
  modifie_le                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_unite_operationnelle_organisation_id ON unite_operationnelle (organisation_id);

-- ----------------------------------------------------------------------------
-- Table : abonnement_produit (KER-ORG-03) — sous-ensemble libre du portefeuille
-- ----------------------------------------------------------------------------
CREATE TABLE abonnement_produit (
  id                 uuid PRIMARY KEY,
  organisation_id    uuid NOT NULL REFERENCES organisation (id) ON DELETE CASCADE,
  produit_id         uuid NOT NULL,          -- référence vers le Registre central des produits (service distinct)
  statut             varchar(20) NOT NULL DEFAULT 'actif'
                     CHECK (statut IN ('actif', 'suspendu', 'resilie')),
  date_debut         date NOT NULL,
  date_fin           date
);

CREATE INDEX idx_abonnement_produit_organisation_id ON abonnement_produit (organisation_id);
CREATE INDEX idx_abonnement_produit_produit_id ON abonnement_produit (produit_id);
