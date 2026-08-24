import { Inject, Injectable } from '@nestjs/common';
import { ConfigurationGlobale } from '../../domain/entities/configuration-globale.entity';
import {
  CONFIGURATION_GLOBALE_REPOSITORY,
  ConfigurationGlobaleRepository,
} from '../../domain/repositories/configuration-globale.repository';

export interface UpdateConfigurationGlobaleCommand {
  deviseId?: string | null;
  langueId?: string | null;
  fuseauHoraire?: string;
  formatDate?: string;
  formatNombre?: string;
}

@Injectable()
export class UpdateConfigurationGlobaleUseCase {
  constructor(
    @Inject(CONFIGURATION_GLOBALE_REPOSITORY)
    private readonly configurationGlobaleRepository: ConfigurationGlobaleRepository,
  ) {}

  async execute(command: UpdateConfigurationGlobaleCommand): Promise<void> {
    const existante = await this.configurationGlobaleRepository.get();
    const configuration = existante ?? ConfigurationGlobale.create({});
    configuration.update(command);
    await this.configurationGlobaleRepository.save(configuration);
  }
}

@Injectable()
export class GetConfigurationGlobaleUseCase {
  constructor(
    @Inject(CONFIGURATION_GLOBALE_REPOSITORY)
    private readonly configurationGlobaleRepository: ConfigurationGlobaleRepository,
  ) {}

  async execute(): Promise<ConfigurationGlobale> {
    const existante = await this.configurationGlobaleRepository.get();
    return existante ?? ConfigurationGlobale.create({});
  }
}
