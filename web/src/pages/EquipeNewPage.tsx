import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { equipes as equipesApi } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ErrorBanner } from "../components/ErrorBanner";
import { useParentCrumbs } from "../hooks/useBreadcrumbState";

const DEFAULT_PARENT: Crumb[] = [
  { label: "Planning", to: "/" },
  { label: "Équipes", to: "/equipes" },
];

export default function EquipeNewPage() {
  const id = useId();
  const nav = useNavigate();
  const parentCrumbs = useParentCrumbs(DEFAULT_PARENT);
  const [err, setErr] = useState<unknown>(null);
  const [draft, setDraft] = useState({ nom: "", temps_dispo_hebdo: 35 });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await equipesApi.create(draft);
      nav("/equipes");
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: "Nouvelle équipe" }]} />
      <h2>Nouvelle équipe</h2>
      <ErrorBanner error={err} />
      <form className="form" onSubmit={submit}>
        <label htmlFor={`${id}-nom`}>Nom</label>
        <input
          id={`${id}-nom`}
          value={draft.nom}
          onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
          required
        />
        <label htmlFor={`${id}-temps`}>Temps dispo / semaine (h)</label>
        <input
          id={`${id}-temps`}
          type="number"
          min={0}
          step={0.5}
          value={draft.temps_dispo_hebdo}
          onChange={(e) =>
            setDraft({ ...draft, temps_dispo_hebdo: parseFloat(e.target.value) })
          }
          required
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn" type="submit">Créer</button>
          <button type="button" className="btn secondary" onClick={() => nav("/equipes")}>Annuler</button>
        </div>
      </form>
    </>
  );
}
