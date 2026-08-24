import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Ville } from '../../domain/entities/ville.entity';
import {
  PAYS_REPOSITORY,
  PaysRepository,
  VILLE_REPOSITORY,
  VilleRepository,
} from '../../domain/repositories/referential.repositories';
import {
  PaysNotFoundError,
  VilleNotFoundError,
  UnpublishedHierarchicalNodeError,
} from '../../domain/exceptions/referential.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import {
  REFERENTIAL_ENGINE_LOOKUP_PORT,
  ReferentialEngineLookupPort,
} from '../../../common/kernel-ports/referential-engine-lookup.port';
import { REFERENTIAL_EVENT_TYPES } from '../../domain/events/referential-event-catalog';

@Injectable()
export class CreateVilleUseCase {
  constructor(
    @Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository,
    @Inject(VILLE_REPOSITORY) private readonly villeRepository: VilleRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
    @Inject(REFERENTIAL_ENGINE_LOOKUP_PORT)
    private readonly referentialEngineLookupPort: ReferentialEngineLookupPort,
  ) {}

  async execute(params: {
    paysId: string;
    nom: string;
    referentielHierarchiqueId?: string | null;
  }): Promise<{ id: string }> {
    const pays = await this.paysRepository.findById(params.paysId);
    if (!pays) throw new PaysNotFoundError();

    // KER-ADM-03 : un referentiel_hierarchique_id fourni doit référencer un nœud du
    // Referential Engine réellement existant ET publié — jamais un UUID non vérifié.
    // Vérification exclusivement via le port, jamais d'accès direct au schéma du moteur
    // (KER-VIS-03) ; aucune clé étrangère physique ne lie `ville` à `noeud_hierarchique`.
    if (params.referentielHierarchiqueId) {
      const valide = await this.referentialEngineLookupPort.existsAndPublished(
        params.referentielHierarchiqueId,
      );
      if (!valide) {
        throw new UnpublishedHierarchicalNodeError(params.referentielHierarchiqueId);
      }
    }

    const ville = Ville.create({ id: uuidv4(), ...params });
    await this.villeRepository.save(ville);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.VILLE_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: {
        id: ville.id,
        paysId: params.paysId,
        nom: params.nom,
        referentielHierarchiqueId: params.referentielHierarchiqueId ?? null,
      },
    });

    return { id: ville.id };
  }
}

/**
 * KER-ADM-04 (garde-fou villes rattachées) : publie `VILLE_MOVED` avec l'ANCIEN et le
 * NOUVEAU nœud, condition nécessaire pour que le consommateur de referential-engine
 * décrémente le compteur de l'ancien nœud et incrémente celui du nouveau — sans cet
 * événement, le compteur local dériverait silencieusement à chaque déplacement de ville.
 */
@Injectable()
export class MoveVilleUseCase {
  constructor(
    @Inject(VILLE_REPOSITORY) private readonly villeRepository: VilleRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
    @Inject(REFERENTIAL_ENGINE_LOOKUP_PORT)
    private readonly referentialEngineLookupPort: ReferentialEngineLookupPort,
  ) {}

  async execute(villeId: string, nouveauReferentielHierarchiqueId: string | null): Promise<void> {
    const ville = await this.villeRepository.findById(villeId);
    if (!ville) throw new VilleNotFoundError();

    if (nouveauReferentielHierarchiqueId) {
      const valide = await this.referentialEngineLookupPort.existsAndPublished(nouveauReferentielHierarchiqueId);
      if (!valide) {
        throw new UnpublishedHierarchicalNodeError(nouveauReferentielHierarchiqueId);
      }
    }

    const ancienReferentielHierarchiqueId = ville.toSnapshot().referentielHierarchiqueId;
    ville.updateDetails({ referentielHierarchiqueId: nouveauReferentielHierarchiqueId });
    await this.villeRepository.save(ville);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.VILLE_MOVED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: {
        id: ville.id,
        ancienReferentielHierarchiqueId,
        nouveauReferentielHierarchiqueId,
      },
    });
  }
}

@Injectable()
export class ListVillesByPaysUseCase {
  constructor(@Inject(VILLE_REPOSITORY) private readonly villeRepository: VilleRepository) {}

  async execute(paysId: string): Promise<Ville[]> {
    return this.villeRepository.findByPays(paysId);
  }
}

@Injectable()
export class SetVilleActivationUseCase {
  constructor(@Inject(VILLE_REPOSITORY) private readonly villeRepository: VilleRepository) {}

  async deactivate(id: string): Promise<void> {
    const ville = await this.villeRepository.findById(id);
    if (!ville) throw new VilleNotFoundError();
    ville.deactivate();
    await this.villeRepository.save(ville);
  }

  async reactivate(id: string): Promise<void> {
    const ville = await this.villeRepository.findById(id);
    if (!ville) throw new VilleNotFoundError();
    ville.reactivate();
    await this.villeRepository.save(ville);
  }
}
