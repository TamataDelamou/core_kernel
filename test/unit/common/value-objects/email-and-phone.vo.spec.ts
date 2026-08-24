import { Email, InvalidEmailError } from '../../../../src/common/value-objects/email.vo';
import { PhoneE164, InvalidPhoneNumberError } from '../../../../src/common/value-objects/phone-e164.vo';

describe('Email (Value Object commun)', () => {
  it('normalise en minuscules et retire les espaces superflus', () => {
    const email = Email.create('  Test.User@Example.COM  ');
    expect(email.toString()).toBe('test.user@example.com');
  });

  it('refuse une chaîne vide', () => {
    expect(() => Email.create('   ')).toThrow(InvalidEmailError);
  });

  it('refuse une adresse sans @', () => {
    expect(() => Email.create('pas-un-email')).toThrow(InvalidEmailError);
  });

  it('refuse une adresse sans domaine', () => {
    expect(() => Email.create('user@')).toThrow(InvalidEmailError);
  });

  it('refuse une adresse dépassant 254 caractères', () => {
    const tropLongue = `${'a'.repeat(250)}@example.com`;
    expect(() => Email.create(tropLongue)).toThrow(InvalidEmailError);
  });

  it('deux emails équivalents après normalisation sont égaux', () => {
    const a = Email.create('User@Example.com');
    const b = Email.create('user@example.com');
    expect(a.equals(b)).toBe(true);
  });
});

describe('PhoneE164 (Value Object commun) — KER-ID-06', () => {
  it('accepte un numéro guinéen valide au format E.164', () => {
    expect(() => PhoneE164.create('+224620000000')).not.toThrow();
  });

  it('refuse un numéro sans indicatif international (pas de préfixe +)', () => {
    expect(() => PhoneE164.create('620000000')).toThrow(InvalidPhoneNumberError);
  });

  it('refuse un numéro manifestement invalide même préfixé par +', () => {
    expect(() => PhoneE164.create('+000000000')).toThrow(InvalidPhoneNumberError);
  });

  it('expose l\'indicatif pays extrait du numéro', () => {
    const phone = PhoneE164.create('+224620000000');
    expect(phone.getCountryCallingCode()).toBe('224');
  });

  it('deux numéros identiques après normalisation sont égaux', () => {
    const a = PhoneE164.create('+224 620 00 00 00');
    const b = PhoneE164.create('+224620000000');
    expect(a.equals(b)).toBe(true);
  });
});
