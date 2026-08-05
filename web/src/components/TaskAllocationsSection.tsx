import { useEffect, useMemo, useState } from "react";
import { equipes as equipesApi, tacheEquipe } from "../api/endpoints";
import type { Equipe, TacheEquipe } from "../types";
import { ErrorBanner } from "./ErrorBanner";
import { BoutonSupprimer } from "./BoutonSupprimer";

interface Props {
  taskId: number;
  dateDebut?: string;
  dateFin?: string;
}

export function TaskAllocationsSection({ taskId, dateDebut, dateFin }: Props) {
  const [err, setErr] = useState<unknown>(null);
  const [allEquipes, setAllEquipes] = useState<Equipe[]>([]);
  const [allocations, setAllocations] = useState<TacheEquipe[]>([]);
  const [newEquipeId, setNewEquipeId] = useState<number | "">("");
  const [newHours, setNewHours] = useState<number>(8);

  useEffect(() => {
    Promise.all([equipesApi.list(), tacheEquipe.list()])
      .then(([eqs, alls]) => {
        setAllEquipes(eqs);
        setAllocations(alls.filter((a) => a.tache_id === taskId));
      })
      .catch(setErr);
  }, [taskId]);

  const allocatedIds = useMemo(
    () => new Set(allocations.map((a) => a.equipe_id)),
    [allocations]
  );
  const availableEquipes = useMemo(
    () => allEquipes.filter((e) => !allocatedIds.has(e.id)),
    [allEquipes, allocatedIds]
  );

  function durationDays(): number | null {
    if (!dateDebut || !dateFin) return null;
    const d1 = new Date(dateDebut + "T00:00:00").getTime();
    const d2 = new Date(dateFin + "T00:00:00").getTime();
    if (Number.isNaN(d1) || Number.isNaN(d2)) return null;
    return Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
  }

  function hoursPerWeek(totalHours: number): string {
    const d = durationDays();
    if (!d) return "—";
    return ((totalHours * 7) / d).toFixed(1) + " h/sem";
  }

  async function addAllocation() {
    if (newEquipeId === "" || newHours <= 0) return;
    setErr(null);
    try {
      const created = await tacheEquipe.create({
        tache_id: taskId,
        equipe_id: newEquipeId,
        heures_allouees: newHours,
      });
      setAllocations([...allocations, created]);
      setNewEquipeId("");
      setNewHours(8);
    } catch (e) {
      setErr(e);
    }
  }

  async function updateAllocation(id: number, heures: number) {
    if (heures <= 0) return;
    setErr(null);
    try {
      const upd = await tacheEquipe.update(id, { heures_allouees: heures });
      setAllocations(allocations.map((a) => (a.id === id ? upd : a)));
    } catch (e) {
      setErr(e);
    }
  }

  async function removeAllocation(id: number) {
    setErr(null);
    try {
      await tacheEquipe.remove(id);
      setAllocations(allocations.filter((a) => a.id !== id));
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 24, marginBottom: 8 }}>Équipes impliquées</h3>
      <ErrorBanner error={err} />
      {allocations.length === 0 && (
        <p className="muted">Aucune équipe allouée sur cette tâche.</p>
      )}
      {allocations.length > 0 && (
        <table className="responsive" style={{ marginTop: 4 }}>
          <thead>
            <tr>
              <th>Équipe</th>
              <th>Heures totales</th>
              <th>Étalé</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a) => {
              const eq = allEquipes.find((e) => e.id === a.equipe_id);
              return (
                <tr key={a.id}>
                  <td data-label="Équipe">{eq?.nom ?? `#${a.equipe_id}`}</td>
                  <td data-label="Heures totales">
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      defaultValue={a.heures_allouees}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v) && v !== a.heures_allouees)
                          updateAllocation(a.id, v);
                      }}
                      style={{ width: 80 }}
                    /> h
                  </td>
                  <td className="muted" data-label="Étalé">{hoursPerWeek(a.heures_allouees)}</td>
                  <td className="row-actions">
                    <BoutonSupprimer onClick={() => removeAllocation(a.id)}>×</BoutonSupprimer>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {availableEquipes.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={newEquipeId}
            onChange={(e) => setNewEquipeId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">— ajouter une équipe —</option>
            {availableEquipes.map((e) => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </select>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={newHours}
            onChange={(e) => setNewHours(parseFloat(e.target.value))}
            style={{ width: 80 }}
          />
          <span>h</span>
          <button type="button" className="btn" onClick={addAllocation} disabled={newEquipeId === ""}>
            + Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
