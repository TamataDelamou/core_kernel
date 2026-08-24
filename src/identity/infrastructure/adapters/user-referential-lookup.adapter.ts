import { Inject, Injectable } from '@nestjs/common';
import { ReferentielNiveau, UserReferentialLookupPort } from '../../../common/kernel-ports/user-referential-lookup.port';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/identity.repositories';

@Injectable()
export class UserReferentialLookupAdapter implements UserReferentialLookupPort {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepository) {}

  async getReferentiel(gsgId: string): Promise<ReferentielNiveau | null> {
    const user = await this.userRepository.findByGsgId(gsgId);
    if (!user) return null;

    const snapshot = user.toSnapshot();
    return {
      paysId: snapshot.referentiel.paysId,
      deviseId: snapshot.referentiel.deviseId,
      langueId: snapshot.referentiel.langueId,
      fuseauHoraire: snapshot.referentiel.fuseauHoraire,
    };
  }
}
