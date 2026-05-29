import { useNavigate, useSearchParams } from "react-router-dom";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { TaskEditor } from "../components/TaskEditor";
import { useParentCrumbs } from "../hooks/useBreadcrumbState";

const DEFAULT_PARENT: Crumb[] = [
  { label: "Planning", to: "/" },
  { label: "Tâches", to: "/tasks" },
];

export default function TaskNewPage() {
  const nav = useNavigate();
  const parentCrumbs = useParentCrumbs(DEFAULT_PARENT);
  const [searchParams] = useSearchParams();
  const initialProjetId = Number(searchParams.get("projet_id")) || undefined;

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: "Nouvelle tâche" }]} />
      <h2>Nouvelle tâche</h2>
      <TaskEditor
        initialDraft={{ projet_id: initialProjetId }}
        onSaved={() => nav("/tasks")}
        onCancel={() => nav("/tasks")}
      />
    </>
  );
}
