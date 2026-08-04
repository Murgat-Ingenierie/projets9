// Traduction des erreurs de validation Pydantic en français lisible.
//
// FastAPI renvoie en 422 une liste de `[{loc, msg, type, ctx}]` dont `msg` est un
// texte anglais destiné aux développeurs. Tel quel, l'utilisateur lisait
// « body.epic_trigramme : String should have at least 3 characters » — trois
// obstacles d'un coup : le préfixe `body`, le nom de colonne, et l'anglais.
//
// On s'appuie sur `type`, code machine stable de Pydantic v2, plutôt que sur `msg`,
// dont le libellé peut changer d'une version à l'autre. Les types non couverts
// retombent sur le `msg` d'origine : mieux vaut un message anglais qu'un message
// inventé qui décrirait mal la contrainte.

import { FIELD_LABELS } from "../labels";

export interface ErreurPydantic {
  loc?: unknown[];
  msg?: string;
  type?: string;
  ctx?: Record<string, unknown>;
}

/** Intitulé du champ visé, sans le préfixe `body`/`query` ni les index de liste. */
function libelleChamp(loc: unknown[]): string {
  const segments = loc
    .map(String)
    .filter((s) => s !== "body" && s !== "query" && s !== "path" && !/^\d+$/.test(s));
  const dernier = segments[segments.length - 1] ?? "";
  return FIELD_LABELS[dernier] ?? dernier;
}

export function messageValidation(d: ErreurPydantic): string {
  const champ = libelleChamp(d.loc ?? []);
  const prefixe = champ ? `${champ} : ` : "";
  const n = (cle: string): number | null => {
    const v = d.ctx?.[cle];
    return typeof v === "number" ? v : null;
  };

  switch (d.type) {
    case "missing":
      return `${prefixe}champ obligatoire.`;
    case "string_too_short": {
      const min = n("min_length");
      // Une longueur minimale de 1 ne dit rien d'autre que « non vide » : la
      // formuler en nombre de caractères ferait chercher une contrainte qui
      // n'existe pas.
      if (min === null || min <= 1) return `${prefixe}champ obligatoire.`;
      return `${prefixe}au moins ${min} caractères attendus.`;
    }
    case "string_too_long": {
      const max = n("max_length");
      return max === null
        ? `${prefixe}texte trop long.`
        : `${prefixe}${max} caractères au maximum.`;
    }
    case "int_parsing":
    case "int_type":
    case "float_parsing":
    case "decimal_parsing":
      return `${prefixe}valeur numérique attendue.`;
    case "date_parsing":
    case "date_type":
    case "date_from_datetime_parsing":
      return `${prefixe}date invalide.`;
    case "greater_than":
      return `${prefixe}doit être supérieur à ${d.ctx?.gt}.`;
    case "greater_than_equal":
      return `${prefixe}doit valoir au moins ${d.ctx?.ge}.`;
    case "less_than":
      return `${prefixe}doit être inférieur à ${d.ctx?.lt}.`;
    case "less_than_equal":
      return `${prefixe}doit valoir au plus ${d.ctx?.le}.`;
    case "enum":
    case "literal_error":
      return `${prefixe}valeur non autorisée.`;
    case "string_pattern_mismatch":
      return `${prefixe}format incorrect.`;
    case "value_error":
      // Message d'un validateur métier : Pydantic le préfixe de « Value error, ».
      return `${prefixe}${(d.msg ?? "").replace(/^Value error,\s*/, "")}`;
    default:
      return `${prefixe}${d.msg ?? "valeur invalide"}`;
  }
}

/** Assemble les erreurs d'une réponse 422 en un seul message. */
export function messageValidations(details: ErreurPydantic[]): string {
  return details.map(messageValidation).join(" ; ");
}
