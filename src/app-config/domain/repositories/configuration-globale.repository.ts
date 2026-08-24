import { ConfigurationGlobale } from '../entities/configuration-globale.entity';

export const CONFIGURATION_GLOBALE_REPOSITORY = Symbol('CONFIGURATION_GLOBALE_REPOSITORY');

export interface ConfigurationGlobaleRepository {
  get(): Promise<ConfigurationGlobale | null>;
  save(configuration: ConfigurationGlobale): Promise<void>;
}
