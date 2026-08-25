import { Fragment } from "react";
import { Link } from "react-router-dom";

import { useEcranEtroit } from "../hooks/useEcranEtroit";

export interface Crumb {
  label: string;
  to?: string;
  state?: unknown;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  const etroit = useEcranEtroit();
  // Le planning est inatteignable sous le seuil : la route « / » y redirige vers
  // Projets. Un fil qui l'annonce en lien ramènerait donc à la page où l'on est
  // déjà — on le retire ici plutôt que dans chacune des pages qui le déclarent.
  const affiches = etroit ? items.filter((c) => c.to !== "/") : items;
  return (
    <nav className="breadcrumb">
      {affiches.map((item, i) => {
        const isLast = i === affiches.length - 1;
        return (
          <Fragment key={i}>
            {item.to && !isLast ? (
              <Link to={item.to} state={item.state}>{item.label}</Link>
            ) : (
              <span className={isLast ? "current" : ""}>{item.label}</span>
            )}
            {!isLast && (
              <span className="material-symbols-outlined separator" aria-hidden="true">
                chevron_right
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
