-- ============================================================================
-- GSG Product Catalog — Schéma PostgreSQL de référence (KER-PRD).
-- Vue DDL lisible ; source de vérité exécutable :
-- src/product/infrastructure/persistence/migrations/1756137600000-InitProductSchema.ts
--
-- Isolation stricte : aucune contrainte de clé étrangère physique vers `pays`/`devise`
-- (GSG Referential) ni `organisation` (Org Registry) — accès exclusivement par ports
-- (CurrencyValidationPort, OrganisationLookupPort), jamais par base partagée (KER-VIS-03).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Table : catalogue — multi-catalogues scopés (KER-PRD)
-- ----------------------------------------------------------------------------
CREATE TABLE catalogue (
  id                uuid PRIMARY KEY,
  nom               varchar(200) NOT NULL,
  scope_type        varchar(30) NOT NULL
                    CHECK (scope_type IN ('portefeuille_global', 'organisation', 'zone_geographique')),
  scope_cible_id    uuid,   -- gsg_org_id (Org Registry) ou pays_id (GSG Referential), selon scope_type
  est_actif         boolean NOT NULL DEFAULT true,
  statut_workflow   varchar(20) NOT NULL DEFAULT 'brouillon'
                    CHECK (statut_workflow IN ('brouillon', 'valide', 'publie', 'archive')),
  cree_le           timestamptz NOT NULL DEFAULT now(),
  modifie_le        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_catalogue_scope_cible_coherent CHECK (
    (scope_type = 'portefeuille_global' AND scope_cible_id IS NULL)
    OR (scope_type <> 'portefeuille_global' AND scope_cible_id IS NOT NULL)
  )
);

CREATE INDEX idx_catalogue_scope_cible_id ON catalogue (scope_cible_id);
CREATE INDEX idx_catalogue_statut_workflow ON catalogue (statut_workflow);

-- ----------------------------------------------------------------------------
-- Table : produit_catalogue — produit commercial rattaché à un catalogue
-- ----------------------------------------------------------------------------
CREATE TABLE produit_catalogue (
  id                uuid PRIMARY KEY,
  catalogue_id      uuid NOT NULL REFERENCES catalogue (id) ON DELETE CASCADE,
  code              varchar(64) NOT NULL,
  nom               varchar(200) NOT NULL,
  description       text,
  est_actif         boolean NOT NULL DEFAULT true,
  statut_workflow   varchar(20) NOT NULL DEFAULT 'brouillon'
                    CHECK (statut_workflow IN ('brouillon', 'valide', 'publie', 'archive')),
  cree_le           timestamptz NOT NULL DEFAULT now(),
  modifie_le        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_produit_catalogue_code ON produit_catalogue (catalogue_id, code);
CREATE INDEX idx_produit_catalogue_catalogue_id ON produit_catalogue (catalogue_id);

-- ----------------------------------------------------------------------------
-- Table : offre — Plan/Offre (Abonnement, Usage, Ponctuel)
-- ----------------------------------------------------------------------------
CREATE TABLE offre (
  id                    uuid PRIMARY KEY,
  produit_id            uuid NOT NULL REFERENCES produit_catalogue (id) ON DELETE CASCADE,
  code                  varchar(64) NOT NULL,
  nom                   varchar(200) NOT NULL,
  type                  varchar(20) NOT NULL CHECK (type IN ('abonnement', 'usage', 'ponctuel')),
  periode_facturation   varchar(20) NOT NULL CHECK (periode_facturation IN ('mensuelle', 'annuelle', 'unique')),
  est_actif             boolean NOT NULL DEFAULT true,
  statut_workflow       varchar(20) NOT NULL DEFAULT 'brouillon'
                        CHECK (statut_workflow IN ('brouillon', 'valide', 'publie', 'archive')),
  cree_le               timestamptz NOT NULL DEFAULT now(),
  modifie_le            timestamptz NOT NULL DEFAULT now(),

  -- Invariant KER-PRD : une offre ponctuelle n'a de sens qu'en paiement unique, et
  -- inversement un abonnement/usage n'a jamais de paiement "unique".
  CONSTRAINT ck_offre_type_periode_coherents CHECK (
    (type = 'ponctuel' AND periode_facturation = 'unique')
    OR (type <> 'ponctuel' AND periode_facturation <> 'unique')
  )
);

CREATE UNIQUE INDEX uq_offre_code ON offre (produit_id, code);
CREATE INDEX idx_offre_produit_id ON offre (produit_id);

-- ----------------------------------------------------------------------------
-- Table : feature — fonctionnalité transversale, réutilisable par plusieurs offres
-- ----------------------------------------------------------------------------
CREATE TABLE feature (
  id            uuid PRIMARY KEY,
  code          varchar(64) NOT NULL,
  nom           varchar(200) NOT NULL,
  description   text,
  est_actif     boolean NOT NULL DEFAULT true,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  modifie_le    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_feature_code ON feature (code);

-- ----------------------------------------------------------------------------
-- Table : offre_entitlement — rattachement Feature ↔ Offre avec quota éventuel
-- ----------------------------------------------------------------------------
CREATE TABLE offre_entitlement (
  id           uuid PRIMARY KEY,
  offre_id     uuid NOT NULL REFERENCES offre (id) ON DELETE CASCADE,
  feature_id   uuid NOT NULL REFERENCES feature (id) ON DELETE CASCADE,
  limite       int CHECK (limite IS NULL OR limite >= 0),   -- NULL = illimité
  unite        varchar(50)                                   -- ex. "utilisateurs", "Go" — informatif
);

CREATE UNIQUE INDEX uq_offre_entitlement ON offre_entitlement (offre_id, feature_id);

-- ----------------------------------------------------------------------------
-- Table : grille_tarifaire — versions de grilles tarifaires (KER-PRD)
-- ----------------------------------------------------------------------------
CREATE TABLE grille_tarifaire (
  id                    uuid PRIMARY KEY,
  offre_id              uuid NOT NULL REFERENCES offre (id) ON DELETE CASCADE,
  version               int NOT NULL CHECK (version >= 1),
  devise_id             uuid NOT NULL,   -- certification vérifiée en application via CurrencyValidationPort
  montant_minor_unit    integer NOT NULL CHECK (montant_minor_unit >= 0),  -- KER-REF-05 : entier, jamais flottant
  periode_facturation   varchar(20) NOT NULL,
  date_effective        timestamptz NOT NULL,
  date_fin              timestamptz,     -- NULL = en vigueur jusqu'à nouvel ordre/remplacement
  statut_workflow       varchar(20) NOT NULL DEFAULT 'brouillon'
                        CHECK (statut_workflow IN ('brouillon', 'valide', 'publie', 'archive')),
  cree_le               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_grille_tarifaire_fenetre CHECK (date_fin IS NULL OR date_fin > date_effective)
);

CREATE UNIQUE INDEX uq_grille_tarifaire_version ON grille_tarifaire (offre_id, version);
CREATE INDEX idx_grille_tarifaire_offre_id ON grille_tarifaire (offre_id);
CREATE INDEX idx_grille_tarifaire_devise_id ON grille_tarifaire (devise_id);
CREATE INDEX idx_grille_tarifaire_offre_devise_statut ON grille_tarifaire (offre_id, devise_id, statut_workflow);

-- NOTE : l'absence de chevauchement entre grilles PUBLIÉES pour une même paire
-- (offre_id, devise_id) n'est PAS une contrainte SQL déclarative (PostgreSQL ne supporte
-- les contraintes d'exclusion sur plages qu'avec l'extension btree_gist et des types range
-- natifs) — elle est vérifiée applicativement par assertNoOverlapWithExisting, à la fois à
-- la création ET à la publication (voir GrilleTarifaireUseCase). Une évolution future pourrait
-- ajouter une contrainte EXCLUDE USING gist si le volume justifie une garantie au niveau base.
