import { useEffect, useRef, useState } from "react";
import { epics, milestones as milestonesApi, projects, tasks } from "../api/endpoints";
import type { Task } from "../types";
import { EpicEditor } from "./EpicEditor";
import { MilestoneEditor } from "./MilestoneEditor";
import { ProjectEditor } from "./ProjectEditor";
import { TaskAllocationsSection } from "./TaskAllocationsSection";
import { TaskEditor } from "./TaskEditor";

export type PanelTarget =
  | { type: "epic"; trigramme: string }
  | { type: "project"; id: number }
  | { type: "task"; id: number }
  | { type: "task-new"; projet_id: number }
  | { type: "milestone"; id: number }
  | { type: "milestone-new" };

interface Props {
  target: PanelTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="panel-header">
      <h3 style={{ margin: 0 }}>{title}</h3>
      <button type="button" className="panel-close" onClick={onClose} title="Fermer">
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  );
}

function EpicForm({ trigramme, onClose, onSaved }: { trigramme: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState<string>("");
  useEffect(() => {
    epics.get(trigramme).then((e) => setName(e.nom)).catch(() => {});
  }, [trigramme]);

  return (
    <>
      <PanelHeader title={name ? `Epic : ${name}` : "Chargement…"} onClose={onClose} />
      <div className="panel-body">
        <EpicEditor
          trigramme={trigramme}
          onSaved={() => { onSaved(); onClose(); }}
          onCancel={onClose}
          showDelete
          formStyle={{ boxShadow: "none", padding: 0, background: "transparent" }}
        />
      </div>
    </>
  );
}

function ProjectForm({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState<string>("");
  useEffect(() => {
    projects.list().then((ps) => setName(ps.find((x) => x.id === id)?.nom ?? "")).catch(() => {});
  }, [id]);

  return (
    <>
      <PanelHeader title={name ? `Projet : ${name}` : "Chargement…"} onClose={onClose} />
      <div className="panel-body">
        <ProjectEditor
          projectId={id}
          onSaved={() => { onSaved(); onClose(); }}
          onCancel={onClose}
          showDelete
          formStyle={{ boxShadow: "none", padding: 0, background: "transparent" }}
        />
      </div>
    </>
  );
}

function TaskNewForm({ projet_id, onClose, onSaved }: { projet_id: number; onClose: () => void; onSaved: () => void }) {
  const [projectName, setProjectName] = useState<string>("");
  useEffect(() => {
    projects.list().then((ps) => setProjectName(ps.find((x) => x.id === projet_id)?.nom ?? "")).catch(() => {});
  }, [projet_id]);

  return (
    <>
      <PanelHeader
        title={projectName ? `Nouvelle tâche : ${projectName}` : "Nouvelle tâche"}
        onClose={onClose}
      />
      <div className="panel-body">
        <TaskEditor
          initialDraft={{ projet_id }}
          onSaved={() => { onSaved(); onClose(); }}
          onCancel={onClose}
          formStyle={{ boxShadow: "none", padding: 0, background: "transparent" }}
        />
      </div>
    </>
  );
}

function TaskForm({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  // Lecture séparée pour le titre + dates de TaskAllocationsSection.
  // TaskEditor refait sa propre lecture (idempotent).
  const [task, setTask] = useState<Task | null>(null);
  useEffect(() => {
    tasks.list().then((ts) => setTask(ts.find((x) => x.id === id) ?? null)).catch(() => {});
  }, [id]);

  return (
    <>
      <PanelHeader title={task ? `Tâche : ${task.nom}` : "Chargement…"} onClose={onClose} />
      <div className="panel-body">
        <TaskEditor
          taskId={id}
          onSaved={() => { onSaved(); onClose(); }}
          onCancel={onClose}
          showDelete
          formStyle={{ boxShadow: "none", padding: 0, background: "transparent" }}
        />
        <TaskAllocationsSection
          taskId={id}
          dateDebut={task?.date_debut}
          dateFin={task?.date_fin}
        />
      </div>
    </>
  );
}

function MilestoneForm({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState<string>("");
  useEffect(() => {
    milestonesApi.list().then((ms) => setName(ms.find((x) => x.id === id)?.nom ?? "")).catch(() => {});
  }, [id]);

  return (
    <>
      <PanelHeader title={name ? `Jalon : ${name}` : "Chargement…"} onClose={onClose} />
      <div className="panel-body">
        <MilestoneEditor
          milestoneId={id}
          onSaved={() => { onSaved(); onClose(); }}
          onCancel={onClose}
          onDeleted={() => { onSaved(); onClose(); }}
          showDelete
          formStyle={{ boxShadow: "none", padding: 0, background: "transparent" }}
        />
      </div>
    </>
  );
}

function MilestoneNewForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  return (
    <>
      <PanelHeader title="Nouveau jalon" onClose={onClose} />
      <div className="panel-body">
        <MilestoneEditor
          onSaved={() => { onSaved(); onClose(); }}
          onCancel={onClose}
          formStyle={{ boxShadow: "none", padding: 0, background: "transparent" }}
        />
      </div>
    </>
  );
}

export function EditPanel({ target, onClose, onSaved }: Props) {
  // Échap pour fermer : capture phase sur document → ne se laisse pas
  // intercepter par les form inputs (date picker, select, etc.).
  // Ref pour ne pas re-binder à chaque re-render du parent.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!target) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [target]);

  if (!target) return null;

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <aside className="panel">
        {target.type === "epic" && (
          <EpicForm trigramme={target.trigramme} onClose={onClose} onSaved={onSaved} />
        )}
        {target.type === "project" && (
          <ProjectForm id={target.id} onClose={onClose} onSaved={onSaved} />
        )}
        {target.type === "task" && (
          <TaskForm id={target.id} onClose={onClose} onSaved={onSaved} />
        )}
        {target.type === "task-new" && (
          <TaskNewForm projet_id={target.projet_id} onClose={onClose} onSaved={onSaved} />
        )}
        {target.type === "milestone" && (
          <MilestoneForm id={target.id} onClose={onClose} onSaved={onSaved} />
        )}
        {target.type === "milestone-new" && (
          <MilestoneNewForm onClose={onClose} onSaved={onSaved} />
        )}
      </aside>
    </>
  );
}
