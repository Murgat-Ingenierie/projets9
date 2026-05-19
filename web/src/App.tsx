import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import LoginPage from "./pages/LoginPage";
import GanttPage from "./pages/GanttPage";
import EpicsPage from "./pages/EpicsPage";
import EpicDetailPage from "./pages/EpicDetailPage";
import ProjectsPage from "./pages/ProjectsPage";
import TasksPage from "./pages/TasksPage";
import MilestonesPage from "./pages/MilestonesPage";
import DependenciesPage from "./pages/DependenciesPage";
import UsersPage from "./pages/UsersPage";

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
        <Route path="/epics/:trigramme" element={<Protected><EpicDetailPage /></Protected>} />
        <Route path="/projects" element={<Protected><ProjectsPage /></Protected>} />
        <Route path="/tasks" element={<Protected><TasksPage /></Protected>} />
        <Route path="/milestones" element={<Protected><MilestonesPage /></Protected>} />
        <Route path="/dependencies" element={<Protected><DependenciesPage /></Protected>} />
        <Route path="/users" element={<Protected><UsersPage /></Protected>} />
      </Routes>
    </AuthProvider>
  );
}
