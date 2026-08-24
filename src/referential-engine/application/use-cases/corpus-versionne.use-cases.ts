import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CorpusVersionne } from '../../domain/entities/corpus-versionne.entity';
import { MetadonneesGouvernance, StatutConfiance } from '../../domain/entities/gouvernance';
import {
  CORPUS_VERSIONNE_REPOSITORY,
  CorpusVersionneRepository,
} from '../../domain/repositories/referential-engine.repositories';
import { CorpusVersionneNotFoundError } from '../../domain/exceptions/referential-engine.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_ENGINE_EVENT_TYPES } from '../../domain/events/referential-engine-event-catalog';

export interface CreateCorpusVersionneCommand {
  paysId: string;
  codeDomaine: string;
  libelleVersion: string;
  organismeCertificateur: string;
  statutConfiance: StatutConfiance;
  source: string;
}

@Injectable()
export class CreateCorpusVersionneUseCase {
  constructor(
    @Inject(CORPUS_VERSIONNE_REPOSITORY) private readonly corpusRepository: CorpusVersionneRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateCorpusVersionneCommand): Promise<{ id: string }> {
    const gouvernance = MetadonneesGouvernance.create({
      organismeCertificateur: command.organismeCertificateur,
      statutConfiance: command.statutConfiance,
      source: command.source,
    });

    const corpus = CorpusVersionne.create({
      id: uuidv4(),
      paysId: command.paysId,
      codeDomaine: command.codeDomaine,
      libelleVersion: command.libelleVersion,
      gouvernance,
    });
    await this.corpusRepository.save(corpus);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.CORPUS_VERSIONNE_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: { id: corpus.id, paysId: command.paysId, codeDomaine: command.codeDomaine },
    });

    return { id: corpus.id };
  }
}

@Injectable()
export class UpdateCorpusVersionneUseCase {
  constructor(
    @Inject(CORPUS_VERSIONNE_REPOSITORY) private readonly corpusRepository: CorpusVersionneRepository,
  ) {}

  async updateDetails(id: string, updates: Partial<{ libelleVersion: string }>): Promise<void> {
    const corpus = await this.get(id);
    corpus.updateDetails(updates);
    await this.corpusRepository.save(corpus);
  }

  async updateGouvernance(
    id: string,
    params: { organismeCertificateur: string; statutConfiance: StatutConfiance; source: string },
  ): Promise<void> {
    const corpus = await this.get(id);
    corpus.updateGouvernance(MetadonneesGouvernance.create(params));
    await this.corpusRepository.save(corpus);
  }

  private async get(id: string): Promise<CorpusVersionne> {
    const corpus = await this.corpusRepository.findById(id);
    if (!corpus) throw new CorpusVersionneNotFoundError();
    return corpus;
  }
}

/**
 * KER-ENG-08 : publie une version de corpus — un produit consommateur (via CorpusLookupPort)
 * ne verra jamais un corpus au statut `brouillon`. Nom aligné sur la directive d'exécution
 * ("PublishCorpusUseCase").
 */
@Injectable()
export class PublishCorpusUseCase {
  constructor(
    @Inject(CORPUS_VERSIONNE_REPOSITORY) private readonly corpusRepository: CorpusVersionneRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(id: string): Promise<void> {
    const corpus = await this.get(id);
    corpus.publish();
    await this.corpusRepository.save(corpus);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.CORPUS_VERSIONNE_PUBLISHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: { id: corpus.id, paysId: corpus.paysId, codeDomaine: corpus.codeDomaine },
    });
  }

  private async get(id: string): Promise<CorpusVersionne> {
    const corpus = await this.corpusRepository.findById(id);
    if (!corpus) throw new CorpusVersionneNotFoundError();
    return corpus;
  }
}

@Injectable()
export class ArchiveCorpusUseCase {
  constructor(
    @Inject(CORPUS_VERSIONNE_REPOSITORY) private readonly corpusRepository: CorpusVersionneRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(id: string): Promise<void> {
    const corpus = await this.get(id);
    corpus.archive();
    await this.corpusRepository.save(corpus);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.CORPUS_VERSIONNE_ARCHIVED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: { id: corpus.id },
    });
  }

  private async get(id: string): Promise<CorpusVersionne> {
    const corpus = await this.corpusRepository.findById(id);
    if (!corpus) throw new CorpusVersionneNotFoundError();
    return corpus;
  }
}

@Injectable()
export class QueryCorpusUseCase {
  constructor(
    @Inject(CORPUS_VERSIONNE_REPOSITORY) private readonly corpusRepository: CorpusVersionneRepository,
  ) {}

  async getById(id: string): Promise<CorpusVersionne> {
    const corpus = await this.corpusRepository.findById(id);
    if (!corpus) throw new CorpusVersionneNotFoundError();
    return corpus;
  }

  async listByPaysEtDomaine(paysId: string, codeDomaine: string): Promise<CorpusVersionne[]> {
    return this.corpusRepository.findByPaysAndCodeDomaine(paysId, codeDomaine);
  }
}
