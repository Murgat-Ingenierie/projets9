import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dependencies, tasks } from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import type { Dependency, DependencyType, Task } from "../types";

const TYPES: DependencyType[] = ["FS", "SS", "FF"];
const TYPE_LABELS: Record<DependencyType, string> = {
  FS: "Fin → Début (FS)",
  SS: "Début → Début (SS)",
  FF: "Fin → Fin (FF)",
};

export default function DependencyNewPage() {
  const nav = useNavigate();
  const [err, setErr] = useState<unknown>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState<Partial<Dependency>>({ type: "FS" });

  useEffect(() => {
    tasks.list().then(setAllTasks).catch(setErr);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await dependencies.create(draft);
      nav("/dependencies");
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <h2>Nouvelle dépendance</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={submit}>
        <label>Tâche amont</label>
        <select
          value={draft.tache_amont_id ?? ""}
          onChange={(e) => setDraft({ ...draft, tache_amont_id: e.target.value ? Number(e.target.value) : undefined })}
          required
        >
          <option value="">—</option>
          {allTasks.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
        </select>
        <label>Tâche aval</label>
        <select
          value={draft.tache_aval_id ?? ""}
          onChange={(e) => setDraft({ ...draft, tache_aval_id: e.target.value ? Number(e.target.value) : undefined })}
          required
        >
          <option value="">—</option>
          {allTasks.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
        </select>
        <label>Type</label>
        <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as DependencyType })}>
          {TYPES.map((s) => <option key={s} value={s}>{TYPE_LABELS[s]}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Créer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/dependencies")}>Annuler</button>
        </div>
      </form>
    </>
  );
}
