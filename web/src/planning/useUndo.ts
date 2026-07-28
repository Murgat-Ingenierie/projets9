import { useCallback, useEffect, useRef, useState } from "react";

// Pile d'annulation du planning : chaque mutation réversible empile son inverse ;
// Ctrl/Cmd+Z ou le bouton dépile. Les effets de bord (rafraîchir, remonter/effacer
// l'erreur) sont délégués via options. Extrait de l'ancien GanttPage.tsx (C9, Phase 1 ; page retirée à la bascule SVAR).

export interface UndoAction {
  label: string;
  undo: () => Promise<void>;
}

export interface UseUndoOptions {
  /** Appelé si l'annulation échoue. */
  onError: (e: unknown) => void;
  /** Appelé après une annulation réussie (typiquement : recharger les données). */
  onSuccess: () => void;
  /** Appelé avant de tenter l'annulation (typiquement : effacer l'erreur courante). */
  clearError?: () => void;
}

export interface UseUndoResult {
  undoStack: UndoAction[];
  pushUndo: (label: string, undo: () => Promise<void>) => void;
  performUndo: () => Promise<void>;
  undoing: boolean;
}

export function useUndo(opts: UseUndoOptions): UseUndoResult {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [undoing, setUndoing] = useState(false);

  // Refs : performUndo reste stable (une seule souscription clavier) tout en
  // lisant l'état et les callbacks frais. Mise à jour post-rendu (pas pendant le
  // rendu), et de toute façon performUndo n'est appelé que sur interaction.
  const stackRef = useRef(undoStack);
  const undoingRef = useRef(undoing);
  const optsRef = useRef(opts);
  useEffect(() => {
    stackRef.current = undoStack;
    undoingRef.current = undoing;
    optsRef.current = opts;
  });

  const pushUndo = useCallback((label: string, undo: () => Promise<void>) => {
    setUndoStack((s) => [...s, { label, undo }]);
  }, []);

  const performUndo = useCallback(async () => {
    if (stackRef.current.length === 0 || undoingRef.current) return;
    const action = stackRef.current[stackRef.current.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setUndoing(true);
    optsRef.current.clearError?.();
    try {
      await action.undo();
      optsRef.current.onSuccess();
    } catch (e) {
      optsRef.current.onError(e);
    } finally {
      setUndoing(false);
    }
  }, []);

  // Ctrl+Z / Cmd+Z : on ignore quand un champ est en édition (le Ctrl+Z natif prime).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        const tgt = e.target as HTMLElement | null;
        if (tgt && /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)) return;
        e.preventDefault();
        performUndo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [performUndo]);

  return { undoStack, pushUndo, performUndo, undoing };
}
