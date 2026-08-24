import { Inject, Injectable } from '@nestjs/common';
import { ReferentialEngineLookupPort } from '../../../common/kernel-ports/referential-engine-lookup.port';
import {
  NOEUD_HIERARCHIQUE_REPOSITORY,
  NoeudHierarchiqueRepository,
} from '../../domain/repositories/referential-engine.repositories';

@Injectable()
export class ReferentialEngineLookupAdapter implements ReferentialEngineLookupPort {
  constructor(
    @Inject(NOEUD_HIERARCHIQUE_REPOSITORY) private readonly noeudRepository: NoeudHierarchiqueRepository,
  ) {}

  async existsAndPublished(noeudId: string): Promise<boolean> {
    const noeud = await this.noeudRepository.findById(noeudId);
    return noeud !== null && noeud.estActif && noeud.statutWorkflow === 'publie';
  }
}
