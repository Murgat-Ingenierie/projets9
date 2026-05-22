import { useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import LoginPage from "./pages/LoginPage";
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
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const items: NavItem[] = [
    { to: "/", end: true, icon: "view_timeline", label: "Planning" },
    { to: "/epics", icon: "folder_special", label: "Epics" },
    { to: "/projects", icon: "category", label: "Projets" },
    { to: "/tasks", icon: "task_alt", label: "Tâches" },
    { to: "/milestones", icon: "flag", label: "Jalons" },
    { to: "/dependencies", icon: "account_tree", label: "Dépendances" },
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
      <div className="me">
        <div className="user-name">{user?.nom}</div>
        <button
          type="button"
          className="logout"
          title="Déconnexion"
          onClick={() => {
            logout();
            nav("/login");
          }}
        >
          <Icon name="logout" />
          <span className="label">Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [expanded, setExpanded] = useState(false);
  if (loading) return <div className="layout"><main className="main">Chargement…</main></div>;
  if (!user) return <Navigate to="/login" replace />;
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Protected><GanttPage /></Protected>} />

        <Route path="/epics" element={<Protected><EpicsPage /></Protected>} />
        <Route path="/epics/new" element={<Protected><EpicNewPage /></Protected>} />
        <Route path="/epics/:trigramme/edit" element={<Protected><EpicDetailPage /></Protected>} />
        <Route path="/epics/:trigramme" element={<Protected><EpicDetailPage /></Protected>} />

        <Route path="/projects" element={<Protected><ProjectsPage /></Protected>} />
        <Route path="/projects/new" element={<Protected><ProjectNewPage /></Protected>} />
        <Route path="/projects/:id/edit" element={<Protected><ProjectEditPage /></Protected>} />

        <Route path="/tasks" element={<Protected><TasksPage /></Protected>} />
        <Route path="/tasks/new" element={<Protected><TaskNewPage /></Protected>} />
        <Route path="/tasks/:id/edit" element={<Protected><TaskEditPage /></Protected>} />

        <Route path="/milestones" element={<Protected><MilestonesPage /></Protected>} />
        <Route path="/milestones/new" element={<Protected><MilestoneNewPage /></Protected>} />

        <Route path="/dependencies" element={<Protected><DependenciesPage /></Protected>} />
        <Route path="/dependencies/new" element={<Protected><DependencyNewPage /></Protected>} />

        <Route path="/users" element={<Protected><UsersPage /></Protected>} />
        <Route path="/users/new" element={<Protected><UserNewPage /></Protected>} />
      </Routes>
    </AuthProvider>
  );
}
