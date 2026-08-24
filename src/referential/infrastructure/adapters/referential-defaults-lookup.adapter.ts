import { Inject, Injectable } from '@nestjs/common';
import {
  CodesEnrichis,
  PaysDefaults,
  ReferentialDefaultsLookupPort,
} from '../../../common/kernel-ports/referential-defaults-lookup.port';
import {
  DEVISE_REPOSITORY,
  DeviseRepository,
  LANGUE_REPOSITORY,
  LangueRepository,
  LOCALE_REPOSITORY,
  LocaleRepository,
  PAYS_DEVISE_REPOSITORY,
  PAYS_LANGUE_REPOSITORY,
  PAYS_REPOSITORY,
  PaysDeviseRepository,
  PaysLangueRepository,
  PaysRepository,
} from '../../domain/repositories/referential.repositories';

/** Ordre de priorité KER-REF-06 pour choisir la langue "principale" d'un pays à défaut d'un marqueur dédié. */
const PRIORITE_STATUT_LANGUE: Record<string, number> = {
  officielle: 0,
  nationale: 1,
  enseignement_initial: 2,
  vehiculaire: 3,
};

@Injectable()
export class ReferentialDefaultsLookupAdapter implements ReferentialDefaultsLookupPort {
  constructor(
    @Inject(PAYS_REPOSITORY) private readonly paysRepository: PaysRepository,
    @Inject(DEVISE_REPOSITORY) private readonly deviseRepository: DeviseRepository,
    @Inject(LANGUE_REPOSITORY) private readonly langueRepository: LangueRepository,
    @Inject(PAYS_DEVISE_REPOSITORY) private readonly paysDeviseRepository: PaysDeviseRepository,
    @Inject(PAYS_LANGUE_REPOSITORY) private readonly paysLangueRepository: PaysLangueRepository,
    @Inject(LOCALE_REPOSITORY) private readonly localeRepository: LocaleRepository,
  ) {}

  async getPaysDefaults(paysId: string): Promise<PaysDefaults | null> {
    const pays = await this.paysRepository.findById(paysId);
    if (!pays) return null;

    const [deviseParDefaut, languesDuPays] = await Promise.all([
      this.paysDeviseRepository.findPrincipaleActive(paysId, new Date()),
      this.paysLangueRepository.findByPays(paysId),
    ]);

    const langueParDefaut = [...languesDuPays].sort((a, b) => {
      const snapshotA = a.toSnapshot();
      const snapshotB = b.toSnapshot();
      const prioriteA = PRIORITE_STATUT_LANGUE[snapshotA.statut] ?? 99;
      const prioriteB = PRIORITE_STATUT_LANGUE[snapshotB.statut] ?? 99;
      if (prioriteA !== prioriteB) return prioriteA - prioriteB;
      return snapshotA.ordre - snapshotB.ordre;
    })[0];

    const paysSnapshot = pays.toSnapshot();

    return {
      codeIso: pays.codeIso,
      deviseIdPrincipale: deviseParDefaut ? deviseParDefaut.toSnapshot().deviseId : null,
      langueIdPrincipale: langueParDefaut ? langueParDefaut.toSnapshot().langueId : null,
      fuseauHoraire: paysSnapshot.fuseauHoraire,
      adresseGabarit: paysSnapshot.adresseGabarit,
    };
  }

  async enrichCodes(params: {
    paysId: string | null;
    deviseId: string | null;
    langueId: string | null;
  }): Promise<CodesEnrichis> {
    const [pays, devise, langue] = await Promise.all([
      params.paysId ? this.paysRepository.findById(params.paysId) : Promise.resolve(null),
      params.deviseId ? this.deviseRepository.findById(params.deviseId) : Promise.resolve(null),
      params.langueId ? this.langueRepository.findById(params.langueId) : Promise.resolve(null),
    ]);

    return {
      paysCode: pays ? pays.codeIso : null,
      deviseCode: devise ? devise.codeIso4217 : null,
      langueCode: langue ? langue.codeIso639 : null,
    };
  }

  /**
   * KER-NOM-04 : résolution en 3 temps, du plus spécifique au plus général — jamais une
   * dérivation à la volée. Chaque niveau exige que la locale trouvée soit `estActif`, sinon
   * on continue vers le niveau suivant exactement comme la chaîne d'héritage KER-INH-02.
   */
  async resolveLocale(langueCode: string | null, paysCode: string | null): Promise<string | null> {
    if (langueCode && paysCode) {
      const exacte = await this.localeRepository.findByCode(`${langueCode}-${paysCode}`);
      if (exacte && exacte.estActif) return exacte.code;
    }

    if (langueCode) {
      const langueSeule = await this.localeRepository.findByCode(langueCode);
      if (langueSeule && langueSeule.estActif) return langueSeule.code;
    }

    const parDefaut = await this.localeRepository.findParDefaut();
    if (parDefaut && parDefaut.estActif) return parDefaut.code;

    return null;
  }
}
