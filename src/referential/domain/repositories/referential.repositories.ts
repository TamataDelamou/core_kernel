import { Pays } from '../entities/pays.entity';
import { Devise, Langue } from '../entities/devise-et-langue.entity';
import { BlocRegional } from '../entities/bloc-regional.entity';
import {
  PaysBlocRegional,
  PaysDevise,
  PaysLangue,
  TauxChange,
} from '../entities/relations.entity';
import { Ville } from '../entities/ville.entity';
import { Locale, Traduction } from '../entities/locale-et-traduction.entity';

export const PAYS_REPOSITORY = Symbol('PAYS_REPOSITORY');
export interface PaysRepository {
  findById(id: string): Promise<Pays | null>;
  findByCodeIso(codeIso: string): Promise<Pays | null>;
  existsByCodeIso(codeIso: string): Promise<boolean>;
  list(params: { publieUniquement: boolean }): Promise<Pays[]>;
  save(pays: Pays): Promise<void>;
}

export const DEVISE_REPOSITORY = Symbol('DEVISE_REPOSITORY');
export interface DeviseRepository {
  findById(id: string): Promise<Devise | null>;
  findByCodeIso4217(codeIso4217: string): Promise<Devise | null>;
  existsByCodeIso4217(codeIso4217: string): Promise<boolean>;
  list(params: { publieUniquement: boolean }): Promise<Devise[]>;
  save(devise: Devise): Promise<void>;
}

export const LANGUE_REPOSITORY = Symbol('LANGUE_REPOSITORY');
export interface LangueRepository {
  findById(id: string): Promise<Langue | null>;
  findByCodeIso639(codeIso639: string): Promise<Langue | null>;
  existsByCodeIso639(codeIso639: string): Promise<boolean>;
  list(params: { publieUniquement: boolean }): Promise<Langue[]>;
  save(langue: Langue): Promise<void>;
}

export const BLOC_REGIONAL_REPOSITORY = Symbol('BLOC_REGIONAL_REPOSITORY');
export interface BlocRegionalRepository {
  findById(id: string): Promise<BlocRegional | null>;
  findByCode(code: string): Promise<BlocRegional | null>;
  existsByCode(code: string): Promise<boolean>;
  list(params: { publieUniquement: boolean }): Promise<BlocRegional[]>;
  save(blocRegional: BlocRegional): Promise<void>;
}

export const PAYS_DEVISE_REPOSITORY = Symbol('PAYS_DEVISE_REPOSITORY');
export interface PaysDeviseRepository {
  findById(id: string): Promise<PaysDevise | null>;
  findByPays(paysId: string): Promise<PaysDevise[]>;
  findPrincipaleActive(paysId: string, atDate: Date): Promise<PaysDevise | null>;
  save(relation: PaysDevise): Promise<void>;
}

export const PAYS_LANGUE_REPOSITORY = Symbol('PAYS_LANGUE_REPOSITORY');
export interface PaysLangueRepository {
  findByPays(paysId: string): Promise<PaysLangue[]>;
  save(relation: PaysLangue): Promise<void>;
}

export const PAYS_BLOC_REGIONAL_REPOSITORY = Symbol('PAYS_BLOC_REGIONAL_REPOSITORY');
export interface PaysBlocRegionalRepository {
  findById(id: string): Promise<PaysBlocRegional | null>;
  findByPays(paysId: string): Promise<PaysBlocRegional[]>;
  findByBlocRegional(blocRegionalId: string): Promise<PaysBlocRegional[]>;
  save(relation: PaysBlocRegional): Promise<void>;
}

export const TAUX_CHANGE_REPOSITORY = Symbol('TAUX_CHANGE_REPOSITORY');
export interface TauxChangeRepository {
  findById(id: string): Promise<TauxChange | null>;
  /** Renvoie tous les taux enregistrés pour une paire de devises, triés du plus récent au plus ancien. */
  findByPaire(deviseBaseId: string, deviseCibleId: string): Promise<TauxChange[]>;
  save(tauxChange: TauxChange): Promise<void>;
}

export const VILLE_REPOSITORY = Symbol('VILLE_REPOSITORY');
export interface VilleRepository {
  findById(id: string): Promise<Ville | null>;
  findByPays(paysId: string): Promise<Ville[]>;
  save(ville: Ville): Promise<void>;
}

export const LOCALE_REPOSITORY = Symbol('LOCALE_REPOSITORY');
export interface LocaleRepository {
  findById(id: string): Promise<Locale | null>;
  findByCode(code: string): Promise<Locale | null>;
  findParDefaut(): Promise<Locale | null>;
  existsByCode(code: string): Promise<boolean>;
  list(params: { activesUniquement: boolean }): Promise<Locale[]>;
  save(locale: Locale): Promise<void>;
}

export const TRADUCTION_REPOSITORY = Symbol('TRADUCTION_REPOSITORY');
export interface TraductionRepository {
  findById(id: string): Promise<Traduction | null>;
  findByLocaleAndCle(localeId: string, cle: string): Promise<Traduction | null>;
  findByLocale(localeId: string): Promise<Traduction[]>;
  save(traduction: Traduction): Promise<void>;
}
