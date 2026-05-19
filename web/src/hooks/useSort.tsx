import { ReactNode, useMemo, useState } from "react";

type SortDir = "asc" | "desc";
type Getter<T> = (item: T) => unknown;

interface SortState<T> {
  key: string;
  getter: Getter<T>;
  dir: SortDir;
}

export function useSortableList<T>(items: T[]) {
  const [sort, setSort] = useState<SortState<T> | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return items;
    const dirSign = sort.dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = sort.getter(a);
      const bv = sort.getter(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // empty values en bas
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dirSign;
      const as = String(av).toLocaleLowerCase("fr");
      const bs = String(bv).toLocaleLowerCase("fr");
      if (as < bs) return -1 * dirSign;
      if (as > bs) return 1 * dirSign;
      return 0;
    });
  }, [items, sort]);

  function sortHeader(label: ReactNode, key: string, getter: Getter<T>): ReactNode {
    const active = sort?.key === key;
    const arrow = active ? (sort?.dir === "asc" ? " ▲" : " ▼") : "";
    return (
      <th
        key={key}
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() =>
          setSort((cur) => {
            if (!cur || cur.key !== key) return { key, getter, dir: "asc" };
            if (cur.dir === "asc") return { key, getter, dir: "desc" };
            return null;
          })
        }
      >
        {label}
        <span style={{ color: "#6b7280", fontWeight: 400 }}>{arrow}</span>
      </th>
    );
  }

  return { sorted, sortHeader };
}
