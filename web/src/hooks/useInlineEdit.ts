import { useState } from "react";

/**
 * Helper d'édition inline pour une page liste : gère
 * - l'id de la ligne en cours d'édition
 * - le draft (copie modifiable de la ligne)
 * - les transitions start / cancel / patch
 *
 * Le composant fournit lui-même la persistance (save) — ce hook ne fait
 * pas d'appel API. Utiliser le draft directement dans le payload PUT/PATCH
 * de votre choix.
 */
export function useInlineEdit<T extends { id: K }, K extends string | number = number>() {
  const [editingId, setEditingId] = useState<K | null>(null);
  const [draft, setDraft] = useState<Partial<T>>({});

  function start(item: T) {
    setEditingId(item.id);
    setDraft({ ...item });
  }
  function cancel() {
    setEditingId(null);
    setDraft({});
  }
  function patch(p: Partial<T>) {
    setDraft((d) => ({ ...d, ...p }));
  }
  function isEditing(id: K) {
    return editingId === id;
  }

  return { editingId, draft, start, cancel, patch, isEditing, setDraft };
}
