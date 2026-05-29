import { useEffect, useState } from "react";
import { epics as epicsApi } from "../api/endpoints";
import type { Epic, Milestone } from "../types";

interface Props {
  draft: Partial<Milestone>;
  setDraft: (d: Partial<Milestone>) => void;
}

export function MilestoneFormFields({ draft, setDraft }: Props) {
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  useEffect(() => {
    epicsApi.list().then(setAllEpics).catch(() => {});
  }, []);

  const selected = new Set(draft.epic_trigrammes ?? []);
  function toggleEpic(trigramme: string) {
    const next = new Set(selected);
    if (next.has(trigramme)) next.delete(trigramme);
    else next.add(trigramme);
    setDraft({ ...draft, epic_trigrammes: Array.from(next) });
  }

  return (
    <>
      <label>Nom</label>
      <input
        value={draft.nom ?? ""}
        onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
        required
      />
      <label>Date</label>
      <input
        type="date"
        value={draft.date ?? ""}
        onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        required
      />
      <label>Epics rattachés (au moins 1)</label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 6,
          padding: 6,
          border: "1px solid #e0e0e0",
          borderRadius: 4,
          maxHeight: 220,
          overflowY: "auto",
        }}
      >
        {allEpics.length === 0 && (
          <span className="muted" style={{ fontSize: 12 }}>Aucun epic disponible</span>
        )}
        {allEpics.map((e) => {
          const checked = selected.has(e.trigramme);
          return (
            <label
              key={e.trigramme}
              style={{
                display: "grid",
                gridTemplateColumns: "16px 36px 1fr",
                alignItems: "center",
                gap: 8,
                padding: "5px 8px",
                borderRadius: 4,
                background: checked ? "#e3f2fd" : "#f5f5f5",
                color: checked ? "#0d47a1" : "#5f6368",
                fontSize: 12,
                cursor: "pointer",
                border: checked ? "1px solid #1976d2" : "1px solid transparent",
                boxSizing: "border-box",
                minWidth: 0,
              }}
              title={e.nom}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleEpic(e.trigramme)}
                style={{ margin: 0, justifySelf: "center" }}
              />
              <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>{e.trigramme}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {e.nom}
              </span>
            </label>
          );
        })}
      </div>
      {(draft.epic_trigrammes ?? []).length === 0 && (
        <small style={{ color: "#c62828" }}>Sélectionne au moins un epic.</small>
      )}
      <label>
        <input
          type="checkbox"
          checked={!!draft.atteint}
          onChange={(e) => setDraft({ ...draft, atteint: e.target.checked })}
        />
        {" "}Atteint
      </label>
    </>
  );
}
