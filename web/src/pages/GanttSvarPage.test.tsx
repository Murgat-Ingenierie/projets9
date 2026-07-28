import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Régression « clignotement » (C9 Phase 2b).
//
// Le wrapper React de SVAR appelle `I.init(m)` — une ré-initialisation COMPLÈTE de son
// store — depuis un effet dont les dépendances contiennent la prop `init`, ainsi que
// `tasks`/`links`. Conséquences si on n'y prend pas garde :
//   • une fonction `init` recréée à chaque rendu ⇒ ré-init à CHAQUE rendu (un drag en
//     provoque 3 : setErr, pushUndo, puis les setState de reload) ;
//   • `reload()` après chaque mutation reconstruit `tasks`/`links` même quand rien n'a
//     changé ⇒ nouvelle référence ⇒ ré-init inutile.
// Ces tests verrouillent les deux propriétés, en capturant les props reçues par <Gantt>.

interface CapturedProps {
  init: unknown;
  tasks: unknown;
  links: unknown;
}
const captured: CapturedProps[] = [];

vi.mock("@svar-ui/react-gantt", () => ({
  Gantt: (props: CapturedProps) => {
    captured.push({ init: props.init, tasks: props.tasks, links: props.links });
    return <div data-testid="gantt-mock" />;
  },
  Willow: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../api/endpoints", () => ({
  epics: { list: vi.fn().mockResolvedValue([]) },
  projects: { list: vi.fn().mockResolvedValue([]), update: vi.fn() },
  tasks: { list: vi.fn().mockResolvedValue([]), update: vi.fn() },
  dependencies: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), remove: vi.fn() },
  milestones: { list: vi.fn().mockResolvedValue([]), update: vi.fn() },
  equipes: { list: vi.fn().mockResolvedValue([]) },
  tacheEquipe: { list: vi.fn().mockResolvedValue([]) },
}));

// Importé APRÈS les mocks (vi.mock est hoisté, mais on garde l'ordre explicite).
import GanttSvarPage from "./GanttSvarPage";

describe("GanttSvarPage — pas de ré-initialisation parasite de SVAR", () => {
  beforeEach(() => {
    // Pas de `globals: true` dans la config Vitest → le nettoyage automatique de
    // testing-library ne s'applique pas : on démonte explicitement entre les tests.
    cleanup();
    captured.length = 0;
  });

  it("garde la prop `init` STABLE entre les rendus (sinon SVAR ré-init tout à chaque rendu)", async () => {
    render(<GanttSvarPage />);
    await waitFor(() => expect(screen.getByTestId("gantt-mock")).toBeDefined());
    const initialRenders = captured.length;
    const firstInit = captured[0].init;

    // Un changement d'état SANS rapport avec les données (zoom) : il doit re-rendre…
    fireEvent.click(screen.getByRole("button", { name: "Mois" }));
    await waitFor(() => expect(captured.length).toBeGreaterThan(initialRenders));

    // …mais surtout ne pas changer l'identité de `init`.
    for (const c of captured) expect(c.init).toBe(firstInit);
  });

  it("garde `tasks` et `links` STABLES quand les données rechargées sont identiques", async () => {
    render(<GanttSvarPage />);
    await waitFor(() => expect(screen.getByTestId("gantt-mock")).toBeDefined());

    const firstTasks = captured[0].tasks;
    const firstLinks = captured[0].links;

    fireEvent.click(screen.getByRole("button", { name: "Mois" }));
    await waitFor(() => expect(captured.length).toBeGreaterThan(1));

    // Le contenu n'a pas bougé : SVAR ne doit voir aucun changement de référence.
    for (const c of captured) {
      expect(c.tasks).toBe(firstTasks);
      expect(c.links).toBe(firstLinks);
    }
  });
});
