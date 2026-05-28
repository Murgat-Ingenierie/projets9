import { Fragment } from "react";
import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
  state?: unknown;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
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
