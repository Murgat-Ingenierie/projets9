import { useEffect, useState, type ReactNode } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { useEcranEtroit } from "./hooks/useEcranEtroit";
import EpicsPage from "./pages/EpicsPage";
import EpicNewPage from "./pages/EpicNewPage";
import EpicDetailPage from "./pages/EpicDetailPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectNewPage from "./pages/ProjectNewPage";
import ProjectEditPage from "./pages/ProjectEditPage";
import TasksPage from "./pages/TasksPage";
import TaskNewPage from "./pages/TaskNewPage";
import TaskEditPage from "./pages/TaskEditPage";
import MilestonesPage from "./pages/MilestonesPage";
import MilestoneNewPage from "./pages/MilestoneNewPage";
import DependenciesPage from "./pages/DependenciesPage";
import DependencyNewPage from "./pages/DependencyNewPage";
import UsersPage from "./pages/UsersPage";
import UserNewPage from "./pages/UserNewPage";
import EquipesPage from "./pages/EquipesPage";
import EquipeNewPage from "./pages/EquipeNewPage";
import ChargeEquipesPage from "./pages/ChargeEquipesPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import GanttSvarPage from "./pages/GanttSvarPage";
import ParametresPage from "./pages/ParametresPage";

interface NavItem {
  to: string;
  end?: boolean;
  icon: string;
  label: string;
}

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined">{name}</span>;
}

function Sidebar({
  expanded,
  onToggle,
  onNaviguer,
  etroit,
}: {
  expanded: boolean;
  onToggle: () => void;
  onNaviguer: () => void;
  etroit: boolean;
}) {
  const { user, deconnexion } = useAuth();

  const items: NavItem[] = [
    // Le planning est inatteignable sous le seuil (cf. la route « / ») : y laisser
    // une entrée donnerait un lien qui renvoie systématiquement ailleurs, ce qui
    // est plus déroutant que son absence.
    ...(etroit ? [] : [{ to: "/", end: true, icon: "view_timeline", label: "Planning" } as NavItem]),
    { to: "/epics", icon: "folder_special", label: "Epics" },
    { to: "/projects", icon: "category", label: "Projets" },
    { to: "/tasks", icon: "task_alt", label: "Tâches" },
    { to: "/milestones", icon: "flag", label: "Jalons" },
    { to: "/dependencies", icon: "account_tree", label: "Dépendances" },
    { to: "/equipes", icon: "groups", label: "Équipes" },
    { to: "/charge", icon: "monitoring", label: "Charge équipes" },
  ];
  if (user?.role === "admin") {
    items.push({ to: "/users", icon: "group", label: "Utilisateurs" });
    items.push({ to: "/parametres", icon: "settings", label: "Paramètres" });
  }

  return (
    <aside className={`sidebar ${expanded ? "expanded" : ""}`}>
      <div className="sidebar-top">
        <button
          type="button"
          className="hamburger"
          onClick={onToggle}
          title={expanded ? "Réduire le menu" : "Étendre le menu"}
        >
          <Icon name="menu" />
        </button>
        <span className="brand">Gestion de projet</span>
      </div>
      <nav>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} title={it.label} onClick={onNaviguer}>
            <Icon name={it.icon} />
            <span className="label">{it.label}</span>
          </NavLink>
        ))}
      </nav>
      {user && (
        <div className="me">
          <div className="user-name">{user.nom}</div>
          <button type="button" className="logout" onClick={deconnexion} title="Se déconnecter">
            <Icon name="logout" />
            <span className="label">Déconnexion</span>
          </button>
        </div>
      )}
    </aside>
  );
}

/** Planning sur écran large, redirection vers Projets sur écran étroit. */
function PlanningOuProjets() {
  const etroit = useEcranEtroit();
  if (etroit) return <Navigate to="/projects" replace />;
  return <GanttSvarPage />;
}

// Le garde de route vit dans AuthProvider : il redirige vers Keycloak avant même
// de rendre quoi que ce soit. Ici on attend seulement que l'utilisateur soit
// résolu, pour éviter un flash de sidebar sans nom.
function Layout({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const etroit = useEcranEtroit();

  // Repasser en large avec le tiroir ouvert laisserait la barre en mode déplié
  // (240 px) alors qu'on attend le rail. On referme au franchissement du seuil.
  useEffect(() => {
    setExpanded(false);
  }, [etroit]);

  if (loading) return <div className="layout"><main className="main">Chargement…</main></div>;
  return (
    <div className={`layout ${expanded ? "sidebar-expanded" : ""}${etroit ? " etroit" : ""}`}>
      {/* Bouton d'ouverture RENDU À PART : sur écran étroit la barre sort
          entièrement du champ, emportant avec elle le burger qu'elle contient.
          Celui du tiroir sert alors à refermer, celui-ci à ouvrir. Masqué au-delà
          du seuil, où le rail reste visible en permanence. */}
      <button
        type="button"
        className="ouvre-tiroir"
        onClick={() => setExpanded(true)}
        aria-label="Ouvrir le menu"
        aria-expanded={expanded}
      >
        <Icon name="menu" />
      </button>
      {/* Voile : referme au clic hors du tiroir, et signale qu'il est modal.
          `aria-hidden` car il ne porte aucun contenu — la fermeture au clavier
          passe par le burger, qui reste dans l'ordre de tabulation. */}
      {etroit && expanded && (
        <div className="voile-tiroir" onClick={() => setExpanded(false)} aria-hidden />
      )}
      <Sidebar
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        // Sur écran étroit, suivre un lien doit refermer le tiroir : il recouvre
        // la page, on ne verrait pas où l'on vient d'arriver.
        onNaviguer={() => etroit && setExpanded(false)}
        etroit={etroit}
      />
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Le planning n'est pas rendu sur écran étroit, et pas seulement caché :
            un Gantt sur 375 px n'a aucun sens, et le construire coûterait sept
            requêtes pour un rendu illisible. `replace` plutôt qu'un empilement,
            sinon le retour arrière renverrait ici et rebondirait en boucle. */}
        <Route path="/" element={<Layout><PlanningOuProjets /></Layout>} />
        <Route path="/parametres" element={<Layout><ParametresPage /></Layout>} />
        {/* Retour de Keycloak. HORS `Layout` : tant qu'on ne sait pas qui entre,
            afficher la barre latérale laisserait croire l'application ouverte.
            La page quitte les lieux par une navigation du routeur — cf. sa
            docstring, et le défaut qu'elle corrige. */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route path="/epics" element={<Layout><EpicsPage /></Layout>} />
        <Route path="/epics/new" element={<Layout><EpicNewPage /></Layout>} />
        <Route path="/epics/:trigramme/edit" element={<Layout><EpicDetailPage /></Layout>} />
        <Route path="/epics/:trigramme" element={<Layout><EpicDetailPage /></Layout>} />

        <Route path="/projects" element={<Layout><ProjectsPage /></Layout>} />
        <Route path="/projects/new" element={<Layout><ProjectNewPage /></Layout>} />
        <Route path="/projects/:id/edit" element={<Layout><ProjectEditPage /></Layout>} />

        <Route path="/tasks" element={<Layout><TasksPage /></Layout>} />
        <Route path="/tasks/new" element={<Layout><TaskNewPage /></Layout>} />
        <Route path="/tasks/:id/edit" element={<Layout><TaskEditPage /></Layout>} />

        <Route path="/milestones" element={<Layout><MilestonesPage /></Layout>} />
        <Route path="/milestones/new" element={<Layout><MilestoneNewPage /></Layout>} />

        <Route path="/dependencies" element={<Layout><DependenciesPage /></Layout>} />
        <Route path="/dependencies/new" element={<Layout><DependencyNewPage /></Layout>} />

        <Route path="/users" element={<Layout><UsersPage /></Layout>} />
        <Route path="/users/new" element={<Layout><UserNewPage /></Layout>} />

        <Route path="/equipes" element={<Layout><EquipesPage /></Layout>} />
        <Route path="/equipes/new" element={<Layout><EquipeNewPage /></Layout>} />
        <Route path="/charge" element={<Layout><ChargeEquipesPage /></Layout>} />
      </Routes>
    </AuthProvider>
  );
}
