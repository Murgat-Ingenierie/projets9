import { useState, type ReactNode } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import GanttPage from "./pages/GanttPage";
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
import GanttSvarPrototype from "./pages/GanttSvarPrototype"; // PROTO Phase 2a — à retirer

interface NavItem {
  to: string;
  end?: boolean;
  icon: string;
  label: string;
}

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined">{name}</span>;
}

function Sidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { user } = useAuth();

  const items: NavItem[] = [
    { to: "/", end: true, icon: "view_timeline", label: "Planning" },
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
          <NavLink key={it.to} to={it.to} end={it.end} title={it.label}>
            <Icon name={it.icon} />
            <span className="label">{it.label}</span>
          </NavLink>
        ))}
      </nav>
      {user && (
        <div className="me">
          <div className="user-name">{user.nom}</div>
        </div>
      )}
    </aside>
  );
}

// Auth débrayée (AUTH_DISABLED côté API, Keycloak à venir) : plus de guard ni de
// redirection login, juste la mise en page. On attend que users.me() résolve
// (l'admin par défaut) pour éviter un flash de sidebar sans nom.
function Layout({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const [expanded, setExpanded] = useState(false);
  if (loading) return <div className="layout"><main className="main">Chargement…</main></div>;
  return (
    <div className={`layout ${expanded ? "sidebar-expanded" : ""}`}>
      <Sidebar expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/proto-svar" element={<GanttSvarPrototype />} /> {/* PROTO Phase 2a — non listé, à retirer */}
        <Route path="/" element={<Layout><GanttPage /></Layout>} />

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
