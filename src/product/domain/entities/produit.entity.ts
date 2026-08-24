import { assertCatalogTransitionAllowed, StatutCatalogWorkflow } from './catalog-workflow';

const CODE_PRODUIT_REGEX = /^[a-z0-9][a-z0-9._-]{1,63}$/;

export class InvalidCodeProduitError extends Error {
  constructor(rawValue: string) {
    super(
      `Code produit invalide : "${rawValue}" (attendu : 2 à 64 caractères, minuscules/chiffres/._-, ` +
        'commençant par une lettre ou un chiffre).',
    );
    this.name = 'InvalidCodeProduitError';
  }
}

export interface ProduitProps {
  id: string;
  catalogueId: string;
  code: string;
  nom: string;
  description: string | null;
  estActif: boolean;
  statutWorkflow: StatutCatalogWorkflow;
  creeLe: Date;
  modifieLe: Date;
}

/**
 * Entité de domaine Produit. Le registre central des produits du noyau (section 5 du
 * Cahier, KER-PROD-01) reste la source de vérité du PORTEFEUILLE GSG (Ecclesias 360,
 * EduRéussite, ...) — cette entité `Produit` est un concept distinct et plus fin : un
 * produit COMMERCIAL vendu au sein d'un catalogue (ex. "Pack Association Essentiel"),
 * qui peut ou non correspondre 1:1 à une ligne du registre central des produits.
 */
export class Produit {
  private constructor(private props: ProduitProps) {}

  static create(params: {
    id: string;
    catalogueId: string;
    code: string;
    nom: string;
    description?: string | null;
  }): Produit {
    const code = params.code.trim().toLowerCase();
    if (!CODE_PRODUIT_REGEX.test(code)) {
      throw new InvalidCodeProduitError(params.code);
    }

    const now = new Date();
    return new Produit({
      id: params.id,
      catalogueId: params.catalogueId,
      code,
      nom: params.nom.trim(),
      description: params.description ?? null,
      estActif: true,
      statutWorkflow: 'brouillon',
      creeLe: now,
      modifieLe: now,
    });
  }

  static reconstitute(props: ProduitProps): Produit {
    return new Produit(props);
  }

  get id(): string {
    return this.props.id;
  }

  get catalogueId(): string {
    return this.props.catalogueId;
  }

  get code(): string {
    return this.props.code;
  }

  get statutWorkflow(): StatutCatalogWorkflow {
    return this.props.statutWorkflow;
  }

  get estActif(): boolean {
    return this.props.estActif;
  }

  updateDetails(params: Partial<Pick<ProduitProps, 'nom' | 'description'>>): void {
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

  toSnapshot(): Readonly<ProduitProps> {
    return { ...this.props };
  }
}
