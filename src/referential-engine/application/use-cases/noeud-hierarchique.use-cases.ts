import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  assertNoPublishedChildren,
  NoeudHierarchique,
  wouldCreateCycle,
  CircularReattachmentError,
} from '../../domain/entities/noeud-hierarchique.entity';
import {
  NIVEAU_ADMINISTRATIF_REPOSITORY,
  NiveauAdministratifRepository,
  NOEUD_HIERARCHIQUE_REPOSITORY,
  NoeudHierarchiqueRepository,
  COMPTEUR_VILLES_RATTACHEES_REPOSITORY,
  CompteurVillesRattacheesRepository,
} from '../../domain/repositories/referential-engine.repositories';
import {
  NoeudHierarchiqueNotFoundError,
  UndefinedNiveauForRangError,
  NodeHasAttachedVillesError,
} from '../../domain/exceptions/referential-engine.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_ENGINE_EVENT_TYPES } from '../../domain/events/referential-engine-event-catalog';

export interface CreateNoeudCommand {
  /** Requis uniquement pour un nœud racine (parentId absent) — dérivé du parent sinon. */
  paysId?: string;
  /** Requis uniquement pour un nœud racine — dérivé du parent sinon. */
  codeDomaine?: string;
  parentId: string | null;
  appellationLocale: string;
  ordre?: number;
  estNoeudTerminal?: boolean;
}

export class MissingRootNodeFieldsError extends Error {
  constructor() {
    super('paysId et codeDomaine sont requis pour créer un nœud racine (sans parentId).');
    this.name = 'MissingRootNodeFieldsError';
  }
}

@Injectable()
export class CreateNoeudUseCase {
  constructor(
    @Inject(NOEUD_HIERARCHIQUE_REPOSITORY) private readonly noeudRepository: NoeudHierarchiqueRepository,
    @Inject(NIVEAU_ADMINISTRATIF_REPOSITORY)
    private readonly niveauAdministratifRepository: NiveauAdministratifRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateNoeudCommand): Promise<{ id: string }> {
    const id = uuidv4();
    let noeud: NoeudHierarchique;

    if (command.parentId) {
      const parent = await this.noeudRepository.findById(command.parentId);
      if (!parent) throw new NoeudHierarchiqueNotFoundError();

      await this.assertNiveauDefini(parent.paysId, parent.rangNormalise + 1);

      noeud = NoeudHierarchique.createChild({
        id,
        parent,
        appellationLocale: command.appellationLocale,
        ordre: command.ordre,
        estNoeudTerminal: command.estNoeudTerminal,
      });
    } else {
      if (!command.paysId || !command.codeDomaine) {
        throw new MissingRootNodeFieldsError();
      }

      await this.assertNiveauDefini(command.paysId, 1);

      noeud = NoeudHierarchique.createRoot({
        id,
        paysId: command.paysId,
        codeDomaine: command.codeDomaine,
        appellationLocale: command.appellationLocale,
        ordre: command.ordre,
        estNoeudTerminal: command.estNoeudTerminal,
      });
    }

    await this.noeudRepository.save(noeud);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.ADMINISTRATIVE_HIERARCHY_NODE_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: {
        id: noeud.id,
        paysId: noeud.paysId,
        parentId: noeud.parentId,
        rangNormalise: noeud.rangNormalise,
      },
    });

    return { id: noeud.id };
  }

  /** KER-ADM-01 : un nœud ne peut jamais exister à un rang sans NiveauAdministratif nommé correspondant. */
  private async assertNiveauDefini(paysId: string, rang: number): Promise<void> {
    const niveau = await this.niveauAdministratifRepository.findByPaysAndRang(paysId, rang);
    if (!niveau) {
      throw new UndefinedNiveauForRangError(paysId, rang);
    }
  }
}

@Injectable()
export class UpdateNoeudUseCase {
  constructor(
    @Inject(NOEUD_HIERARCHIQUE_REPOSITORY) private readonly noeudRepository: NoeudHierarchiqueRepository,
  ) {}

  async execute(id: string, updates: Partial<{ appellationLocale: string; ordre: number }>): Promise<void> {
    const noeud = await this.get(id);
    noeud.updateDetails(updates);
    await this.noeudRepository.save(noeud);
  }

  private async get(id: string): Promise<NoeudHierarchique> {
    const noeud = await this.noeudRepository.findById(id);
    if (!noeud) throw new NoeudHierarchiqueNotFoundError();
    return noeud;
  }
}

@Injectable()
export class TransitionNoeudWorkflowUseCase {
  constructor(
    @Inject(NOEUD_HIERARCHIQUE_REPOSITORY) private readonly noeudRepository: NoeudHierarchiqueRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async submitForReview(id: string): Promise<void> {
    const noeud = await this.get(id);
    noeud.submitForReview();
    await this.noeudRepository.save(noeud);
  }

  async validate(id: string): Promise<void> {
    const noeud = await this.get(id);
    noeud.validate();
    await this.noeudRepository.save(noeud);
  }

  async rejectToDraft(id: string): Promise<void> {
    const noeud = await this.get(id);
    noeud.rejectToDraft();
    await this.noeudRepository.save(noeud);
  }

  async publish(id: string): Promise<void> {
    const noeud = await this.get(id);
    noeud.publish();
    await this.noeudRepository.save(noeud);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.ADMINISTRATIVE_NODE_PUBLISHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: { id: noeud.id, paysId: noeud.paysId },
    });
  }

  private async get(id: string): Promise<NoeudHierarchique> {
    const noeud = await this.noeudRepository.findById(id);
    if (!noeud) throw new NoeudHierarchiqueNotFoundError();
    return noeud;
  }
}

@Injectable()
export class ReattachNoeudUseCase {
  constructor(
    @Inject(NOEUD_HIERARCHIQUE_REPOSITORY) private readonly noeudRepository: NoeudHierarchiqueRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
    @Inject(COMPTEUR_VILLES_RATTACHEES_REPOSITORY)
    private readonly compteurVillesRepository: CompteurVillesRattacheesRepository,
  ) {}

  /**
   * KER-ADM-04 : refuse le réattachement si CE nœud a un enfant direct publié et actif —
   * déplacer une branche qui contient du contenu déjà publié serait une rupture silencieuse
   * pour tout consommateur (ex. Ville) qui référence un descendant de cette branche.
   * Le volet "villes rattachées" de cette même règle n'est PAS encore vérifié ici — voir
   * README, section Referential Engine, pour la limite assumée et la solution envisagée
   * (compteur local alimenté par les événements referential.ville.* plutôt qu'un appel
   * synchrone circulaire entre `referential-engine` et `referential`).
   */
  async execute(noeudId: string, nouveauParentId: string | null): Promise<void> {
    const noeud = await this.get(noeudId);

    const enfants = await this.noeudRepository.findChildren(noeudId);
    assertNoPublishedChildren(enfants);

    const nombreVilles = await this.compteurVillesRepository.getCompte(noeudId);
    if (nombreVilles > 0) {
      throw new NodeHasAttachedVillesError();
    }

    let nouveauParent: NoeudHierarchique | null = null;
    if (nouveauParentId) {
      nouveauParent = await this.get(nouveauParentId);

      if (wouldCreateCycle(noeud.chemin, nouveauParent.chemin)) {
        throw new CircularReattachmentError();
      }
    }

    noeud.reattachToParent(nouveauParent);
    await this.noeudRepository.save(noeud);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.BRANCH_REATTACHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: { id: noeud.id, nouveauParentId, nouveauChemin: noeud.chemin },
    });
  }

  private async get(id: string): Promise<NoeudHierarchique> {
    const noeud = await this.noeudRepository.findById(id);
    if (!noeud) throw new NoeudHierarchiqueNotFoundError();
    return noeud;
  }
}

@Injectable()
export class SetNoeudActivationUseCase {
  constructor(
    @Inject(NOEUD_HIERARCHIQUE_REPOSITORY) private readonly noeudRepository: NoeudHierarchiqueRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
    @Inject(COMPTEUR_VILLES_RATTACHEES_REPOSITORY)
    private readonly compteurVillesRepository: CompteurVillesRattacheesRepository,
  ) {}

  /** KER-ADM-04 : mêmes garde-fous que le réattachement — jamais désactiver un nœud dont un enfant est publié OU dont au moins une ville est rattachée. */
  async deactivate(id: string): Promise<void> {
    const noeud = await this.get(id);

    const enfants = await this.noeudRepository.findChildren(id);
    assertNoPublishedChildren(enfants);

    const nombreVilles = await this.compteurVillesRepository.getCompte(id);
    if (nombreVilles > 0) {
      throw new NodeHasAttachedVillesError();
    }

    noeud.deactivate();
    await this.noeudRepository.save(noeud);

    await this.eventPublisher.publish({
      type: REFERENTIAL_ENGINE_EVENT_TYPES.ADMINISTRATIVE_NODE_DEACTIVATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential-engine',
      chargeUtile: { id: noeud.id },
    });
  }

  async reactivate(id: string): Promise<void> {
    const noeud = await this.get(id);
    noeud.reactivate();
    await this.noeudRepository.save(noeud);
  }

  private async get(id: string): Promise<NoeudHierarchique> {
    const noeud = await this.noeudRepository.findById(id);
    if (!noeud) throw new NoeudHierarchiqueNotFoundError();
    return noeud;
  }
}

@Injectable()
export class QueryNoeudsUseCase {
  constructor(
    @Inject(NOEUD_HIERARCHIQUE_REPOSITORY) private readonly noeudRepository: NoeudHierarchiqueRepository,
  ) {}

  async getById(id: string): Promise<NoeudHierarchique> {
    const noeud = await this.noeudRepository.findById(id);
    if (!noeud) throw new NoeudHierarchiqueNotFoundError();
    return noeud;
  }

  async listChildren(parentId: string): Promise<NoeudHierarchique[]> {
    return this.noeudRepository.findChildren(parentId);
  }

  /** Tous les descendants, quelle que soit leur profondeur — une seule requête via le Materialized Path. */
  async listDescendants(noeudId: string): Promise<NoeudHierarchique[]> {
    const noeud = await this.getById(noeudId);
    return this.noeudRepository.findDescendants(noeud.chemin);
  }

  async listByPaysEtDomaine(paysId: string, codeDomaine: string): Promise<NoeudHierarchique[]> {
    return this.noeudRepository.findByPaysAndCodeDomaine(paysId, codeDomaine);
  }
}
