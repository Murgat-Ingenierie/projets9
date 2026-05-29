import { useNavigate } from "react-router-dom";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { EpicEditor } from "../components/EpicEditor";
import { useParentCrumbs } from "../hooks/useBreadcrumbState";

const DEFAULT_PARENT: Crumb[] = [
  { label: "Planning", to: "/" },
  { label: "Epics", to: "/epics" },
];

export default function EpicNewPage() {
  const nav = useNavigate();
  const parentCrumbs = useParentCrumbs(DEFAULT_PARENT);

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: "Nouvel epic" }]} />
      <h2>Nouvel epic</h2>
      <EpicEditor
        onSaved={() => nav("/epics")}
        onCancel={() => nav("/epics")}
      />
    </>
  );
}
