import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Email } from '../../../common/value-objects/email.vo';
import { PhoneE164 } from '../../../common/value-objects/phone-e164.vo';
import { User } from '../../domain/entities/user.entity';
import { EmailAlreadyRegisteredError } from '../../domain/exceptions/identity.exceptions';
import { PASSWORD_HASHER, PasswordHasher } from '../../domain/services/password-hasher.interface';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/identity.repositories';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { IDENTITY_EVENT_TYPES } from '../../domain/events/identity-event-catalog';

export interface RegisterUserCommand {
  email: string;
  phone?: string;
  password: string;
  nomAffichage: string;
  paysId?: string;
  uniteAdministrativeId?: string;
  villeId?: string;
  langueId?: string;
  deviseId?: string;
  fuseauHoraire?: string;
}

export interface RegisterUserResult {
  gsgId: string;
}

// OWASP ASVS 2.1.7 — politique de mot de passe minimale (longueur ; la complexité est
// déléguée à des vérifications côté client/UX, la longueur reste le facteur déterminant).
const MIN_PASSWORD_LENGTH = 12;

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    if (command.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
    }

    const email = Email.create(command.email);
    const phone = command.phone ? PhoneE164.create(command.phone) : null;

    const alreadyExists = await this.userRepository.existsByEmail(email);
    if (alreadyExists) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await this.passwordHasher.hash(command.password);
    const gsgId = uuidv4();

    const user = User.register({
      gsgId,
      email,
      phone,
      passwordHash,
      nomAffichage: command.nomAffichage,
      referentiel: {
        paysId: command.paysId ?? null,
        uniteAdministrativeId: command.uniteAdministrativeId ?? null,
        villeId: command.villeId ?? null,
        langueId: command.langueId ?? null,
        deviseId: command.deviseId ?? null,
        fuseauHoraire: command.fuseauHoraire ?? null,
      },
    });

    await this.userRepository.save(user);

    await this.eventPublisher.publish({
      type: IDENTITY_EVENT_TYPES.USER_REGISTERED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-id',
      chargeUtile: { gsgId, email: email.toString() },
    });

    return { gsgId };
  }
}
