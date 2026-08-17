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
// expose `reload` — appelé après chaque mutation. Extrait de l'ancien
// GanttPage.tsx (C9, Phase 1 ; page retirée à la bascule SVAR).
//
// R10 : le rechargement reste GLOBAL par défaut, et c'est délibéré. Chaque
// mutation devrait sinon déclarer ce qu'elle invalide, or les cascades sont
// larges ici — supprimer un epic emporte projets, tâches, dépendances, jalons et
// allocations. Un oubli ne casserait rien bruyamment : il laisserait l'écran
// afficher des données périmées. Sur les volumes réels (~42 ko, sept requêtes
// parallèles, soit UN aller-retour) le coût ne se sent pas ; le seuil mesuré où
// il commencerait à peser est vers dix fois ces volumes.
//
// `reloadDependances` est la seule exception, et elle est PROUVABLE : créer ou
// supprimer un lien du planning n'écrit que dans `dependencies` — aucune tâche
// n'est déplacée, aucune cascade n'est déclenchée. Ce sont aussi les gestes les
// plus répétés. 3,8 ko au lieu de 42.

export interface PlanningData {
  epics: Epic[];
  projects: Project[];
  tasks: Task[];
  dependencies: Dependency[];
  milestones: Milestone[];
  equipes: Equipe[];
  allocations: TacheEquipe[];
  reload: () => void;
  /** Recharge les SEULES dépendances. À n'employer que là où l'on peut démontrer
   *  qu'aucune autre collection n'a pu changer — sinon `reload`. */
  reloadDependances: () => void;
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

  const reloadDependances = useCallback(() => {
    depsApi
      .list()
      .then(setDependencies)
      .catch((err) => onErrorRef.current(err));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    epics, projects, tasks, dependencies, milestones, equipes, allocations,
    reload, reloadDependances,
  };
}
