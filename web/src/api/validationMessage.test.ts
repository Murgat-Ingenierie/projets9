import { describe, it, expect } from "vitest";
import { messageValidation, messageValidations } from "./validationMessage";

describe("messageValidation", () => {
  // Le cas réellement rencontré : créer un projet sans epic renvoyait
  // « body.epic_trigramme : String should have at least 3 characters ».
  it("traduit le refus qui a motivé ce module", () => {
    expect(
      messageValidation({
        loc: ["body", "epic_trigramme"],
        msg: "String should have at least 3 characters",
        type: "string_too_short",
        ctx: { min_length: 3 },
      })
    ).toBe("Epic : au moins 3 caractères attendus.");
  });

  it("min_length 1 se dit « obligatoire », pas « au moins 1 caractère »", () => {
    expect(
      messageValidation({ loc: ["body", "nom"], type: "string_too_short", ctx: { min_length: 1 } })
    ).toBe("Nom : champ obligatoire.");
  });

  it.each([
    [{ loc: ["body", "date_fin"], type: "missing" }, "Date de fin : champ obligatoire."],
    [{ loc: ["body", "responsable_id"], type: "int_parsing" }, "Responsable : valeur numérique attendue."],
    [{ loc: ["body", "date_debut"], type: "date_parsing" }, "Date de début : date invalide."],
    [{ loc: ["body", "statut"], type: "enum" }, "Statut : valeur non autorisée."],
    [{ loc: ["body", "heures"], type: "greater_than_equal", ctx: { ge: 0 } }, "Heures : doit valoir au moins 0."],
  ])("traduit %o", (entree, attendu) => {
    expect(messageValidation(entree)).toBe(attendu);
  });

  it("un validateur métier passe son propre message, sans le préfixe de Pydantic", () => {
    expect(
      messageValidation({ loc: ["body", "nom"], type: "value_error", msg: "Value error, déjà pris" })
    ).toBe("Nom : déjà pris");
  });

  // Inventer une traduction décrirait mal la contrainte : le message d'origine
  // reste plus juste, même en anglais.
  it("un type inconnu retombe sur le message brut", () => {
    expect(
      messageValidation({ loc: ["body", "nom"], type: "un_type_futur", msg: "Something odd" })
    ).toBe("Nom : Something odd");
  });

  it("un champ hors table garde son nom brut plutôt que de disparaître", () => {
    expect(messageValidation({ loc: ["body", "champ_inconnu"], type: "missing" }))
      .toBe("champ_inconnu : champ obligatoire.");
  });

  it("les index de liste ne masquent pas le champ visé", () => {
    expect(messageValidation({ loc: ["body", "project_ids", "0"], type: "int_parsing" }))
      .toBe("Projets rattachés : valeur numérique attendue.");
  });

  it("plusieurs erreurs sont jointes", () => {
    expect(
      messageValidations([
        { loc: ["body", "nom"], type: "missing" },
        { loc: ["body", "date_fin"], type: "missing" },
      ])
    ).toBe("Nom : champ obligatoire. ; Date de fin : champ obligatoire.");
  });
});
