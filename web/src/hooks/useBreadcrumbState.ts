import { useLocation } from "react-router-dom";
import type { Crumb } from "../components/Breadcrumb";

export function useParentCrumbs(fallback: Crumb[]): Crumb[] {
  const location = useLocation();
  return (
    (location.state as { breadcrumb?: Crumb[] } | null)?.breadcrumb ?? fallback
  );
}

export function navState(parentCrumbs: Crumb[], self: Crumb) {
  return {
    state: {
      breadcrumb: [
        ...parentCrumbs,
        { ...self, state: { breadcrumb: parentCrumbs } },
      ],
    },
  };
}
