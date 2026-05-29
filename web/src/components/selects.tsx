import { useEffect, useState } from "react";
import { epics as epicsApi, projects as projectsApi, users as usersApi } from "../api/endpoints";
import type { Epic, Project, User } from "../types";

interface UserSelectProps {
  value: number | null;
  onChange: (id: number | null) => void;
  required?: boolean;
  users?: User[]; // si déjà chargés à l'extérieur, on évite un fetch
}

export function UserSelect({ value, onChange, required, users: provided }: UserSelectProps) {
  const [users, setUsers] = useState<User[]>(provided ?? []);
  useEffect(() => {
    if (provided) {
      setUsers(provided);
      return;
    }
    usersApi.list().then(setUsers).catch(() => {});
  }, [provided]);
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      required={required}
    >
      <option value="">—</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>{u.nom}</option>
      ))}
    </select>
  );
}

interface EpicSelectProps {
  value: string;
  onChange: (trigramme: string) => void;
  required?: boolean;
  epics?: Epic[];
}

export function EpicSelect({ value, onChange, required, epics: provided }: EpicSelectProps) {
  const [epics, setEpics] = useState<Epic[]>(provided ?? []);
  useEffect(() => {
    if (provided) {
      setEpics(provided);
      return;
    }
    epicsApi.list().then(setEpics).catch(() => {});
  }, [provided]);
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      {!required && <option value="">—</option>}
      {epics.map((e) => (
        <option key={e.trigramme} value={e.trigramme}>{e.nom}</option>
      ))}
    </select>
  );
}

interface ProjectSelectProps {
  value: number | null;
  onChange: (id: number | null) => void;
  required?: boolean;
  projects?: Project[];
  epicTrigramme?: string; // si défini, filtre les projets de cet epic
}

export function ProjectSelect({
  value,
  onChange,
  required,
  projects: provided,
  epicTrigramme,
}: ProjectSelectProps) {
  const [projects, setProjects] = useState<Project[]>(provided ?? []);
  useEffect(() => {
    if (provided) {
      setProjects(provided);
      return;
    }
    projectsApi.list().then(setProjects).catch(() => {});
  }, [provided]);
  const filtered = epicTrigramme
    ? projects.filter((p) => p.epic_trigramme === epicTrigramme)
    : projects;
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      required={required}
    >
      {!required && <option value="">—</option>}
      {filtered.map((p) => (
        <option key={p.id} value={p.id}>{p.nom}</option>
      ))}
    </select>
  );
}
