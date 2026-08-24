import { Inject, Injectable } from '@nestjs/common';
import {
  CorpusLookupPort,
  CorpusVersionneInfo,
} from '../../../common/kernel-ports/corpus-lookup.port';
import {
  CORPUS_ELEMENT_REPOSITORY,
  CORPUS_VERSIONNE_REPOSITORY,
  CorpusElementRepository,
  CorpusVersionneRepository,
} from '../../domain/repositories/referential-engine.repositories';

@Injectable()
export class CorpusLookupAdapter implements CorpusLookupPort {
  constructor(
    @Inject(CORPUS_VERSIONNE_REPOSITORY) private readonly corpusRepository: CorpusVersionneRepository,
    @Inject(CORPUS_ELEMENT_REPOSITORY) private readonly elementRepository: CorpusElementRepository,
  ) {}

  /** `findPublieByPaysAndCodeDomaine` exclut déjà tout corpus au statut "brouillon" ou "archive". */
  async getCorpusPublie(paysId: string, codeDomaine: string): Promise<CorpusVersionneInfo | null> {
    const corpus = await this.corpusRepository.findPublieByPaysAndCodeDomaine(paysId, codeDomaine);
    if (!corpus) return null;

    const snapshot = corpus.toSnapshot();
    const elements = await this.elementRepository.findByCorpusVersionne(corpus.id);

    return {
      id: snapshot.id,
      libelleVersion: snapshot.libelleVersion,
      organismeCertificateur: snapshot.gouvernance.toSnapshot().organismeCertificateur,
      elements: elements.map((element) => {
        const elementSnapshot = element.toSnapshot();
        return {
          id: elementSnapshot.id,
          parentId: elementSnapshot.parentId,
          nom: elementSnapshot.nom,
          valeurOuCoefficient: elementSnapshot.valeurOuCoefficient,
          ordre: elementSnapshot.ordre,
        };
      }),
    };
  }
}
