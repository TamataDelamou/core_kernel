import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  CorpusElement,
  CorpusElementCircularParentError,
  CorpusElementParentNotInSameCorpusError,
  wouldCreateCycleInCorpus,
} from '../../domain/entities/corpus-element.entity';
import {
  CORPUS_ELEMENT_REPOSITORY,
  CORPUS_VERSIONNE_REPOSITORY,
  CorpusElementRepository,
  CorpusVersionneRepository,
  NOEUD_HIERARCHIQUE_REPOSITORY,
  NoeudHierarchiqueRepository,
} from '../../domain/repositories/referential-engine.repositories';
import {
  CorpusElementNotFoundError,
  CorpusVersionneNotFoundError,
  NoeudHierarchiqueNotFoundError,
} from '../../domain/exceptions/referential-engine.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_ENGINE_EVENT_TYPES } from '../../domain/events/referential-engine-event-catalog';

export interface AttachCorpusElementCommand {
  corpusVersionneId: string;
  referentielHierarchiqueId: string;
  parentId?: string | null;
  nom: string;
  valeurOuCoefficient?: string | null;
  metadata?: Record<string, unknown> | null;
  ordre?: number;
}

/**
 * Nom aligné sur la directive d'exécution ("AttachElementUseCase") — c'est la création d'un
 * CorpusElement, mais "rattachement" reflète mieux le fait qu'il se rattache à la fois à un
 * corpus_versionne ET à un nœud du référentiel hiérarchique (KER-ENG-08).
 */
@Injectable()
export class AttachCorpusElementUseCase {
  constructor(
    @Inject(CORPUS_ELEMENT_REPOSITORY) private readonly elementRepository: CorpusElementRepository,
    @Inject(CORPUS_VERSIONNE_REPOSITORY) private readonly corpusRepository: CorpusVersionneRepository,
    @Inject(NOEUD_HIERARCHIQUE_REPOSITORY) private readonly noeudRepository: NoeudHierarchiqueRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: AttachCorpusElementCommand): Promise<{ id: string }> {
    const corpus = await this.corpusRepository.findById(command.corpusVersionneId);
    if (!corpus) throw new CorpusVersionneNotFoundError();

    const noeud = await this.noeudRepository.findById(command.referentielHierarchiqueId);
    if (!noeud) throw new NoeudHierarchiqueNotFoundError();

    if (command.parentId) {
      const parent = await this.elementRepository.findById(command.parentId);
      if (!parent || parent.corpusVersionneId !== command.corpusVersionneId) {
        throw new CorpusElementParentNotInSameCorpusError();
      }
    }

    const element = CorpusElement.create({
      id: uuidv4(),
      corpusVersionneId: command.corpusVersionneId,
      referentielHierarchiqueId: command.referentielHierarchiqueId,
      parentId: command.parentId,
      nom: command.nom,
      valeurOuCoefficient: command.valeurOuCoefficient,
      metadata: command.metadata,
      ordre: command.ordre,
    });
    await this.elementRepository.save(element);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.CORPUS_ELEMENT_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: { id: element.id, corpusVersionneId: command.corpusVersionneId },
    });

    return { id: element.id };
  }
}

@Injectable()
export class UpdateCorpusElementUseCase {
  constructor(
    @Inject(CORPUS_ELEMENT_REPOSITORY) private readonly elementRepository: CorpusElementRepository,
  ) {}

  async execute(
    id: string,
    updates: Partial<{ nom: string; valeurOuCoefficient: string | null; metadata: Record<string, unknown> | null; ordre: number }>,
  ): Promise<void> {
    const element = await this.get(id);
    element.updateDetails(updates);
    await this.elementRepository.save(element);
  }

  private async get(id: string): Promise<CorpusElement> {
    const element = await this.elementRepository.findById(id);
    if (!element) throw new CorpusElementNotFoundError();
    return element;
  }
}

@Injectable()
export class ReattachCorpusElementUseCase {
  constructor(
    @Inject(CORPUS_ELEMENT_REPOSITORY) private readonly elementRepository: CorpusElementRepository,
  ) {}

  async execute(id: string, nouveauParentId: string | null): Promise<void> {
    const element = await this.get(id);

    if (nouveauParentId) {
      const nouveauParent = await this.elementRepository.findById(nouveauParentId);
      if (!nouveauParent || nouveauParent.corpusVersionneId !== element.corpusVersionneId) {
        throw new CorpusElementParentNotInSameCorpusError();
      }

      const tousLesElements = await this.elementRepository.findByCorpusVersionne(element.corpusVersionneId);
      const elementsPlats = tousLesElements.map((e) => ({ id: e.id, parentId: e.parentId }));
      if (wouldCreateCycleInCorpus(elementsPlats, id, nouveauParentId)) {
        throw new CorpusElementCircularParentError();
      }
    }

    element.reattachToParent(nouveauParentId);
    await this.elementRepository.save(element);
  }

  private async get(id: string): Promise<CorpusElement> {
    const element = await this.elementRepository.findById(id);
    if (!element) throw new CorpusElementNotFoundError();
    return element;
  }
}

@Injectable()
export class QueryCorpusElementsUseCase {
  constructor(
    @Inject(CORPUS_ELEMENT_REPOSITORY) private readonly elementRepository: CorpusElementRepository,
  ) {}

  async getById(id: string): Promise<CorpusElement> {
    const element = await this.elementRepository.findById(id);
    if (!element) throw new CorpusElementNotFoundError();
    return element;
  }

  async listByCorpus(corpusVersionneId: string): Promise<CorpusElement[]> {
    return this.elementRepository.findByCorpusVersionne(corpusVersionneId);
  }

  async listChildren(parentId: string): Promise<CorpusElement[]> {
    return this.elementRepository.findChildren(parentId);
  }
}
