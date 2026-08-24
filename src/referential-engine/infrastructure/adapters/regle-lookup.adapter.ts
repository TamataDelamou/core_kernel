import { Inject, Injectable } from '@nestjs/common';
import { RegleInfo, RegleLookupPort } from '../../../common/kernel-ports/regle-lookup.port';
import {
  REFERENTIEL_REGLE_REPOSITORY,
  ReferentielRegleRepository,
} from '../../domain/repositories/referential-engine.repositories';

@Injectable()
export class RegleLookupAdapter implements RegleLookupPort {
  constructor(
    @Inject(REFERENTIEL_REGLE_REPOSITORY) private readonly regleRepository: ReferentielRegleRepository,
  ) {}

  /**
   * KER-ENG-06 appliqué à la frontière : `findPublieesEtVerifieesByNoeud` (le repository,
   * pas cet adaptateur) exclut déjà A_VERIFIER, désactivé, et non publié — cet adaptateur ne
   * fait qu'appliquer la forme de réponse attendue par le port, aucune règle métier
   * supplémentaire n'est nécessaire ici, le filtre est déjà structurellement garanti en amont.
   */
  async getReglesForNoeud(noeudId: string): Promise<RegleInfo[]> {
    const regles = await this.regleRepository.findPublieesEtVerifieesByNoeud(noeudId);
    return regles.map((regle) => {
      const snapshot = regle.toSnapshot();
      return {
        id: snapshot.id,
        nom: snapshot.nom,
        sigle: snapshot.sigle,
        valeur: snapshot.valeur,
        organismeCertificateur: snapshot.gouvernance.toSnapshot().organismeCertificateur,
      };
    });
  }
}
