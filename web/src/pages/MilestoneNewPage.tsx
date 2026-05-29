import { useNavigate } from "react-router-dom";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { MilestoneEditor } from "../components/MilestoneEditor";
import { useParentCrumbs } from "../hooks/useBreadcrumbState";

const DEFAULT_PARENT: Crumb[] = [
  { label: "Planning", to: "/" },
  { label: "Jalons", to: "/milestones" },
];

export default function MilestoneNewPage() {
  const nav = useNavigate();
  const parentCrumbs = useParentCrumbs(DEFAULT_PARENT);

  return (
    <>
      <Breadcrumb items={[...parentCrumbs, { label: "Nouveau jalon" }]} />
      <h2>Nouveau jalon</h2>
      <MilestoneEditor
        onSaved={() => nav("/milestones")}
        onCancel={() => nav("/milestones")}
      />
    </>
  );
}
