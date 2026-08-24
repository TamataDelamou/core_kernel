import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  assertNoOverlapWithExisting,
  GrilleTarifaire,
} from '../../domain/entities/grille-tarifaire.entity';
import {
  GRILLE_TARIFAIRE_REPOSITORY,
  GrilleTarifaireRepository,
  OFFRE_REPOSITORY,
  OffreRepository,
} from '../../domain/repositories/product.repositories';
import {
  GrilleTarifaireNotFoundError,
  OffreNotFoundError,
  UncertifiedCurrencyError,
} from '../../domain/exceptions/product.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import {
  CURRENCY_VALIDATION_PORT,
  CurrencyValidationPort,
} from '../../../common/kernel-ports/currency-validation.port';
import { PRODUCT_EVENT_TYPES } from '../../domain/events/product-event-catalog';

export interface CreateGrilleTarifaireCommand {
  offreId: string;
  deviseId: string;
  montantMinorUnit: number;
  periodeFacturation: string;
  dateEffective: Date;
  dateFin?: Date | null;
}

@Injectable()
export class CreateGrilleTarifaireUseCase {
  constructor(
    @Inject(OFFRE_REPOSITORY) private readonly offreRepository: OffreRepository,
    @Inject(GRILLE_TARIFAIRE_REPOSITORY)
    private readonly grilleTarifaireRepository: GrilleTarifaireRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
    @Inject(CURRENCY_VALIDATION_PORT) private readonly currencyValidationPort: CurrencyValidationPort,
  ) {}

  /**
   * KER-PRD : interdiction absolue d'appliquer un prix dans une devise non certifiée. La
   * vérification transite exclusivement par `CurrencyValidationPort` (common/kernel-ports) —
   * ce use-case ne consulte jamais directement le schéma de persistance de GSG Referential.
   */
  async execute(command: CreateGrilleTarifaireCommand): Promise<{ id: string }> {
    const offre = await this.offreRepository.findById(command.offreId);
    if (!offre) throw new OffreNotFoundError();

    const deviseCertifiee = await this.currencyValidationPort.isCertified(command.deviseId);
    if (!deviseCertifiee) {
      throw new UncertifiedCurrencyError(command.deviseId);
    }

    const derniereVersion = await this.grilleTarifaireRepository.findLatestVersion(command.offreId);
    const prochaineVersion = derniereVersion ? derniereVersion.version + 1 : 1;

    const grille = GrilleTarifaire.create({
      id: uuidv4(),
      offreId: command.offreId,
      version: prochaineVersion,
      deviseId: command.deviseId,
      montantMinorUnit: command.montantMinorUnit,
      periodeFacturation: command.periodeFacturation,
      dateEffective: command.dateEffective,
      dateFin: command.dateFin ?? null,
    });

    // Le chevauchement n'est vérifié qu'entre grilles déjà PUBLIÉES (voir docstring de
    // assertNoOverlapWithExisting) : une nouvelle grille en brouillon peut toujours être
    // créée en parallèle d'une grille publiée, tant qu'elle n'est pas elle-même publiée
    // sur une fenêtre conflictuelle — le contrôle définitif a lieu à la publication
    // (voir PublishGrilleTarifaireUseCase ci-dessous), pas seulement à la création.
    const grillesPubliees = await this.grilleTarifaireRepository.findPublieesByOffreEtDevise(
      command.offreId,
      command.deviseId,
    );
    assertNoOverlapWithExisting(grille, grillesPubliees);

    await this.grilleTarifaireRepository.save(grille);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.PRICING_GRID_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: {
        id: grille.id,
        offreId: command.offreId,
        deviseId: command.deviseId,
        version: prochaineVersion,
      },
    });

    return { id: grille.id };
  }
}

@Injectable()
export class TransitionGrilleTarifaireWorkflowUseCase {
  constructor(
    @Inject(GRILLE_TARIFAIRE_REPOSITORY)
    private readonly grilleTarifaireRepository: GrilleTarifaireRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async validate(id: string): Promise<void> {
    const grille = await this.get(id);
    grille.validate();
    await this.grilleTarifaireRepository.save(grille);
  }

  async rejectToDraft(id: string): Promise<void> {
    const grille = await this.get(id);
    grille.rejectToDraft();
    await this.grilleTarifaireRepository.save(grille);
  }

  /**
   * KER-PRD : re-vérifie l'absence de chevauchement AU MOMENT DE LA PUBLICATION — c'est cet
   * instant qui rend le prix réellement applicable. Deux grilles peuvent coexister en statut
   * "valide" sur des fenêtres qui se chevauchent tant qu'aucune des deux n'est publiée ;
   * la publication de la seconde, si un chevauchement subsiste avec une grille déjà publiée
   * entre-temps, est refusée.
   */
  async publish(id: string): Promise<void> {
    const grille = await this.get(id);

    const grillesPubliees = await this.grilleTarifaireRepository.findPublieesByOffreEtDevise(
      grille.offreId,
      grille.deviseId,
    );
    assertNoOverlapWithExisting(grille, grillesPubliees);

    grille.publish();
    await this.grilleTarifaireRepository.save(grille);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.PRICING_GRID_PUBLISHED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: grille.id, offreId: grille.offreId, deviseId: grille.deviseId },
    });
  }

  async archive(id: string): Promise<void> {
    const grille = await this.get(id);
    grille.archive();
    await this.grilleTarifaireRepository.save(grille);

    await this.eventPublisher.publish({
      type: PRODUCT_EVENT_TYPES.PRICING_GRID_ARCHIVED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-product-catalog',
      chargeUtile: { id: grille.id },
    });
  }

  private async get(id: string): Promise<GrilleTarifaire> {
    const grille = await this.grilleTarifaireRepository.findById(id);
    if (!grille) throw new GrilleTarifaireNotFoundError();
    return grille;
  }
}

export interface ResolveActivePriceResult {
  grilleId: string;
  version: number;
  montantMinorUnit: number;
  deviseId: string;
}

@Injectable()
export class ResolveActivePriceUseCase {
  constructor(
    @Inject(GRILLE_TARIFAIRE_REPOSITORY)
    private readonly grilleTarifaireRepository: GrilleTarifaireRepository,
  ) {}

  /**
   * Résout le prix applicable pour une offre, dans une devise donnée, à un instant donné.
   * Ne renvoie jamais de valeur par défaut : l'absence de grille publiée et effective à cet
   * instant est une erreur explicite, symétrique de KER-REF-04 (refus plutôt que parité
   * implicite) appliqué ici au domaine tarifaire plutôt qu'au taux de change.
   */
  async execute(params: {
    offreId: string;
    deviseId: string;
    instant?: Date;
  }): Promise<ResolveActivePriceResult> {
    const instant = params.instant ?? new Date();
    const grillesPubliees = await this.grilleTarifaireRepository.findPublieesByOffreEtDevise(
      params.offreId,
      params.deviseId,
    );

    const active = grillesPubliees.find((grille) => grille.isEffectiveAt(instant));
    if (!active) {
      throw new GrilleTarifaireNotFoundError();
    }

    return {
      grilleId: active.id,
      version: active.version,
      montantMinorUnit: active.montantMinorUnit,
      deviseId: active.deviseId,
    };
  }
}
