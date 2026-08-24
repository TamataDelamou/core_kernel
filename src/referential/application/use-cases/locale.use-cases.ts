import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Locale } from '../../domain/entities/locale-et-traduction.entity';
import { LOCALE_REPOSITORY, LocaleRepository } from '../../domain/repositories/referential.repositories';
import { LocaleCodeAlreadyExistsError, LocaleNotFoundError } from '../../domain/exceptions/referential.exceptions';
import { EVENT_PUBLISHER, EventPublisher } from '../../../common/kernel-ports/event-publisher.interface';
import { REFERENTIAL_EVENT_TYPES } from '../../domain/events/referential-event-catalog';

export interface CreateLocaleCommand {
  code: string;
  libelle: string;
}

@Injectable()
export class CreateLocaleUseCase {
  constructor(
    @Inject(LOCALE_REPOSITORY) private readonly localeRepository: LocaleRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateLocaleCommand): Promise<{ id: string }> {
    const dejaExistante = await this.localeRepository.existsByCode(command.code);
    if (dejaExistante) {
      throw new LocaleCodeAlreadyExistsError(command.code);
    }

    const locale = Locale.create({ id: uuidv4(), ...command });
    await this.localeRepository.save(locale);

    await this.eventPublisher.publish({
      type: REFERENTIAL_EVENT_TYPES.LOCALE_CREATED,
      gsgOrgId: null,
      horodatage: new Date().toISOString(),
      produitSource: 'gsg-referential',
      chargeUtile: { id: locale.id, code: command.code },
    });

    return { id: locale.id };
  }
}

@Injectable()
export class UpdateLocaleUseCase {
  constructor(@Inject(LOCALE_REPOSITORY) private readonly localeRepository: LocaleRepository) {}

  async execute(id: string, updates: Partial<{ libelle: string }>): Promise<void> {
    const locale = await this.get(id);
    locale.updateDetails(updates);
    await this.localeRepository.save(locale);
  }

  private async get(id: string): Promise<Locale> {
    const locale = await this.localeRepository.findById(id);
    if (!locale) throw new LocaleNotFoundError();
    return locale;
  }
}

/**
 * KER-INH-02 : le niveau Global de la chaîne d'héritage a besoin d'UNE SEULE locale par
 * défaut, jamais zéro, jamais deux. `TransactionInterceptor` (déjà posé pour l'atomicité
 * Outbox) garantit que le retrait de l'ancien défaut et la pose du nouveau sont indivisibles
 * — sans cela, une panne exactement entre les deux opérations laisserait le noyau sans aucun
 * défaut. Une contrainte d'unicité partielle en base (`WHERE est_par_defaut = true`) reste le
 * filet de sécurité ultime si ce use-case était un jour contourné par un accès direct.
 */
@Injectable()
export class SetLocaleParDefautUseCase {
  constructor(@Inject(LOCALE_REPOSITORY) private readonly localeRepository: LocaleRepository) {}

  async execute(id: string): Promise<void> {
    const nouvelleLocaleParDefaut = await this.localeRepository.findById(id);
    if (!nouvelleLocaleParDefaut) throw new LocaleNotFoundError();

    const ancienneLocaleParDefaut = await this.localeRepository.findParDefaut();
    if (ancienneLocaleParDefaut && ancienneLocaleParDefaut.id !== id) {
      ancienneLocaleParDefaut.retirerStatutDefaut();
      await this.localeRepository.save(ancienneLocaleParDefaut);
    }

    nouvelleLocaleParDefaut.marquerCommeDefaut();
    await this.localeRepository.save(nouvelleLocaleParDefaut);
  }
}

@Injectable()
export class SetLocaleActivationUseCase {
  constructor(@Inject(LOCALE_REPOSITORY) private readonly localeRepository: LocaleRepository) {}

  async deactivate(id: string): Promise<void> {
    const locale = await this.get(id);
    locale.deactivate();
    await this.localeRepository.save(locale);
  }

  async reactivate(id: string): Promise<void> {
    const locale = await this.get(id);
    locale.reactivate();
    await this.localeRepository.save(locale);
  }

  private async get(id: string): Promise<Locale> {
    const locale = await this.localeRepository.findById(id);
    if (!locale) throw new LocaleNotFoundError();
    return locale;
  }
}

@Injectable()
export class ListLocalesUseCase {
  constructor(@Inject(LOCALE_REPOSITORY) private readonly localeRepository: LocaleRepository) {}

  async execute(params: { includeInactives: boolean }): Promise<Locale[]> {
    return this.localeRepository.list({ activesUniquement: !params.includeInactives });
  }
}
