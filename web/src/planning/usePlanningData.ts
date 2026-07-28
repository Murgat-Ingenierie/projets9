import { useCallback, useEffect, useRef, useState } from "react";
import {
  epics as epicsApi,
  projects as projectsApi,
  tasks as tasksApi,
  dependencies as depsApi,
  milestones as milestonesApi,
  equipes as equipesApi,
  tacheEquipe,
} from "../api/endpoints";
import type { Dependency, Epic, Equipe, Milestone, Project, TacheEquipe, Task } from "../types";

// Charge les 7 collections du planning en une passe (Promise.all) au montage, et
// expose `reload` — appelé après chaque mutation (pas de refetch ciblé, cf. R10).
// Extrait de l'ancien GanttPage.tsx (C9, Phase 1 ; page retirée à la bascule SVAR).

export interface PlanningData {
  epics: Epic[];
  projects: Project[];
  tasks: Task[];
  dependencies: Dependency[];
  milestones: Milestone[];
  equipes: Equipe[];
  allocations: TacheEquipe[];
  reload: () => void;
}

export function usePlanningData(opts: { onError: (e: unknown) => void }): PlanningData {
  const [epics, setEpics] = useState<Epic[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [allocations, setAllocations] = useState<TacheEquipe[]>([]);

  // onError frais sans re-souscrire reload/effet.
  const onErrorRef = useRef(opts.onError);
  useEffect(() => {
    onErrorRef.current = opts.onError;
  });

  const reload = useCallback(() => {
    Promise.all([
      epicsApi.list(),
      projectsApi.list(),
      tasksApi.list(),
      depsApi.list(),
      milestonesApi.list(),
      equipesApi.list(),
      tacheEquipe.list(),
    ])
      .then(([e, p, t, d, m, eq, alloc]) => {
        setEpics(e);
        setProjects(p);
        setTasks(t);
        setDependencies(d);
        setMilestones(m);
        setEquipes(eq);
        setAllocations(alloc);
      })
      .catch((err) => onErrorRef.current(err));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { epics, projects, tasks, dependencies, milestones, equipes, allocations, reload };
}
