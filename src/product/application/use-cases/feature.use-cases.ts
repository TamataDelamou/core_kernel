import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Feature, OffreEntitlement } from '../../domain/entities/feature.entity';
import {
  FEATURE_REPOSITORY,
  FeatureRepository,
  OFFRE_ENTITLEMENT_REPOSITORY,
  OFFRE_REPOSITORY,
  OffreEntitlementRepository,
  OffreRepository,
} from '../../domain/repositories/product.repositories';
import {
  EntitlementAlreadyExistsError,
  FeatureCodeAlreadyExistsError,
  FeatureNotFoundError,
  OffreNotFoundError,
} from '../../domain/exceptions/product.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { PRODUCT_EVENT_TYPES } from '../../domain/events/product-event-catalog';

@Injectable()
export class CreateFeatureUseCase {
  constructor(
    @Inject(FEATURE_REPOSITORY) private readonly featureRepository: FeatureRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: { code: string; nom: string; description?: string }): Promise<{ id: string }> {
    const codeNormalise = command.code.trim().toLowerCase();
    const existante = await this.featureRepository.findByCode(codeNormalise);
    if (existante) {
      throw new FeatureCodeAlreadyExistsError(codeNormalise);
    }

    const feature = Feature.create({ id: uuidv4(), ...command, code: codeNormalise });
    await this.featureRepository.save(feature);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.FEATURE_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: feature.id, code: codeNormalise },
    });

    return { id: feature.id };
  }
}

@Injectable()
export class ListFeaturesUseCase {
  constructor(@Inject(FEATURE_REPOSITORY) private readonly featureRepository: FeatureRepository) {}

  async execute(params: { includeInactives: boolean }): Promise<Feature[]> {
    return this.featureRepository.list({ activesUniquement: !params.includeInactives });
  }
}

@Injectable()
export class AttachEntitlementToOffreUseCase {
  constructor(
    @Inject(OFFRE_REPOSITORY) private readonly offreRepository: OffreRepository,
    @Inject(FEATURE_REPOSITORY) private readonly featureRepository: FeatureRepository,
    @Inject(OFFRE_ENTITLEMENT_REPOSITORY)
    private readonly offreEntitlementRepository: OffreEntitlementRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(params: {
    offreId: string;
    featureId: string;
    limite: number | null;
    unite?: string | null;
  }): Promise<{ id: string }> {
    const offre = await this.offreRepository.findById(params.offreId);
    if (!offre) throw new OffreNotFoundError();

    const feature = await this.featureRepository.findById(params.featureId);
    if (!feature) throw new FeatureNotFoundError();

    const existant = await this.offreEntitlementRepository.findByOffreAndFeature(
      params.offreId,
      params.featureId,
    );
    if (existant) {
      throw new EntitlementAlreadyExistsError();
    }

    const entitlement = OffreEntitlement.create({
      id: uuidv4(),
      offreId: params.offreId,
      featureId: params.featureId,
      limite: params.limite,
      unite: params.unite ?? null,
    });
    await this.offreEntitlementRepository.save(entitlement);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.ENTITLEMENT_ATTACHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { offreId: params.offreId, featureId: params.featureId, limite: params.limite },
    });

    return { id: entitlement.id };
  }
}

@Injectable()
export class ListEntitlementsByOffreUseCase {
  constructor(
    @Inject(OFFRE_ENTITLEMENT_REPOSITORY)
    private readonly offreEntitlementRepository: OffreEntitlementRepository,
  ) {}

  async execute(offreId: string): Promise<OffreEntitlement[]> {
    return this.offreEntitlementRepository.findByOffre(offreId);
  }
}
