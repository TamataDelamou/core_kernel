export class ProduitPortefeuilleNotFoundError extends Error {
  constructor() {
    super('Produit du portefeuille introuvable.');
    this.name = 'ProduitPortefeuilleNotFoundError';
  }
}

export class ProduitPortefeuilleCodeAlreadyExistsError extends Error {
  constructor(code: string) {
    super(`Un produit avec le code "${code}" existe déjà dans le registre (KER-PROD-01).`);
    this.name = 'ProduitPortefeuilleCodeAlreadyExistsError';
  }
}
