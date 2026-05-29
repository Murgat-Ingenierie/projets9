import { useNavigate, useSearchParams } from "react-router-dom";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { ProjectEditor } from "../components/ProjectEditor";
import { useParentCrumbs } from "../hooks/useBreadcrumbState";

const DEFAULT_PARENT: Crumb[] = [
  { label: "Planning", to: "/" },
  { label: "Projets", to: "/projects" },
];

export default function ProjectNewPage() {
  const nav = useNavigate();
  const parentCrumbs = useParentCrumbs(DEFAULT_PARENT);
  const [searchParams] = useSearchParams();
  const initialEpic = searchParams.get("epic") ?? "";

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: "Nouveau projet" }]} />
      <h2>Nouveau projet</h2>
      <ProjectEditor
        initialDraft={{ epic_trigramme: initialEpic }}
        onSaved={() => nav("/projects")}
        onCancel={() => nav("/projects")}
      />
    </>
  );
}
