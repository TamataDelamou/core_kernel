import { Inject, Injectable } from '@nestjs/common';
import { CurrencyValidationPort } from '../../../common/kernel-ports/currency-validation.port';
import { DEVISE_REPOSITORY, DeviseRepository } from '../../domain/repositories/referential.repositories';

/**
 * Implémentation concrète du port `CurrencyValidationPort` (common/kernel-ports), consommée
 * par GSG Product Catalog pour interdire l'application d'un prix dans une devise non
 * certifiée. "Certifiée" signifie : publiée (KER-AUD-04, workflow au statut `publie`) et
 * active — une devise en brouillon, en révision ou désactivée n'est jamais éligible à une
 * grille tarifaire, même si elle existe déjà dans le référentiel.
 */
@Injectable()
export class CurrencyValidationAdapter implements CurrencyValidationPort {
  constructor(@Inject(DEVISE_REPOSITORY) private readonly deviseRepository: DeviseRepository) {}

  async isCertified(deviseId: string): Promise<boolean> {
    const devise = await this.deviseRepository.findById(deviseId);
    if (!devise) return false;
    return devise.statutWorkflow === 'publie' && devise.estActif;
  }
}
