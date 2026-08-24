import {
  assertCatalogTransitionAllowed,
  StatutCatalogWorkflow,
} from './catalog-workflow';

export type TypeScopeCatalogue = 'portefeuille_global' | 'organisation' | 'zone_geographique';

export class InvalidCatalogueScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCatalogueScopeError';
  }
}

/**
 * Value Object représentant le ciblage d'un catalogue (KER-PRD — "Multi-catalogues & Scopes").
 * - `portefeuille_global` : aucune cible, le catalogue s'applique par défaut à toute
 *   organisation qui n'a pas de catalogue plus spécifique.
 * - `organisation` : `cibleId` référence un `gsg_org_id` (Org Registry, via port — jamais de
 *   dépendance directe). Le contrôle de portée à l'exécution (KER-PRD, hiérarchie des
 *   organisations) est de la responsabilité de l'use-case consommateur, pas de ce VO.
 * - `zone_geographique` : `cibleId` référence un `pays_id` (GSG Referential, via port).
 */
export class CatalogueScope {
  private constructor(
    private readonly type: TypeScopeCatalogue,
    private readonly cibleId: string | null,
  ) {}

  static portefeuilleGlobal(): CatalogueScope {
    return new CatalogueScope('portefeuille_global', null);
  }

  static organisation(organisationId: string): CatalogueScope {
    if (!organisationId) {
      throw new InvalidCatalogueScopeError(
        'Un scope de type "organisation" nécessite un organisationId non vide.',
      );
    }
    return new CatalogueScope('organisation', organisationId);
  }

  static zoneGeographique(paysId: string): CatalogueScope {
    if (!paysId) {
      throw new InvalidCatalogueScopeError(
        'Un scope de type "zone_geographique" nécessite un paysId non vide.',
      );
    }
    return new CatalogueScope('zone_geographique', paysId);
  }

  static reconstitute(type: TypeScopeCatalogue, cibleId: string | null): CatalogueScope {
    if (type !== 'portefeuille_global' && !cibleId) {
      throw new InvalidCatalogueScopeError(`Un scope de type "${type}" nécessite un cibleId non vide.`);
    }
    return new CatalogueScope(type, cibleId);
  }

  getType(): TypeScopeCatalogue {
    return this.type;
  }

  getCibleId(): string | null {
    return this.cibleId;
  }

  equals(other: CatalogueScope): boolean {
    return this.type === other.type && this.cibleId === other.cibleId;
  }
}

export interface CatalogueProps {
  id: string;
  /**
   * Référence au Registre Central des Produits (KER-PROD-01) — quel produit du portefeuille
   * GSG ce catalogue commercial sert-il (Ecclesias 360, AssoShop...). Validée à la création
   * via ProductLookupPort, jamais un UUID libre (voir CreateCatalogueUseCase). Orthogonal au
   * `scope` : `produitId` dit QUEL produit, `scope` dit QUI peut y accéder.
   */
  produitId: string;
  nom: string;
  scope: CatalogueScope;
  estActif: boolean;
  statutWorkflow: StatutCatalogWorkflow;
  creeLe: Date;
  modifieLe: Date;
}

export class Catalogue {
  private constructor(private props: CatalogueProps) {}

  static create(params: { id: string; produitId: string; nom: string; scope: CatalogueScope }): Catalogue {
    const now = new Date();
    return new Catalogue({
      id: params.id,
      produitId: params.produitId,
      nom: params.nom.trim(),
      scope: params.scope,
      estActif: true,
      statutWorkflow: 'brouillon',
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: CatalogueProps): Catalogue {
    return new Catalogue(props);
  }

  get id(): string {
    return this.props.id;
  }

  get produitId(): string {
    return this.props.produitId;
  }

  get scope(): CatalogueScope {
    return this.props.scope;
  }

  get statutWorkflow(): StatutCatalogWorkflow {
    return this.props.statutWorkflow;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  updateDetails(params: Partial<Pick<CatalogueProps, 'nom'>>): void {
    this.props = { ...this.props, ...params, modifieLe: new Date() };
  }

  validate(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'valide');
    this.props.statutWorkflow = 'valide';
    this.props.modifieLe = new Date();
  }

  rejectToDraft(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'brouillon');
    this.props.statutWorkflow = 'brouillon';
    this.props.modifieLe = new Date();
  }

  publish(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'publie');
    this.props.statutWorkflow = 'publie';
    this.props.modifieLe = new Date();
  }

  archive(): void {
    assertCatalogTransitionAllowed(this.props.statutWorkflow, 'archive');
    this.props.statutWorkflow = 'archive';
    this.props.modifieLe = new Date();
  }

  deactivate(): void {
    this.props.estActif = false;
    this.props.modifieLe = new Date();
  }

  reactivate(): void {
    this.props.estActif = true;
    this.props.modifieLe = new Date();
  }

  toSnapshot(): Readonly<CatalogueProps> {
    return { ...this.props };
  }
}
