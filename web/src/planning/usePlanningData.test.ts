import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Dependency, Epic, Equipe, Milestone, Project, TacheEquipe, Task } from "../types";

vi.mock("../api/endpoints", () => ({
  epics: { list: vi.fn() },
  projects: { list: vi.fn() },
  tasks: { list: vi.fn() },
  dependencies: { list: vi.fn() },
  milestones: { list: vi.fn() },
  equipes: { list: vi.fn() },
  tacheEquipe: { list: vi.fn() },
}));

import { usePlanningData } from "./usePlanningData";
import {
  epics, projects, tasks, dependencies, milestones, equipes, tacheEquipe,
} from "../api/endpoints";

// Marqueurs distincts (contenu non pertinent ici) pour vérifier le mapping.
const EPICS = [{ trigramme: "O50" }] as unknown as Epic[];
const PROJECTS = [{ id: 1 }] as unknown as Project[];
const TASKS = [{ id: 11 }] as unknown as Task[];
const DEPS = [{ id: 101 }] as unknown as Dependency[];
const MS = [{ id: 21 }] as unknown as Milestone[];
const EQ = [{ id: 1 }] as unknown as Equipe[];
const ALLOC = [{ id: 1 }] as unknown as TacheEquipe[];

beforeEach(() => {
  vi.mocked(epics.list).mockResolvedValue(EPICS);
  vi.mocked(projects.list).mockResolvedValue(PROJECTS);
  vi.mocked(tasks.list).mockResolvedValue(TASKS);
  vi.mocked(dependencies.list).mockResolvedValue(DEPS);
  vi.mocked(milestones.list).mockResolvedValue(MS);
  vi.mocked(equipes.list).mockResolvedValue(EQ);
  vi.mocked(tacheEquipe.list).mockResolvedValue(ALLOC);
});

describe("usePlanningData", () => {
  it("charge les 7 collections au montage et les mappe correctement", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => usePlanningData({ onError }));
    await waitFor(() => expect(result.current.epics).toBe(EPICS));

    for (const list of [epics.list, projects.list, tasks.list, dependencies.list, milestones.list, equipes.list, tacheEquipe.list]) {
      expect(list).toHaveBeenCalledOnce();
    }
    expect(result.current.projects).toBe(PROJECTS);
    expect(result.current.tasks).toBe(TASKS);
    expect(result.current.dependencies).toBe(DEPS);
    expect(result.current.milestones).toBe(MS);
    expect(result.current.equipes).toBe(EQ);
    expect(result.current.allocations).toBe(ALLOC);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reload recharge les 7 collections", async () => {
    const { result } = renderHook(() => usePlanningData({ onError: vi.fn() }));
    await waitFor(() => expect(result.current.epics).toBe(EPICS));
    vi.mocked(epics.list).mockClear();

    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(epics.list).toHaveBeenCalledOnce());
  });

  it("appelle onError si un chargement échoue", async () => {
    const boom = new Error("boom");
    vi.mocked(tasks.list).mockRejectedValue(boom);
    const onError = vi.fn();
    renderHook(() => usePlanningData({ onError }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(boom));
  });
});
