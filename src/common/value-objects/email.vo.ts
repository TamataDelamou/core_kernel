const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export class InvalidEmailError extends Error {
  constructor(rawValue: string) {
    super(`Adresse e-mail invalide : "${rawValue}"`);
    this.name = 'InvalidEmailError';
  }
}

/**
 * Value Object représentant une adresse e-mail normalisée.
 * Toute comparaison ou persistance d'un e-mail dans GSG ID doit transiter par ce type,
 * jamais par une chaîne brute non validée (défense en profondeur — OWASP ASVS 5.1).
 */
export class Email {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(rawValue: string): Email {
    const trimmed = rawValue.trim().toLowerCase();

    if (trimmed.length === 0 || trimmed.length > 254) {
      throw new InvalidEmailError(rawValue);
    }

    if (!EMAIL_REGEX.test(trimmed)) {
      throw new InvalidEmailError(rawValue);
    }

    return new Email(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
