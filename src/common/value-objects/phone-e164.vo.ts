import { parsePhoneNumberWithError, ParseError } from 'libphonenumber-js';

export class InvalidPhoneNumberError extends Error {
  constructor(rawValue: string, reason?: string) {
    super(
      `Numéro de téléphone invalide au format E.164 (KER-ID-06) : "${rawValue}"${
        reason ? ` — ${reason}` : ''
      }`,
    );
    this.name = 'InvalidPhoneNumberError';
  }
}

/**
 * Value Object représentant un numéro de téléphone strictement conforme au format
 * international E.164 (indicatif + numéro, ex. +224620000000), condition posée par
 * KER-ID-06 pour la fiabilité des flux d'authentification par OTP dans tout l'écosystème GSG.
 */
export class PhoneE164 {
  private readonly value: string;
  private readonly countryCallingCode: string;

  private constructor(value: string, countryCallingCode: string) {
    this.value = value;
    this.countryCallingCode = countryCallingCode;
  }

  static create(rawValue: string): PhoneE164 {
    const trimmed = rawValue.trim();

    if (!trimmed.startsWith('+')) {
      throw new InvalidPhoneNumberError(
        rawValue,
        "l'indicatif international (préfixé par '+') est obligatoire",
      );
    }

    try {
      const parsed = parsePhoneNumberWithError(trimmed);

      if (!parsed.isValid()) {
        throw new InvalidPhoneNumberError(rawValue);
      }

      return new PhoneE164(parsed.number, parsed.countryCallingCode);
    } catch (error) {
      if (error instanceof ParseError) {
        throw new InvalidPhoneNumberError(rawValue, error.message);
      }
      throw new InvalidPhoneNumberError(rawValue);
    }
  }

  toString(): string {
    return this.value;
  }

  getCountryCallingCode(): string {
    return this.countryCallingCode;
  }

  equals(other: PhoneE164): boolean {
    return this.value === other.value;
  }
}
