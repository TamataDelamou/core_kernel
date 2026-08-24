import { Inject, Injectable } from '@nestjs/common';
import {
  NiveauReferentielPartiel,
  resolveTousLesChamps,
} from '../../domain/entities/inheritance-resolver';
import { ConfigurationGlobale, DEFAUTS_ABSOLUS } from '../../domain/entities/configuration-globale.entity';
import {
  CONFIGURATION_GLOBALE_REPOSITORY,
  ConfigurationGlobaleRepository,
} from '../../domain/repositories/configuration-globale.repository';
import {
  OrganisationNotFoundOrInactiveError,
  OrganisationNotInUserScopeError,
  UniteOperationnelleNotInOrganisationError,
} from '../../domain/exceptions/app-config.exceptions';
import {
  USER_REFERENTIAL_LOOKUP_PORT,
  UserReferentialLookupPort,
} from '../../../common/kernel-ports/user-referential-lookup.port';
import {
  ORGANISATION_REFERENTIAL_LOOKUP_PORT,
  OrganisationReferentialLookupPort,
} from '../../../common/kernel-ports/organisation-referential-lookup.port';
import {
  REFERENTIAL_DEFAULTS_LOOKUP_PORT,
  ReferentialDefaultsLookupPort,
} from '../../../common/kernel-ports/referential-defaults-lookup.port';
import { ORGANISATION_LOOKUP_PORT, OrganisationLookupPort } from '../../../common/kernel-ports/organisation-lookup.port';

export interface ResolveAppConfigCommand {
  gsgId: string;
  requestingUserGsgOrgIds: string[];
  gsgOrgId: string;
  uniteOperationnelleId?: string;
}

export interface AppConfigResponse {
  paysId: string | null;
  paysCode: string | null;
  deviseId: string | null;
  deviseCode: string | null;
  langueId: string | null;
  langueCode: string | null;
  locale: string | null;
  fuseauHoraire: string;
  formatDate: string;
  formatNombre: string;
  adresseGabarit: string | null;
  fournisseursPaiement: string[];
}

/**
 * KER-CFG-02 : "L'AppConfig est calculé côté serveur, en appliquant la chaîne d'héritage
 * (KER-INH-01), et transmis en un seul appel au démarrage de l'application, jamais
 * reconstruit indépendamment par chaque client." Un seul appel HTTP (voir
 * AppConfigController) orchestrant 4 sources (Utilisateur, Agence, Organisation, Pays) plus
 * le repli Global, jamais 5 requêtes séparées côté client.
 */
@Injectable()
export class ResolveAppConfigUseCase {
  constructor(
    @Inject(USER_REFERENTIAL_LOOKUP_PORT) private readonly userReferentialLookupPort: UserReferentialLookupPort,
    @Inject(ORGANISATION_REFERENTIAL_LOOKUP_PORT)
    private readonly organisationReferentialLookupPort: OrganisationReferentialLookupPort,
    @Inject(REFERENTIAL_DEFAULTS_LOOKUP_PORT)
    private readonly referentialDefaultsLookupPort: ReferentialDefaultsLookupPort,
    @Inject(ORGANISATION_LOOKUP_PORT) private readonly organisationLookupPort: OrganisationLookupPort,
    @Inject(CONFIGURATION_GLOBALE_REPOSITORY)
    private readonly configurationGlobaleRepository: ConfigurationGlobaleRepository,
  ) {}

  async execute(command: ResolveAppConfigCommand): Promise<AppConfigResponse> {
    if (!command.requestingUserGsgOrgIds.includes(command.gsgOrgId)) {
      throw new OrganisationNotInUserScopeError();
    }

    const organisationActive = await this.organisationLookupPort.existsAndActive(command.gsgOrgId);
    if (!organisationActive) {
      throw new OrganisationNotFoundOrInactiveError();
    }

    const [utilisateur, organisation, agence] = await Promise.all([
      this.userReferentialLookupPort.getReferentiel(command.gsgId),
      this.organisationReferentialLookupPort.getOrganisationReferentiel(command.gsgOrgId),
      command.uniteOperationnelleId
        ? this.organisationReferentialLookupPort.getUniteOperationnelleReferentiel(
            command.uniteOperationnelleId,
            command.gsgOrgId,
          )
        : Promise.resolve(null),
    ]);

    if (command.uniteOperationnelleId && !agence) {
      throw new UniteOperationnelleNotInOrganisationError();
    }

    const niveauxAvantPays: NiveauReferentielPartiel[] = [utilisateur ?? {}, agence ?? {}, organisation ?? {}];

    const paysId = utilisateur?.paysId ?? agence?.paysId ?? organisation?.paysId ?? null;

    const paysDefaults = paysId ? await this.referentialDefaultsLookupPort.getPaysDefaults(paysId) : null;
    const niveauPays: NiveauReferentielPartiel = paysDefaults
      ? {
          deviseId: paysDefaults.deviseIdPrincipale,
          langueId: paysDefaults.langueIdPrincipale,
          fuseauHoraire: paysDefaults.fuseauHoraire,
          adresseGabarit: paysDefaults.adresseGabarit,
        }
      : {};

    const configurationGlobale = await this.getOrDefaultConfigurationGlobale();
    const snapshotGlobal = configurationGlobale.toSnapshot();
    const niveauGlobal: NiveauReferentielPartiel = {
      deviseId: snapshotGlobal.deviseId,
      langueId: snapshotGlobal.langueId,
      fuseauHoraire: snapshotGlobal.fuseauHoraire,
      formatDate: snapshotGlobal.formatDate,
      formatNombre: snapshotGlobal.formatNombre,
    };

    const champsResolus = resolveTousLesChamps([...niveauxAvantPays, niveauPays, niveauGlobal]);

    const codes = await this.referentialDefaultsLookupPort.enrichCodes({
      paysId,
      deviseId: champsResolus.deviseId,
      langueId: champsResolus.langueId,
    });

    // KER-NOM-04 : locale CERTIFIÉE (table `locale`, résolution en 3 temps), plus jamais une
    // dérivation `${langueCode}-${paysCode}` construite à la volée sans jamais vérifier
    // qu'une telle locale existe réellement et est active dans le noyau.
    const locale = await this.referentialDefaultsLookupPort.resolveLocale(codes.langueCode, codes.paysCode);

    return {
      paysId,
      paysCode: codes.paysCode,
      deviseId: champsResolus.deviseId,
      deviseCode: codes.deviseCode,
      langueId: champsResolus.langueId,
      langueCode: codes.langueCode,
      locale,
      fuseauHoraire: champsResolus.fuseauHoraire ?? DEFAUTS_ABSOLUS.fuseauHoraire,
      formatDate: champsResolus.formatDate ?? DEFAUTS_ABSOLUS.formatDate,
      formatNombre: champsResolus.formatNombre ?? DEFAUTS_ABSOLUS.formatNombre,
      adresseGabarit: champsResolus.adresseGabarit,
      fournisseursPaiement: [],
    };
  }

  private async getOrDefaultConfigurationGlobale(): Promise<ConfigurationGlobale> {
    const existante = await this.configurationGlobaleRepository.get();
    if (existante) return existante;
    return ConfigurationGlobale.create({});
  }
}
