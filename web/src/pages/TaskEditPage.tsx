import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { tasks } from "../api/endpoints";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { TaskAllocationsSection } from "../components/TaskAllocationsSection";
import { TaskEditor } from "../components/TaskEditor";
import { useParentCrumbs } from "../hooks/useBreadcrumbState";
import type { Task } from "../types";

const DEFAULT_PARENT: Crumb[] = [
  { label: "Planning", to: "/" },
  { label: "Tâches", to: "/tasks" },
];

export default function TaskEditPage() {
  const { id = "" } = useParams();
  const taskId = Number(id);
  const nav = useNavigate();
  const parentCrumbs = useParentCrumbs(DEFAULT_PARENT);
  // On lit la tâche juste pour le titre + dates passées à TaskAllocationsSection.
  // TaskEditor refait son propre fetch (idempotent).
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    if (Number.isNaN(taskId)) return;
    tasks
      .list()
      .then((ts) => setTask(ts.find((x) => x.id === taskId) ?? null))
      .catch(() => {});
  }, [taskId]);

  if (Number.isNaN(taskId)) return <p>Identifiant de tâche invalide</p>;

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: task?.nom ?? "Tâche" }]} />
      <h2>Modifier la tâche : {task?.nom ?? ""}</h2>
      <TaskEditor
        taskId={taskId}
        onSaved={() => nav("/tasks")}
        onCancel={() => nav("/tasks")}
        showDelete
      />
      <TaskAllocationsSection
        taskId={taskId}
        dateDebut={task?.date_debut}
        dateFin={task?.date_fin}
      />
    </>
  );
}
