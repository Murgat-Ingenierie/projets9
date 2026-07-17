import { useEffect, useMemo, useRef, useState } from "react";
import { epics as epicsApi, projects as projectsApi } from "../api/endpoints";
import type { Epic, Project } from "../types";

interface Props {
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  /** Hauteur max de la liste déroulante. */
  maxListHeight?: number;
}

/**
 * Combobox de sélection multiple de projets (style « tags Linear / Jira »).
 * - Tape pour filtrer (nom de projet + trigramme/nom d'epic).
 * - Clic ou Entrée : ajoute le projet comme chip.
 * - Backspace dans l'input vide : retire le dernier chip.
 * - L'epic associé apparaît en gris à droite du nom pour le contexte.
 */
export function ProjectMultiSelect({
  value,
  onChange,
  placeholder = "Tape pour filtrer un projet…",
  maxListHeight = 260,
}: Props) {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allEpics, setAllEpics] = useState<Epic[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([projectsApi.list(), epicsApi.list()])
      .then(([ps, es]) => {
        setAllProjects(ps);
        setAllEpics(es);
      })
      .catch(() => {});
  }, []);

  const epicByTri = useMemo(() => {
    const m = new Map<string, Epic>();
    for (const e of allEpics) m.set(e.trigramme, e);
    return m;
  }, [allEpics]);

  const projectsById = useMemo(() => {
    const m = new Map<number, Project>();
    for (const p of allProjects) m.set(p.id, p);
    return m;
  }, [allProjects]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  // Liste filtrée : projets non encore sélectionnés, matchant la requête sur
  // nom du projet OU trigramme OU nom d'epic.
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    const out: { project: Project; epic: Epic | undefined }[] = [];
    for (const p of allProjects) {
      if (selectedSet.has(p.id)) continue;
      const epic = epicByTri.get(p.epic_trigramme);
      if (!q) {
        out.push({ project: p, epic });
        continue;
      }
      const hay =
        p.nom.toLocaleLowerCase("fr") +
        " " +
        p.epic_trigramme.toLocaleLowerCase("fr") +
        " " +
        (epic?.nom ?? "").toLocaleLowerCase("fr");
      if (hay.includes(q)) out.push({ project: p, epic });
    }
    return out;
  }, [allProjects, selectedSet, query, epicByTri]);

  function addProject(id: number) {
    if (selectedSet.has(id)) return;
    onChange([...value, id]);
    setQuery("");
    setHighlightIdx(0);
    inputRef.current?.focus();
  }

  function removeProject(id: number) {
    onChange(value.filter((x) => x !== id));
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlightIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[highlightIdx];
      if (pick) addProject(pick.project.id);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      e.preventDefault();
      removeProject(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Ferme la dropdown quand on clique en dehors
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          alignItems: "center",
          padding: 6,
          border: "1px solid #e0e0e0",
          borderRadius: 4,
          minHeight: 40,
          cursor: "text",
          background: "white",
        }}
      >
        {value.map((id) => {
          const p = projectsById.get(id);
          const epic = p ? epicByTri.get(p.epic_trigramme) : undefined;
          return (
            <span
              key={id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 6px 3px 8px",
                borderRadius: 12,
                background: epic?.couleur ?? "#1976d2",
                color: "white",
                fontSize: 12,
                fontWeight: 500,
                maxWidth: 240,
              }}
              title={p ? `${epic?.nom ?? p.epic_trigramme} — ${p.nom}` : `#${id}`}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p?.nom ?? `#${id}`}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeProject(id);
                }}
                title="Retirer"
                style={{
                  background: "transparent",
                  border: 0,
                  color: "white",
                  cursor: "pointer",
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlightIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          style={{
            border: 0,
            outline: "none",
            flex: 1,
            minWidth: 120,
            padding: "4px 6px",
            fontSize: 14,
            background: "transparent",
          }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: maxListHeight,
            overflowY: "auto",
            background: "white",
            border: "1px solid #e0e0e0",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            zIndex: 10,
          }}
        >
          {filtered.map(({ project, epic }, i) => (
            <div
              key={project.id}
              onMouseEnter={() => setHighlightIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                addProject(project.id);
              }}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: i === highlightIdx ? "#f1f8ff" : "transparent",
                borderLeft: `3px solid ${epic?.couleur ?? "transparent"}`,
              }}
            >
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  color: epic?.couleur ?? "#5f6368",
                  minWidth: 32,
                }}
              >
                {project.epic_trigramme}
              </span>
              <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.nom}
              </span>
              <span style={{ fontSize: 11, color: "#9aa0a6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                {epic?.nom ?? ""}
              </span>
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query.trim() !== "" && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            padding: "8px 12px",
            background: "white",
            border: "1px solid #e0e0e0",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            color: "#9aa0a6",
            fontSize: 12,
            zIndex: 10,
          }}
        >
          Aucun projet ne correspond à « {query} »
        </div>
      )}
    </div>
  );
}
