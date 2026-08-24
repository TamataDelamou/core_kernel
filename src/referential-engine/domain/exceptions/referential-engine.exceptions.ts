export class NiveauAdministratifNotFoundError extends Error {
  constructor() {
    super('Niveau administratif introuvable.');
    this.name = 'NiveauAdministratifNotFoundError';
  }
}

export class NiveauAdministratifRangAlreadyExistsError extends Error {
  constructor(paysId: string, rang: number) {
    super(`Un niveau administratif de rang ${rang} existe déjà pour le pays "${paysId}".`);
    this.name = 'NiveauAdministratifRangAlreadyExistsError';
  }
}

export class NoeudHierarchiqueNotFoundError extends Error {
  constructor() {
    super('Nœud hiérarchique introuvable.');
    this.name = 'NoeudHierarchiqueNotFoundError';
  }
}

/** Le rang normalisé du nœud (dérivé du parent) ne correspond à aucun NiveauAdministratif défini pour ce pays. */
export class UndefinedNiveauForRangError extends Error {
  constructor(paysId: string, rang: number) {
    super(
      `Aucun NiveauAdministratif de rang ${rang} n'est défini pour le pays "${paysId}" — ` +
        'impossible de créer un nœud à ce niveau sans définition préalable.',
    );
    this.name = 'UndefinedNiveauForRangError';
  }
}

export class ReferentielRegleNotFoundError extends Error {
  constructor() {
    super('Règle référentielle introuvable.');
    this.name = 'ReferentielRegleNotFoundError';
  }
}

export class CorpusVersionneNotFoundError extends Error {
  constructor() {
    super('Corpus versionné introuvable.');
    this.name = 'CorpusVersionneNotFoundError';
  }
}

export class CorpusElementNotFoundError extends Error {
  constructor() {
    super('Élément de corpus introuvable.');
    this.name = 'CorpusElementNotFoundError';
  }
}

/** KER-ADM-04, volet villes : refuse une opération si le compteur local indique au moins une ville rattachée. */
export class NodeHasAttachedVillesError extends Error {
  constructor() {
    super(
      "Opération refusée : au moins une ville référence ce nœud (compteur local " +
        "compteur_villes_rattachees > 0). Déplacez d'abord ces villes vers un autre nœud (KER-ADM-04).",
    );
    this.name = 'NodeHasAttachedVillesError';
  }
}
