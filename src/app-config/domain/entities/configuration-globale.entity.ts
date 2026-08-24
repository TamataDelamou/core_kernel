export const CONFIGURATION_GLOBALE_ID = '00000000-0000-0000-0000-000000000001';

export interface ConfigurationGlobaleProps {
  deviseId: string | null;
  langueId: string | null;
  fuseauHoraire: string;
  formatDate: string;
  formatNombre: string;
  modifieLe: Date;
}

/**
 * KER-INH-02 : le niveau Global garantit qu'une résolution ne se termine JAMAIS sur une
 * valeur arbitraire codée en dur dans le code applicatif d'un produit — mais la valeur de
 * repli elle-même doit bien exister quelque part. C'est ici, en base, administrable par
 * kernel.admin, jamais dans le code des produits consommateurs. Singleton : un identifiant
 * fixe (`CONFIGURATION_GLOBALE_ID`), jamais plus d'une ligne.
 *
 * `fuseauHoraire`, `formatDate` et `formatNombre` sont non-nullables sur CE niveau précis :
 * si même la configuration globale ne les définit pas, il n'existe plus aucun niveau vers
 * lequel remonter — `DEFAUTS_ABSOLUS` sert alors de tout dernier repli, au niveau code, mais
 * seulement si la table elle-même n'a jamais été initialisée (premier démarrage du noyau,
 * avant toute action d'un kernel.admin).
 */
export class ConfigurationGlobale {
  private constructor(private props: ConfigurationGlobaleProps) {}

  static create(params: {
    deviseId?: string | null;
    langueId?: string | null;
    fuseauHoraire?: string;
    formatDate?: string;
    formatNombre?: string;
  }): ConfigurationGlobale {
    return new ConfigurationGlobale({
      deviseId: params.deviseId ?? null,
      langueId: params.langueId ?? null,
      fuseauHoraire: params.fuseauHoraire ?? DEFAUTS_ABSOLUS.fuseauHoraire,
      formatDate: params.formatDate ?? DEFAUTS_ABSOLUS.formatDate,
      formatNombre: params.formatNombre ?? DEFAUTS_ABSOLUS.formatNombre,
      modifieLe: new Date(),
    });
  }

  static reconstitute(props: ConfigurationGlobaleProps): ConfigurationGlobale {
    return new ConfigurationGlobale(props);
  }

  update(params: Partial<Omit<ConfigurationGlobaleProps, 'modifieLe'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  toSnapshot(): Readonly<ConfigurationGlobaleProps> {
    return { ...this.props };
  }
}

/**
 * Dernier repli, au niveau code — n'intervient QUE si la table `configuration_globale` n'a
 * jamais été initialisée (aucune ligne). Dès qu'un kernel.admin définit la configuration
 * globale une seule fois, ces constantes ne sont plus jamais consultées.
 */
export const DEFAUTS_ABSOLUS = {
  fuseauHoraire: 'UTC',
  formatDate: 'DD/MM/YYYY',
  formatNombre: '#,##0.00',
} as const;
