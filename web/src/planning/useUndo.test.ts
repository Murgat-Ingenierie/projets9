import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUndo } from "./useUndo";

function setup() {
  const onError = vi.fn();
  const onSuccess = vi.fn();
  const clearError = vi.fn();
  const { result } = renderHook(() => useUndo({ onError, onSuccess, clearError }));
  return { result, onError, onSuccess, clearError };
}

describe("useUndo", () => {
  it("pushUndo empile ; undoStack reflète la pile", () => {
    const { result } = setup();
    expect(result.current.undoStack).toHaveLength(0);
    act(() => result.current.pushUndo("A", async () => {}));
    expect(result.current.undoStack.map((a) => a.label)).toEqual(["A"]);
  });

  it("performUndo : clearError, exécute l'inverse, onSuccess ; pile décrémentée", async () => {
    const { result, onSuccess, clearError, onError } = setup();
    const undoA = vi.fn(async () => {});
    act(() => result.current.pushUndo("A", undoA));
    await act(async () => { await result.current.performUndo(); });
    expect(clearError).toHaveBeenCalledOnce();
    expect(undoA).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.undoStack).toHaveLength(0);
    expect(result.current.undoing).toBe(false);
  });

  it("dépile en LIFO", async () => {
    const { result } = setup();
    const order: string[] = [];
    act(() => result.current.pushUndo("A", async () => { order.push("A"); }));
    act(() => result.current.pushUndo("B", async () => { order.push("B"); }));
    await act(async () => { await result.current.performUndo(); });
    expect(order).toEqual(["B"]);
    expect(result.current.undoStack.map((a) => a.label)).toEqual(["A"]);
  });

  it("performUndo sur pile vide est un no-op", async () => {
    const { result, onSuccess, clearError } = setup();
    await act(async () => { await result.current.performUndo(); });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(clearError).not.toHaveBeenCalled();
  });

  it("en cas d'échec de l'annulation : onError, pas de onSuccess, undoing revient à false", async () => {
    const { result, onError, onSuccess } = setup();
    const boom = new Error("boom");
    act(() => result.current.pushUndo("A", async () => { throw boom; }));
    await act(async () => { await result.current.performUndo(); });
    expect(onError).toHaveBeenCalledWith(boom);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.undoing).toBe(false);
  });

  it("Ctrl+Z déclenche l'annulation", async () => {
    const { result } = setup();
    const undoA = vi.fn(async () => {});
    act(() => result.current.pushUndo("A", undoA));
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true })); });
    await waitFor(() => expect(undoA).toHaveBeenCalledOnce());
  });

  it("Ctrl+Z est ignoré pendant l'édition d'un champ (INPUT)", async () => {
    const { result } = setup();
    const undoA = vi.fn(async () => {});
    act(() => result.current.pushUndo("A", undoA));
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })); });
    await Promise.resolve();
    expect(undoA).not.toHaveBeenCalled();
    input.remove();
  });
});
