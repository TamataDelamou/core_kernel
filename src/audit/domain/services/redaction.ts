/**
 * KER-AUD-03 : "Aucune donnée métier sensible (contenu financier, données de santé, données
 * scolaires nominatives) ne doit transiter par le bus d'événements sans finalité explicite et
 * base légale documentée." Les producteurs (identity, referential, org, product) sont déjà
 * censés ne jamais inclure ce type de champ dans leurs charges utiles d'événement — cette
 * fonction est une DÉFENSE EN PROFONDEUR côté ingestion, pas la garantie principale : si un
 * champ au nom sensible apparaît malgré tout, il est rédigé avant persistance durable dans
 * le journal d'audit plutôt que d'y être conservé indéfiniment en clair.
 */
const NOMS_CHAMPS_SENSIBLES = new Set([
  'password',
  'passwordhash',
  'motdepasse',
  'token',
  'refreshtoken',
  'accesstoken',
  'code',
  'secret',
  'hash',
  'otp',
  'cvv',
  'cardnumber',
  'numerocarte',
  'ssn',
  'nir',
]);

const VALEUR_REDACTED = '[REDACTED]';
const PROFONDEUR_MAX = 6; // garde-fou anti-boucle sur une charge utile malformée/circulaire

export function redactSensitiveFields(chargeUtile: Record<string, unknown>): Record<string, unknown> {
  return redactValue(chargeUtile, 0) as Record<string, unknown>;
}

function redactValue(valeur: unknown, profondeur: number): unknown {
  if (profondeur >= PROFONDEUR_MAX) return VALEUR_REDACTED;

  if (Array.isArray(valeur)) {
    return valeur.map((item) => redactValue(item, profondeur + 1));
  }

  if (valeur !== null && typeof valeur === 'object') {
    const resultat: Record<string, unknown> = {};
    for (const [cle, val] of Object.entries(valeur as Record<string, unknown>)) {
      const cleNormalisee = cle.toLowerCase().replace(/[_-]/g, '');
      resultat[cle] = NOMS_CHAMPS_SENSIBLES.has(cleNormalisee)
        ? VALEUR_REDACTED
        : redactValue(val, profondeur + 1);
    }
    return resultat;
  }

  return valeur;
}
