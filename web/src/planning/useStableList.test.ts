import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { listSignature, useStableList } from "./useStableList";

describe("listSignature", () => {
  it("est identique pour un même contenu dans deux tableaux distincts", () => {
    expect(listSignature([{ id: 1, start: new Date("2026-01-01") }])).toBe(
      listSignature([{ id: 1, start: new Date("2026-01-01") }]),
    );
  });

  it("diffère dès qu'une valeur change", () => {
    expect(listSignature([{ id: 1, text: "a" }])).not.toBe(listSignature([{ id: 1, text: "b" }]));
  });

  it("diffère si l'ordre change", () => {
    expect(listSignature([{ id: 1 }, { id: 2 }])).not.toBe(listSignature([{ id: 2 }, { id: 1 }]));
  });
});

describe("useStableList", () => {
  it("garde la MÊME référence quand le contenu est inchangé (cas du reload à vide)", () => {
    const initial = [{ id: "task:1", text: "A" }];
    const { result, rerender } = renderHook(({ list }) => useStableList(list), {
      initialProps: { list: initial },
    });
    const first = result.current;
    expect(first).toBe(initial);

    // Ce que produit `reload()` quand rien n'a changé : nouveaux objets, même contenu.
    rerender({ list: [{ id: "task:1", text: "A" }] });
    expect(result.current).toBe(first);
  });

  it("renvoie la NOUVELLE liste dès que le contenu change (le drag doit passer)", () => {
    const { result, rerender } = renderHook(({ list }) => useStableList(list), {
      initialProps: { list: [{ id: "task:1", date: "2026-01-01" }] },
    });
    const first = result.current;

    const moved = [{ id: "task:1", date: "2026-01-08" }];
    rerender({ list: moved });
    expect(result.current).not.toBe(first);
    expect(result.current).toBe(moved);
  });

  it("propage un ajout et une suppression", () => {
    const { result, rerender } = renderHook(({ list }) => useStableList(list), {
      initialProps: { list: [{ id: 1 }] },
    });
    const first = result.current;

    rerender({ list: [{ id: 1 }, { id: 2 }] });
    const grown = result.current;
    expect(grown).not.toBe(first);
    expect(grown).toHaveLength(2);

    rerender({ list: [{ id: 1 }] });
    expect(result.current).not.toBe(grown);
    expect(result.current).toHaveLength(1);
  });
});
