export type StatutConfiance = 'ELEVE' | 'MOYEN' | 'A_VERIFIER';

export const STATUTS_CONFIANCE_VALIDES: readonly StatutConfiance[] = ['ELEVE', 'MOYEN', 'A_VERIFIER'];

export class MissingOrganismeCertificateurError extends Error {
  constructor() {
    super("L'organisme certificateur est obligatoire (KER-ENG-05).");
    this.name = 'MissingOrganismeCertificateurError';
  }
}

export class InvalidStatutConfianceError extends Error {
  constructor(valeur: string) {
    super(`Statut de confiance invalide : "${valeur}" (valeurs autorisées : ${STATUTS_CONFIANCE_VALIDES.join(', ')}).`);
    this.name = 'InvalidStatutConfianceError';
  }
}

export interface MetadonneesGouvernanceProps {
  organismeCertificateur: string;
  statutConfiance: StatutConfiance;
  source: string;
  dateDerniereVerification: Date;
}

/**
 * KER-ENG-05 : "chaque règle ou donnée structurelle rattachée à un pays identifie l'organisme
 * qui la certifie ou la réglemente." KER-ENG-06 : "chaque donnée du référentiel porte un
 * statut de confiance, une source et une date de dernière vérification." Value Object partagé
 * par `ReferentielRegle` et `CorpusVersionne` — jamais dupliqué en deux définitions
 * indépendantes (le même piège que la fusion GSG Core / Cadre de Référence décrite en
 * ouverture du Cahier).
 */
export class MetadonneesGouvernance {
  private constructor(private readonly props: MetadonneesGouvernanceProps) {}

  static create(params: {
    organismeCertificateur: string;
    statutConfiance: StatutConfiance;
    source: string;
    dateDerniereVerification?: Date;
  }): MetadonneesGouvernance {
    const organisme = params.organismeCertificateur.trim();
    if (!organisme) {
      throw new MissingOrganismeCertificateurError();
    }
    if (!STATUTS_CONFIANCE_VALIDES.includes(params.statutConfiance)) {
      throw new InvalidStatutConfianceError(params.statutConfiance);
    }

    return new MetadonneesGouvernance({
      organismeCertificateur: organisme,
      statutConfiance: params.statutConfiance,
      source: params.source.trim(),
      dateDerniereVerification: params.dateDerniereVerification ?? new Date(),
    });
  }

  static reconstitute(props: MetadonneesGouvernanceProps): MetadonneesGouvernance {
    return new MetadonneesGouvernance(props);
  }

  get organismeCertificateur(): string {
    return this.props.organismeCertificateur;
  }

  get statutConfiance(): StatutConfiance {
    return this.props.statutConfiance;
  }

  get estVerifie(): boolean {
    return this.props.statutConfiance !== 'A_VERIFIER';
  }

  toSnapshot(): Readonly<MetadonneesGouvernanceProps> {
    return { ...this.props };
  }
}
