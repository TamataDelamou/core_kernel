import { NiveauAdministratif } from '../entities/niveau-administratif.entity';
import { NoeudHierarchique } from '../entities/noeud-hierarchique.entity';
import { ReferentielRegle } from '../entities/referentiel-regle.entity';
import { CorpusVersionne } from '../entities/corpus-versionne.entity';
import { CorpusElement } from '../entities/corpus-element.entity';

export const NIVEAU_ADMINISTRATIF_REPOSITORY = Symbol('NIVEAU_ADMINISTRATIF_REPOSITORY');

export interface NiveauAdministratifRepository {
  findById(id: string): Promise<NiveauAdministratif | null>;
  findByPaysAndRang(paysId: string, rang: number): Promise<NiveauAdministratif | null>;
  findByPays(paysId: string): Promise<NiveauAdministratif[]>;
  save(niveau: NiveauAdministratif): Promise<void>;
}

export const NOEUD_HIERARCHIQUE_REPOSITORY = Symbol('NOEUD_HIERARCHIQUE_REPOSITORY');

export interface NoeudHierarchiqueRepository {
  findById(id: string): Promise<NoeudHierarchique | null>;
  /** Enfants directs (parent_id = id) — utilisé pour le garde-fou KER-ADM-04. */
  findChildren(parentId: string): Promise<NoeudHierarchique[]>;
  /**
   * Tous les descendants (pas seulement les enfants directs), via le Materialized Path —
   * une seule requête `chemin LIKE :chemin || '%'`, sans CTE récursive.
   */
  findDescendants(chemin: string): Promise<NoeudHierarchique[]>;
  findByPaysAndCodeDomaine(paysId: string, codeDomaine: string): Promise<NoeudHierarchique[]>;
  save(noeud: NoeudHierarchique): Promise<void>;
}

export const REFERENTIEL_REGLE_REPOSITORY = Symbol('REFERENTIEL_REGLE_REPOSITORY');

export interface ReferentielRegleRepository {
  findById(id: string): Promise<ReferentielRegle | null>;
  findByNoeud(referentielHierarchiqueId: string): Promise<ReferentielRegle[]>;
  /** Uniquement les règles publiées, actives, et jamais A_VERIFIER — c'est CE filtre que RegleLookupAdapter délègue ici. */
  findPublieesEtVerifieesByNoeud(referentielHierarchiqueId: string): Promise<ReferentielRegle[]>;
  save(regle: ReferentielRegle): Promise<void>;
}

export const CORPUS_VERSIONNE_REPOSITORY = Symbol('CORPUS_VERSIONNE_REPOSITORY');

export interface CorpusVersionneRepository {
  findById(id: string): Promise<CorpusVersionne | null>;
  findByPaysAndCodeDomaine(paysId: string, codeDomaine: string): Promise<CorpusVersionne[]>;
  /** Le corpus publié le plus récent pour ce pays/domaine — au plus un résultat pertinent pour un consommateur. */
  findPublieByPaysAndCodeDomaine(paysId: string, codeDomaine: string): Promise<CorpusVersionne | null>;
  save(corpus: CorpusVersionne): Promise<void>;
}

export const CORPUS_ELEMENT_REPOSITORY = Symbol('CORPUS_ELEMENT_REPOSITORY');

export interface CorpusElementRepository {
  findById(id: string): Promise<CorpusElement | null>;
  findByCorpusVersionne(corpusVersionneId: string): Promise<CorpusElement[]>;
  findChildren(parentId: string): Promise<CorpusElement[]>;
  save(element: CorpusElement): Promise<void>;
}

export const COMPTEUR_VILLES_RATTACHEES_REPOSITORY = Symbol('COMPTEUR_VILLES_RATTACHEES_REPOSITORY');

/**
 * KER-ADM-04, volet "villes rattachées" : table d'indexation locale, alimentée de façon
 * eventually-consistent par VilleRattacheeConsumerService (écoute referential.ville.created
 * et referential.ville.moved). Jamais une source de vérité — une vraie décompte physique des
 * villes reste dans `referential`, cette table n'existe QUE pour permettre un garde-fou
 * rapide sans jamais interroger `referential` de façon synchrone (KER-VIS-03).
 */
export interface CompteurVillesRattacheesRepository {
  getCompte(noeudId: string): Promise<number>;
  incrementer(noeudId: string): Promise<void>;
  /** Ne fait rien si le compteur est déjà à zéro (jamais négatif — dérive tolérée, pas un crash). */
  decrementer(noeudId: string): Promise<void>;
}
