import { ReactNode, useMemo, useRef, useState } from "react";

type SortDir = "asc" | "desc";
type Getter<T> = (item: T) => unknown;
type SortState<T> = { key: string; getter: Getter<T>; dir: SortDir };

/** Minuscules SANS accents : « regulation » doit trouver « Régulation ».
 *
 *  Les filtres par colonne s'en passaient — on y tape le début d'une valeur
 *  qu'on a sous les yeux. Une recherche libre, elle, se tape de mémoire et
 *  souvent sans accents, a fortiori depuis un téléphone. */
function pliable(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");
}

export function useSortableList<T>(items: T[]) {
  const [sort, setSort] = useState<SortState<T> | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  // Recherche libre, sur TOUTES les colonnes à la fois. Elle se cumule avec les
  // filtres par colonne plutôt que de les remplacer : sur écran étroit ces
  // derniers disparaissent avec l'en-tête, et il fallait un moyen de chercher.
  const [recherche, setRecherche] = useState("");
  const getters = useRef<Record<string, Getter<T>>>({});

  const sorted = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(([, v]) => v && v.trim() !== "");
    let out: T[] = items;
    const q = pliable(recherche.trim());
    if (q !== "") {
      // Une ligne est retenue si N'IMPORTE quelle colonne correspond — c'est ce
      // qu'on attend d'une recherche, là où les filtres par colonne se cumulent.
      out = out.filter((item) =>
        Object.values(getters.current).some((g) => pliable(g(item)).includes(q)),
      );
    }
    if (activeFilters.length > 0) {
      out = out.filter((item) =>
        activeFilters.every(([key, val]) => {
          const g = getters.current[key];
          if (!g) return true;
          const v = String(g(item) ?? "").toLocaleLowerCase("fr");
          return v.includes(val.toLocaleLowerCase("fr"));
        })
      );
    }
    if (sort) {
      const dirSign = sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const av = sort.getter(a);
        const bv = sort.getter(b);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dirSign;
        const as = String(av).toLocaleLowerCase("fr");
        const bs = String(bv).toLocaleLowerCase("fr");
        if (as < bs) return -1 * dirSign;
        if (as > bs) return 1 * dirSign;
        return 0;
      });
    }
    return out;
  }, [items, sort, filters, recherche]);

  function sortHeader(
    label: ReactNode,
    key: string,
    getter: Getter<T>,
    opts?: { noFilter?: boolean }
  ): ReactNode {
    getters.current[key] = getter;
    const active = sort?.key === key;
    const arrow = active ? (sort?.dir === "asc" ? "▲" : "▼") : "";
    return (
      <th key={key} style={{ verticalAlign: "top" }}>
        <div
          style={{
            cursor: "pointer",
            userSelect: "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          onClick={() =>
            setSort((cur) => {
              if (!cur || cur.key !== key) return { key, getter, dir: "asc" };
              if (cur.dir === "asc") return { key, getter, dir: "desc" };
              return null;
            })
          }
        >
          <span>{label}</span>
          <span style={{ color: "#6b7280", fontWeight: 400, marginLeft: 4 }}>{arrow}</span>
        </div>
        {!opts?.noFilter && (
          <input
            type="text"
            placeholder="filtrer…"
            value={filters[key] ?? ""}
            onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              marginTop: 4,
              fontSize: 11,
              padding: "2px 6px",
              border: "1px solid #d1d5db",
              borderRadius: 3,
              fontWeight: 400,
              background: "white",
            }}
          />
        )}
      </th>
    );
  }

  const filteredCount = sorted.length;
  const totalCount = items.length;

  return { sorted, sortHeader, filteredCount, totalCount, recherche, setRecherche };
}
