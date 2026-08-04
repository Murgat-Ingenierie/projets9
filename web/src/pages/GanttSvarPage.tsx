// Planning principal (route `/`), bâti sur SVAR — chantier C9.
//
// Remplace l'ancien GanttPage.tsx (gantt-task-react, 2104 lignes), retiré à la
// bascule : plus de manipulation impérative du DOM de la lib, plus de setInterval,
// plus de mapping par index. Réutilise les modules purs de la Phase 1
// (usePlanningData, useUndo, dates, cascade) et les mappings buildSvarTasks/
// buildSvarLinks, tous sous tests unitaires.
//
// ⚠️ Les props `init`, `tasks` et `links` doivent rester STABLES en identité : SVAR
// ré-initialise tout son store à chaque changement de référence (cf. useStableList
// et le useCallback sur onInit — sinon clignotement à chaque rendu).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import type { IApi, TID, ILink, ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import "./gantt-svar.css"; // correctifs thème (icône corbeille cliquable — cf. fichier)
import { usePlanningData } from "../planning/usePlanningData";
import { buildSvarTasks } from "../planning/buildSvarTasks";
import { buildSvarLinks, svarLinkToDependency } from "../planning/buildSvarLinks";
import { parseSvarId } from "../planning/svarAdapter";
import { isoDate, toDate, daysBetweenIso, fmtDate } from "../planning/dates";
import { planBlockShift, planCascadeShifts, planGroupShifts, type FsEdge, type TaskDates } from "../planning/cascadeShifts";
import { celluleCouvre, type Depassement } from "../planning/echeances";
import { couleurTexteSur } from "../planning/ganttStyles";
import { deriveTeamFilter } from "../planning/teamFilter";
import { useUndo } from "../planning/useUndo";
import { useStableList } from "../planning/useStableList";
import {
  tasks as tasksApi,
  projects as projectsApi,
  milestones as milestonesApi,
  dependencies as depsApi,
} from "../api/endpoints";
import { ErrorBanner } from "../components/ErrorBanner";
import { EditPanel, type PanelTarget } from "../components/EditPanel";
import type { Dependency, Task } from "../types";

type Scale = { unit: "year" | "month" | "week" | "day"; step: number; format: (d: Date) => string };
type ZoomLevel = "day" | "week" | "month";

const MONTH_TOP: Scale = {
  unit: "month",
  step: 1,
  format: (d) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
};

// Niveaux de zoom Jour / Semaine / Mois : échelles + largeur de cellule.
const ZOOMS: Record<ZoomLevel, { label: string; cellWidth: number; scales: Scale[] }> = {
  day: {
    label: "Jour",
    cellWidth: 36,
    scales: [MONTH_TOP, { unit: "day", step: 1, format: (d) => String(d.getDate()) }],
  },
  // Colonnes hebdomadaires via un pas de 7 JOURS (unité mini = jour) : les cellules
  // de mois gardent une largeur exacte (proportionnelle aux jours), au lieu d'être
  // arrondies au nombre entier de semaines — ce qui décalait l'entête des mois.
  week: {
    label: "Semaine",
    cellWidth: 8,
    scales: [MONTH_TOP, { unit: "day", step: 7, format: (d) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) }],
  },
  // Trois échelles, dont une au JOUR sans libellé — et c'est délibéré. Elle n'est
  // pas là pour être lue (sa ligne d'en-tête est masquée en CSS) mais pour donner
  // à `highlightTime` sa granularité : SVAR surligne une CELLULE, donc sans cette
  // échelle le repère d'un jalon se posait au 1er du mois, décalé de trois
  // semaines. `cellWidth: 3` garde un mois à ~91 px, comme avant.
  month: {
    label: "Mois",
    cellWidth: 3,
    scales: [
      { unit: "year", step: 1, format: (d) => String(d.getFullYear()) },
      { unit: "month", step: 1, format: (d) => d.toLocaleDateString("fr-FR", { month: "short" }) },
      { unit: "day", step: 1, format: () => "" },
    ],
  },
};
const ZOOM_ORDER: ZoomLevel[] = ["day", "week", "month"];

// Largeur d'une cellule de l'échelle, en jours — sert à savoir quelle cellule
// contient une date de jalon. La vue Mois vaut 1 depuis qu'elle déclare une
// échelle au jour : c'est ce qui rend le repère précis à la date.
const PAS_JOURS: Record<ZoomLevel, number | null> = { day: 1, week: 7, month: 1 };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Graphe FS et dates depuis l'état React COMPLET (usePlanningData), PAS le store SVAR
// qui peut être filtré par équipe : la cascade doit propager même vers des tâches
// masquées (parité ancien Gantt). L'état React est frais (reload après chaque mutation).
function fsEdgesFromDeps(deps: Dependency[]): FsEdge[] {
  const edges: FsEdge[] = [];
  for (const d of deps) {
    if (d.type === "FS") edges.push({ amontId: d.tache_amont_id, avalId: d.tache_aval_id });
  }
  return edges;
}

function taskDatesFromTasks(tasks: Task[]): Map<number, TaskDates> {
  const m = new Map<number, TaskDates>();
  for (const t of tasks) m.set(t.id, { date_debut: t.date_debut, date_fin: t.date_fin });
  return m;
}

// Ids des tâches actuellement sélectionnées (multi-sélection SVAR : Ctrl/⌘+clic).
function selectedTaskIds(api: IApi): number[] {
  const ids: number[] = [];
  for (const sid of api.getState().selected ?? []) {
    const p = parseSvarId(String(sid));
    if (p?.kind === "task") ids.push(Number(p.ref));
  }
  return ids;
}

// Dates d'origine des tâches affectées par un drag (déplacée + décalées) pour l'undo.
function beforeState(
  movedId: number,
  orig: { start: Date; end: Date } | undefined,
  shifts: { id: number }[],
  dates: Map<number, TaskDates>,
): { id: number; date_debut: string; date_fin: string }[] {
  const before: { id: number; date_debut: string; date_fin: string }[] = [];
  if (orig) before.push({ id: movedId, date_debut: isoDate(orig.start), date_fin: isoDate(orig.end) });
  for (const s of shifts) {
    const od = dates.get(s.id);
    if (od) before.push({ id: s.id, date_debut: od.date_debut, date_fin: od.date_fin });
  }
  return before;
}

// Contenu personnalisé des barres (taskTemplate) : couleur d'epic + décorations des
// tâches archivées (hachure + coche « fait »). Le template REMPLACE le contenu natif
// de la barre → on re-rend le libellé nous-mêmes. Champs custom posés par buildSvarTasks.
function TaskBar({ data }: { data: ITask }) {
  const d = data as ITask & { barColor?: string; archived?: boolean; depassement?: Depassement };
  if (d.type === "milestone") {
    return <span className="wx-text-out">{d.text}</span>;
  }
  // Le libellé était blanc quelle que soit la barre. Or une tâche porte la couleur
  // de son epic ÉCLAIRCIE : sur un epic pâle, le blanc devenait illisible. On tire
  // donc la couleur du texte de la luminance réelle du fond.
  const couleurTexte = d.barColor ? couleurTexteSur(d.barColor) : undefined;
  return (
    <>
      {d.barColor && <span className="deco-bar" style={{ background: d.barColor }} aria-hidden />}
      {d.archived && <span className="deco-archive-hatch" aria-hidden />}
      {/* Dépassement d'échéance : la portion de barre POSTÉRIEURE au jalon. Sa
          position se déduit des dates (ratio), donc rien n'est mesuré dans le
          DOM — ce qui la rend insensible au zoom et à la largeur de la fenêtre. */}
      {d.depassement && (
        <span
          className="deco-depassement"
          style={{ left: `${d.depassement.ratio * 100}%` }}
          title={`Dépasse « ${d.depassement.jalon} » (${d.depassement.date}) de ${d.depassement.jours} jours`}
        />
      )}
      <span className="wx-content deco-label" style={{ color: couleurTexte }}>{d.text}</span>
      {d.archived && (
        <span className="material-symbols-outlined deco-done" aria-hidden>
          check_circle
        </span>
      )}
    </>
  );
}

//: Ouvre la création d'une tâche pour un projet donné.
//:
//: Porteur de module parce que `COLONNES` doit rester une CONSTANTE — SVAR
//: ré-initialise son store dès qu'une prop change de référence (clignotement,
//: #52) — alors que le gestionnaire, lui, vient d'un état React.
//:
//: Objet jamais réassigné, seul `.current` est renseigné, et depuis un EFFET :
//: écrire pendant le rendu est un effet de bord, que React signale à juste titre.
const creationTache: { current: (projetId: number) => void } = { current: () => {} };

/** Cellule « + » : créer une tâche dans CE projet.
 *
 *  Remplace la colonne `add-task` native de SVAR, qui était pire que muette :
 *  elle ajoutait bien une ligne dans le store — donc à l'écran — mais sans
 *  requête ni panneau. La tâche n'existait nulle part et disparaissait au
 *  rechargement ; l'utilisateur croyait avoir enregistré. Changer l'`id` de la
 *  colonne suffit à ce que SVAR ne reconnaisse plus son action et ne la déclenche
 *  plus.
 *
 *  Rendue sur les lignes de PROJET seulement : une tâche n'a pas de sous-tâche
 *  dans ce modèle, un jalon n'en porte pas, et créer un projet depuis un epic
 *  demanderait un mode de panneau qui n'existe pas. Proposer un bouton inerte
 *  ailleurs reproduirait le défaut qu'on corrige.
 */
function CelluleAjout({ row }: { row: ITask }) {
  const parsed = parseSvarId(String(row.id));
  if (parsed?.kind !== "proj") return null;
  return (
    <button
      type="button"
      className="cellule-ajout material-symbols-outlined"
      title="Nouvelle tâche dans ce projet"
      onClick={() => creationTache.current(Number(parsed.ref))}
    >
      add
    </button>
  );
}

// Colonnes de la grille. « Start date » et « Duration » retirées : la date de
// début se lit sur la barre, et la durée en jours d'un projet qui court sur trois
// ans (1126 !) n'apprend rien — deux colonnes qui prenaient 220 px sans les
// rendre, au point de tronquer les libellés.
//
// Identité STABLE (constante de module) : SVAR ré-initialise tout son store dès
// qu'une de ses props change de référence — c'est la cause du clignotement
// corrigé en #52. Un tableau reconstruit à chaque rendu le rejouerait.
//
// Les colonnes par défaut sont redéclarées plutôt qu'importées de
// `@svar-ui/gantt-store` : ce paquet n'est qu'une dépendance TRANSITIVE de
// react-gantt, et rien ne garantit sa résolution. Valeurs relevées sur la 2.7.1.
const COLONNES = [
  { id: "text", header: "Nom", flexgrow: 1, width: 260, sort: true },
  // `id` volontairement DIFFÉRENT de « add-task » : c'est ce nom que SVAR
  // reconnaît pour brancher son ajout natif, celui qui créait une ligne fantôme.
  { id: "creer-tache", header: "", width: 37, align: "center" as const, sort: false,
    resize: false, cell: CelluleAjout },
];

export default function GanttSvarPage() {
  const [err, setErr] = useState<unknown>(null);
  // Vue MOIS par défaut : les projets de la pisciculture s'étalent sur des
  // trimestres, parfois des années. En vue Jour, l'écran d'accueil ne montrait
  // qu'une poignée de jours — l'utilisateur arrivait sur un planning dont
  // l'essentiel était hors champ, et devait dézoomer avant de voir son travail.
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  // Défaut À PLAT (parité avec l'ancien Gantt) : projets au niveau racine ; le toggle
  // « Grouper par epic » ajoute les lignes d'en-tête epic (reparente sous l'epic).
  const [groupByEpic, setGroupByEpic] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());
  // Panneau d'édition/création (parité ancien Gantt) : ouvert au double-clic sur une
  // ligne (on intercepte l'éditeur natif de SVAR) et par les boutons « + » de la barre.
  const [panelTarget, setPanelTarget] = useState<PanelTarget | null>(null);
  // Projet actuellement sélectionné, s'il y en a UN seul : contexte de « + Tâche »
  // (créer une tâche exige un projet parent).
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const apiRef = useRef<IApi | null>(null);
  // Branche le « + » des lignes de projet sur le panneau de création. Dans un
  // effet, pas pendant le rendu (cf. `creationTache`). `setPanelTarget` est
  // stable, d'où des dépendances vides.
  useEffect(() => {
    creationTache.current = (projetId) => setPanelTarget({ type: "task-new", projet_id: projetId });
  }, []);
  // État déplié (id de ligne → ouvert), suivi HORS React (ref) : survit aux
  // reconstructions de l'arbre (filtre/groupe) sans re-render à chaque expand/repli.
  const openStateRef = useRef<Map<string, boolean>>(new Map());
  const { epics, projects, tasks, dependencies, milestones, equipes, allocations, reload } = usePlanningData({
    onError: setErr,
  });

  // Données React fraîches pour les handlers (closure onInit) : la cascade lit le
  // graphe COMPLET (toutes les tâches + dépendances), pas le store filtré → parité.
  const tasksRef = useRef(tasks);
  const depsRef = useRef(dependencies);
  const projectsRef = useRef(projects);
  useEffect(() => {
    tasksRef.current = tasks;
    depsRef.current = dependencies;
    projectsRef.current = projects;
  });

  // Pile d'annulation (Ctrl+Z) : chaque mutation empile son inverse (persisté). Le
  // reload (onSuccess) rafraîchit l'arbre. Parité avec l'ancien Gantt (useUndo).
  const { undoStack, pushUndo, performUndo, undoing } = useUndo({
    onError: setErr,
    onSuccess: reload,
    clearError: () => setErr(null),
  });

  // Filtre équipe : tâches/projets en scope (null = pas de filtre). Pur, testé.
  const { taskIds: teamFilterTaskIds, projectIds: teamFilterProjectIds } = useMemo(
    () => deriveTeamFilter({ allocations, tasks, selectedTeamIds }),
    [allocations, tasks, selectedTeamIds],
  );

  // Colonnes surlignées : « aujourd'hui » (parité todayColor de l'ancien Gantt)
  // et les dates de JALON — un repère vertical traversant tout le graphe, sans
  // distinction de projet, qui complète le hachurage porté par chaque barre.
  //
  // La comparaison se fait sur la PORTÉE de la cellule, pas sur une date exacte :
  // en vue Mois une cellule vaut un mois, et une égalité stricte n'y trouvait
  // jamais rien — c'est pourquoi la colonne « aujourd'hui » y était invisible.
  const todayIso = useMemo(() => isoDate(startOfToday()), []);
  const datesJalons = useMemo(() => new Set(milestones.map((m) => m.date)), [milestones]);
  const pasJours = PAS_JOURS[zoom];
  const moisEnCours = zoom === "month";
  const highlightToday = useMemo(
    () => (d: Date) => {
      const classes: string[] = [];
      const jalon = celluleCouvre(d, pasJours, datesJalons);
      if (jalon) classes.push("col-jalon");
      if (celluleCouvre(d, pasJours, new Set([todayIso]))) classes.push("wx-today-col");
      // Limite de mois : en vue Mois, les cellules valent un JOUR (échelle
      // ajoutée pour la précision des jalons) et le fond quadrillé est retiré —
      // sans ceci, plus aucune séparation verticale. Marquer le 1er de chaque
      // mois rend des limites EXACTES là où un motif à période fixe dériverait,
      // les mois comptant de 28 à 31 jours.
      //
      // `&& !jalon` : une échéance tombant un 1er recevrait les DEUX classes, et
      // la limite de mois — écrite après, à spécificité égale — écrasait le trait
      // du jalon par un gris pâle. Le jalon disparaissait purement et simplement.
      // Trois des sept jalons réels sont sur un 1er. On l'exprime ici plutôt que
      // par un jeu de spécificité, où la prochaine règle ajoutée reposerait le
      // problème en silence.
      if (moisEnCours && !jalon && d.getDate() === 1) classes.push("col-mois");
      return classes.join(" ");
    },
    [todayIso, datesJalons, pasJours, moisEnCours],
  );

  const tasksByProject = useMemo(() => {
    const m = new Map<number, Task[]>();
    for (const t of tasks) {
      if (!m.has(t.projet_id)) m.set(t.projet_id, []);
      m.get(t.projet_id)!.push(t);
    }
    return m;
  }, [tasks]);

  // Réactivité : SVAR relit toute la prop `tasks` à chaque changement de référence.
  // On préserve l'état déplié via openStateRef, et reload() après chaque mutation
  // garde l'état React frais → un changement de filtre/groupe reconstruit l'arbre
  // depuis les dates PERSISTÉES (pas de retour à l'ancienne date).
  const svarTasksRaw = useMemo(
    () =>
      buildSvarTasks({
        epics,
        projects,
        tasksByProject,
        milestones,
        teamFilterProjectIds,
        teamFilterTaskIds,
        groupByEpic,
        // Lu au recalcul du memo (dep filtre/groupe/données) ; SVAR a déjà appliqué
        // l'expand impérativement entre-temps, donc une valeur « périmée » est sans effet.
        // eslint-disable-next-line react-hooks/refs
        openState: openStateRef.current,
      }),
    [epics, projects, tasksByProject, milestones, teamFilterProjectIds, teamFilterTaskIds, groupByEpic],
  );

  // Liens filtrés au périmètre équipe : on ne garde que les dépendances dont les DEUX
  // extrémités sont visibles (évite les liens pendants et une cascade vers des tâches
  // hors scope — l'édition sous filtre ne propage pas au-delà du périmètre).
  const svarLinksRaw = useMemo(() => {
    const all = buildSvarLinks(dependencies);
    if (!teamFilterTaskIds) return all;
    return all.filter((l) => {
      const s = parseSvarId(String(l.source));
      const t = parseSvarId(String(l.target));
      return (
        s?.kind === "task" &&
        t?.kind === "task" &&
        teamFilterTaskIds.has(Number(s.ref)) &&
        teamFilterTaskIds.has(Number(t.ref))
      );
    });
  }, [dependencies, teamFilterTaskIds]);

  // Anti-clignotement : SVAR ré-initialise TOUT son store dès que `tasks`/`links`
  // change de RÉFÉRENCE. Or `reload()` tourne après chaque mutation et reconstruit
  // ces tableaux même quand rien n'a bougé (créer/supprimer un lien ne touche aucune
  // tâche). On ne propage donc que les changements de CONTENU réels.
  const svarTasks = useStableList(svarTasksRaw);
  const svarLinks = useStableList(svarLinksRaw);

  // Rollback (SPEC §4) : dates d'origine capturées AVANT l'application du drag.
  const originalRef = useRef<Map<TID, { start: Date; end: Date }>>(new Map());
  // Lien capturé AVANT suppression, pour pouvoir le rétablir si l'API refuse.
  const deletedLinkRef = useRef<Map<TID, Pick<ILink, "source" | "target" | "type">>>(new Map());

  // ⚠️ DOIT rester stable en identité. Le wrapper React de SVAR garde la prop `init`
  // dans les dépendances de l'effet qui appelle `I.init(m)` : une nouvelle fonction à
  // chaque rendu = **ré-initialisation complète du store à chaque rendu**. C'était la
  // cause du clignotement — un simple drag re-rend 3 fois (setErr, pushUndo, puis les
  // setState de reload), donc ré-initialisait le Gantt 3 fois de suite.
  // `reload` et `pushUndo` sont eux-mêmes des useCallback([]) : les deps sont stables.
  const onInit = useCallback((api: IApi) => {
    apiRef.current = api;

    // Mémoriser l'état déplié à chaque expand/repli (ref, pas de re-render) : préservé
    // lors des reconstructions de l'arbre (cf. openStateRef passé à buildSvarTasks).
    api.on("open-task", (ev) => {
      openStateRef.current.set(String(ev.id), Boolean(ev.mode));
    });

    // Édition : SVAR ouvre son propre éditeur au double-clic (`show-editor`). On le
    // BLOQUE (return false) et on ouvre EditPanel à la place — c'est lui qui porte les
    // règles métier (allocations, project_ids d'un jalon…), parité avec l'ancien Gantt.
    api.intercept("show-editor", (ev) => {
      const parsed = parseSvarId(String(ev.id));
      if (!parsed) return false;
      if (parsed.kind === "epic") setPanelTarget({ type: "epic", trigramme: parsed.ref });
      else if (parsed.kind === "proj") setPanelTarget({ type: "project", id: Number(parsed.ref) });
      else if (parsed.kind === "task") setPanelTarget({ type: "task", id: Number(parsed.ref) });
      else setPanelTarget({ type: "milestone", id: Number(parsed.ref) });
      return false;
    });

    // Contexte de création d'une tâche : le projet sélectionné, s'il est unique.
    api.on("select-task", () => {
      const projs: number[] = [];
      for (const sid of api.getState().selected ?? []) {
        const p = parseSvarId(String(sid));
        if (p?.kind === "proj") projs.push(Number(p.ref));
      }
      setSelectedProjectId(projs.length === 1 ? projs[0] : null);
    });

    api.intercept("update-task", (ev) => {
      // Ne capturer l'origine que pour un vrai geste utilisateur (pas nos ré-émissions,
      // ni les ré-émissions INTERNES de SVAR : `eventSource:"update-task"` = déplacement
      // des enfants d'un summary glissé (moveSummaryKids) et recalcul des dates de summary
      // parent (resetSummaryDates) — cf. gantt-store. On laisse SVAR agir (return true).
      if (ev.eventSource === "rollback" || ev.eventSource === "cascade" || ev.eventSource === "update-task") return true;
      if (!originalRef.current.has(ev.id)) {
        const t = api.getTask(ev.id);
        if (t?.start && t?.end) originalRef.current.set(ev.id, { start: t.start, end: t.end });
      }
      return true;
    });

    // Applique une liste de décalages (cascade OU groupe) : visuel immédiat pour les
    // tâches VISIBLES (les masquées sont persistées sans exec puis rapatriées par
    // reload), puis persistance groupée et reload() — qui RÉCONCILIE succès ET échec
    // depuis la vérité serveur (comme l'ancien Gantt ; pas de rollback manuel).
    const applyShiftsAndPersist = async (
      movedId: number,
      moved: { date_debut: string; date_fin: string },
      shifts: { id: number; date_debut: string; date_fin: string }[],
      before: { id: number; date_debut: string; date_fin: string }[],
      label: string,
    ) => {
      for (const s of shifts) {
        if (api.getTask(`task:${s.id}`)) {
          api.exec("update-task", {
            id: `task:${s.id}`,
            task: { start: toDate(s.date_debut), end: toDate(s.date_fin) },
            skipUndo: true,
            eventSource: "cascade",
          });
        }
      }
      try {
        await Promise.all([
          tasksApi.update(movedId, moved),
          ...shifts.map((s) => tasksApi.update(s.id, { date_debut: s.date_debut, date_fin: s.date_fin })),
        ]);
        // Annulation : re-persister les dates d'origine de toutes les tâches affectées.
        pushUndo(label, () =>
          Promise.all(
            before.map((b) => tasksApi.update(b.id, { date_debut: b.date_debut, date_fin: b.date_fin })),
          ).then(() => {}),
        );
      } catch (e) {
        setErr(e);
      }
      reload();
    };

    // Au commit du drag (inProgress=false) : persister ; sur refus API, rollback.
    // On ignore nos propres ré-émissions ("cascade"/"rollback") ET celles de SVAR
    // ("update-task" : enfants d'un summary glissé + recalcul du summary parent) :
    // sinon chaque descendant déclencherait un traitement → un undo distinct (bug des
    // 15 undos au drag d'un projet). Le geste racine (summary) est géré en UN bloc.
    api.on("update-task", async (ev) => {
      if (ev.eventSource === "rollback" || ev.eventSource === "cascade" || ev.eventSource === "update-task" || ev.inProgress) return;
      const orig = originalRef.current.get(ev.id);
      originalRef.current.delete(ev.id);
      const parsed = parseSvarId(String(ev.id));
      const t = api.getTask(ev.id);
      if (!parsed || !t?.start) return;
      const date_debut = isoDate(t.start);
      const date_fin = t.end ? isoDate(t.end) : date_debut;
      setErr(null);

      // Tâche : décalage de GROUPE si multi-sélection, sinon cascade FS.
      if (parsed.kind === "task") {
        const movedId = Number(parsed.ref);
        const moved = { date_debut, date_fin };
        const selected = selectedTaskIds(api);

        if (selected.length > 1 && selected.includes(movedId)) {
          // Groupe : les sélectionnées suivent le delta du DÉBUT ; pas de cascade.
          const deltaDays = orig ? daysBetweenIso(isoDate(orig.start), date_debut) : 0;
          const dates = taskDatesFromTasks(tasksRef.current);
          const shifts = planGroupShifts({ movedId, deltaDays, selectedIds: selected, taskDates: dates });
          const before = beforeState(movedId, orig, shifts, dates);
          await applyShiftsAndPersist(movedId, moved, shifts, before, `Décalage de ${before.length} tâche${before.length > 1 ? "s" : ""}`);
          return;
        }

        // Cascade FS sur le graphe COMPLET (dépendances + toutes les tâches, état React
        // frais) : propage même vers un successeur masqué par le filtre équipe.
        const deltaDays = orig && t.end ? daysBetweenIso(isoDate(orig.end), date_fin) : 0;
        const dates = taskDatesFromTasks(tasksRef.current);
        const shifts = planCascadeShifts({
          movedId,
          oldStartIso: orig ? isoDate(orig.start) : date_debut,
          deltaDays,
          edges: fsEdgesFromDeps(depsRef.current),
          taskDates: dates,
        });
        const before = beforeState(movedId, orig, shifts, dates);
        await applyShiftsAndPersist(
          movedId,
          moved,
          shifts,
          before,
          shifts.length ? `Déplacement + ${shifts.length} dépendante${shifts.length > 1 ? "s" : ""}` : "Déplacement tâche",
        );
        return;
      }

      // Projet / epic (summary) : SVAR a déjà déplacé tout le sous-arbre (dates dérivées
      // des enfants). On persiste le BLOC entier — le(s) projet(s) + toutes leurs tâches,
      // masquées comprises — décalé du même delta, et on empile UN SEUL undo (parité :
      // le bloc suit ; pas de cascade FS externe pour un déplacement de bloc).
      if (parsed.kind === "proj" || parsed.kind === "epic") {
        if (!orig) return;
        const deltaDays = daysBetweenIso(isoDate(orig.start), date_debut);
        if (deltaDays === 0) return;
        const { projects: projShifts, tasks: taskShifts } = planBlockShift({
          kind: parsed.kind,
          ref: parsed.ref,
          deltaDays,
          projects: projectsRef.current,
          tasks: tasksRef.current,
        });
        const label =
          parsed.kind === "proj"
            ? `Déplacement projet${taskShifts.length ? ` + ${taskShifts.length} tâche${taskShifts.length > 1 ? "s" : ""}` : ""}`
            : `Déplacement epic (${projShifts.length} projet${projShifts.length > 1 ? "s" : ""})`;
        try {
          await Promise.all([
            ...projShifts.map((s) => projectsApi.update(s.id, s.after)),
            ...taskShifts.map((s) => tasksApi.update(s.id, s.after)),
          ]);
          pushUndo(label, () =>
            Promise.all([
              ...projShifts.map((s) => projectsApi.update(s.id, s.before)),
              ...taskShifts.map((s) => tasksApi.update(s.id, s.before)),
            ]).then(() => {}),
          );
        } catch (e) {
          setErr(e);
        }
        reload();
        return;
      }

      // Jalon : persistance simple (pas de cascade). Rollback visuel si l'API refuse.
      const ref = Number(parsed.ref);
      try {
        await milestonesApi.update(ref, { date: date_debut });
        if (orig) pushUndo("Déplacement jalon", () => milestonesApi.update(ref, { date: isoDate(orig.start) }).then(() => {}));
        reload();
      } catch (e) {
        setErr(e);
        if (orig) {
          api.exec("update-task", {
            id: ev.id,
            task: { start: orig.start, end: orig.end },
            skipUndo: true,
            eventSource: "rollback",
          });
        }
      }
    });

    // — Liens (dépendances) —
    // Avant suppression : mémoriser le lien pour pouvoir le rétablir (rollback).
    api.intercept("delete-link", (ev) => {
      const link = api.getState().links.byId(ev.id);
      if (link) {
        deletedLinkRef.current.set(ev.id, { source: link.source, target: link.target, type: link.type });
      }
      return true;
    });

    // Dessin d'un lien : créer la dépendance. Au succès, réaffecter l'id temporaire
    // à l'id réel (pour une suppression ultérieure). Au refus — ou si le lien n'est
    // pas représentable (extrémité non-tâche, type SF) — retirer le lien.
    api.on("add-link", async (ev) => {
      if (ev.eventSource === "rollback") return; // notre propre rétablissement
      const id = ev.id;
      if (id == null) return;
      const draft = svarLinkToDependency(ev.link);
      if (!draft) {
        api.exec("delete-link", { id });
        setErr(new Error("Lien non pris en charge : une dépendance relie deux tâches (FS, SS ou FF)."));
        return;
      }
      setErr(null);
      try {
        const created = await depsApi.create(draft);
        if (created?.id != null) {
          api.exec("update-link", { id, link: { id: created.id } });
          pushUndo("Création de dépendance", () => depsApi.remove(created.id).then(() => {}));
        }
        reload();
      } catch (e) {
        setErr(e);
        api.exec("delete-link", { id }); // rollback : retirer le lien non persisté
      }
    });

    // Suppression d'un lien : ne persister que les liens réels (id numérique) ; un id
    // temporaire = lien jamais enregistré (création annulée/refusée). Rollback en
    // rétablissant le lien capturé si l'API refuse.
    api.on("delete-link", async (ev) => {
      const captured = deletedLinkRef.current.get(ev.id);
      deletedLinkRef.current.delete(ev.id);
      if (typeof ev.id !== "number") return; // lien non persisté : rien à faire
      setErr(null);
      try {
        await depsApi.remove(ev.id);
        const draft = captured ? svarLinkToDependency(captured) : null;
        if (draft) pushUndo("Suppression de dépendance", () => depsApi.create(draft).then(() => {}));
        reload();
      } catch (e) {
        setErr(e);
        if (captured) {
          api.exec("add-link", { link: { id: ev.id, ...captured }, eventSource: "rollback" });
        }
      }
    });
  }, [reload, pushUndo]);

  return (
    <>
      <h2>Planning</h2>
      <div className="svar-controls">
        <div className="svar-zoom" role="group" aria-label="Zoom">
          {ZOOM_ORDER.map((z) => (
            <button
              key={z}
              type="button"
              className={zoom === z ? "active" : ""}
              aria-pressed={zoom === z}
              onClick={() => setZoom(z)}
            >
              {ZOOMS[z].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`svar-toggle${groupByEpic ? " active" : ""}`}
          aria-pressed={groupByEpic}
          onClick={() => setGroupByEpic((v) => !v)}
          title="Afficher une ligne d'en-tête par epic"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {groupByEpic ? "folder_open" : "folder"}
          </span>
          Grouper par epic
        </button>
        <button
          type="button"
          className="svar-today"
          onClick={() => apiRef.current?.exec("scroll-chart", { date: startOfToday() })}
          title="Recentrer sur aujourd'hui"
        >
          <span className="material-symbols-outlined" aria-hidden="true">today</span>
          Aujourd'hui : {fmtDate(new Date())}
        </button>
        <button
          type="button"
          className="svar-toggle"
          onClick={() => setPanelTarget({ type: "milestone-new" })}
          title="Créer un jalon"
        >
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
          Jalon
        </button>
        <button
          type="button"
          className="svar-toggle"
          disabled={selectedProjectId === null}
          onClick={() =>
            selectedProjectId !== null && setPanelTarget({ type: "task-new", projet_id: selectedProjectId })
          }
          title={
            selectedProjectId === null
              ? "Sélectionner d'abord un projet pour y ajouter une tâche"
              : "Créer une tâche dans le projet sélectionné"
          }
        >
          <span className="material-symbols-outlined" aria-hidden="true">add_task</span>
          Tâche
        </button>
        <button
          type="button"
          className="svar-today svar-undo"
          disabled={undoStack.length === 0 || undoing}
          title={
            undoStack.length > 0
              ? `Annuler : ${undoStack[undoStack.length - 1].label} (Ctrl+Z)`
              : "Rien à annuler"
          }
          onClick={performUndo}
        >
          <span className="material-symbols-outlined" aria-hidden="true">undo</span>
          Annuler{undoStack.length > 0 ? ` (${undoStack.length})` : ""}
        </button>
      </div>
      {equipes.length > 0 && (
        <div className="svar-teams">
          <span className="svar-teams-label">
            <span className="material-symbols-outlined" aria-hidden="true">groups</span>
            Filtrer par équipe :
          </span>
          {equipes.map((eq) => {
            const active = selectedTeamIds.has(eq.id);
            return (
              <button
                key={eq.id}
                type="button"
                className={`svar-chip${active ? " active" : ""}`}
                aria-pressed={active}
                title={`${eq.nom} · ${eq.temps_dispo_hebdo} h/sem`}
                onClick={() =>
                  setSelectedTeamIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(eq.id)) next.delete(eq.id);
                    else next.add(eq.id);
                    return next;
                  })
                }
              >
                {eq.nom}
              </button>
            );
          })}
          {selectedTeamIds.size > 0 && (
            <button
              type="button"
              className="svar-chip-reset"
              title="Vider le filtre équipe"
              onClick={() => setSelectedTeamIds(new Set())}
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
              Réinitialiser
            </button>
          )}
        </div>
      )}
      <ErrorBanner error={err} />
      <div className={`svar-planning${zoom === "month" ? " zoom-mois" : ""}`}>
        <Willow>
          <Gantt
            columns={COLONNES}
            tasks={svarTasks}
            links={svarLinks}
            scales={ZOOMS[zoom].scales}
            cellWidth={ZOOMS[zoom].cellWidth}
            highlightTime={highlightToday}
            taskTemplate={TaskBar}
            init={onInit}
          />
        </Willow>
      </div>
      <EditPanel target={panelTarget} onClose={() => setPanelTarget(null)} onSaved={reload} />
    </>
  );
}
