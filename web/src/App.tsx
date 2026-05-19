import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import LoginPage from "./pages/LoginPage";
import GanttPage from "./pages/GanttPage";
import EpicsPage from "./pages/EpicsPage";
import EpicNewPage from "./pages/EpicNewPage";
import EpicEditPage from "./pages/EpicEditPage";
import EpicDetailPage from "./pages/EpicDetailPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectNewPage from "./pages/ProjectNewPage";
import ProjectEditPage from "./pages/ProjectEditPage";
import TasksPage from "./pages/TasksPage";
import TaskNewPage from "./pages/TaskNewPage";
import MilestonesPage from "./pages/MilestonesPage";
import MilestoneNewPage from "./pages/MilestoneNewPage";
import DependenciesPage from "./pages/DependenciesPage";
import DependencyNewPage from "./pages/DependencyNewPage";
import UsersPage from "./pages/UsersPage";
import UserNewPage from "./pages/UserNewPage";

function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <aside className="sidebar">
      <h1>Gestion de projet</h1>
      <nav>
        <NavLink to="/" end>Planning</NavLink>
        <NavLink to="/epics">Epics</NavLink>
        <NavLink to="/projects">Projets</NavLink>
        <NavLink to="/tasks">Tâches</NavLink>
        <NavLink to="/milestones">Jalons</NavLink>
        <NavLink to="/dependencies">Dépendances</NavLink>
        {user?.role === "admin" && <NavLink to="/users">Utilisateurs</NavLink>}
      </nav>
      <div className="me">
        Connecté : {user?.nom}
        <br />
        <button
          className="logout"
          onClick={() => {
            logout();
            nav("/login");
          }}
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="layout"><main className="main">Chargement…</main></div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="layout">
      <Sidebar />
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
        <Route path="/epics/:trigramme/edit" element={<Protected><EpicEditPage /></Protected>} />
        <Route path="/epics/:trigramme" element={<Protected><EpicDetailPage /></Protected>} />

        <Route path="/projects" element={<Protected><ProjectsPage /></Protected>} />
        <Route path="/projects/new" element={<Protected><ProjectNewPage /></Protected>} />
        <Route path="/projects/:id/edit" element={<Protected><ProjectEditPage /></Protected>} />

        <Route path="/tasks" element={<Protected><TasksPage /></Protected>} />
        <Route path="/tasks/new" element={<Protected><TaskNewPage /></Protected>} />

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
