import { useEffect, useState } from "react";
import {
  epics as epicsApi,
  equipes as equipesApi,
  projects as projectsApi,
  users as usersApi,
} from "../api/endpoints";
import type { Epic, Equipe, Project } from "../types";

// Option vide, TOUJOURS rendue — y compris quand le champ est requis.
//
// Sans elle, un état vide ne correspond à aucune option : le navigateur affiche
// alors la PREMIÈRE de la liste, pendant que React garde `""`. L'utilisateur voit
// un epic sélectionné qu'il n'a pas choisi, et l'envoi part sans epic — l'API le
// refuse (`String should have at least 3 characters`), ce qui n'a aucun sens vu
// de l'écran. Le `required` HTML ne rattrapait rien non plus : une option à valeur
// non vide passe pour choisie, donc la validation native laissait soumettre.
//
// La rendre restaure les deux : ce qui est affiché correspond à l'état, et le
// navigateur bloque la soumission tant que rien n'est choisi.
function OptionVide({ required }: { required?: boolean }) {
  return <option value="">{required ? "— Choisir —" : "—"}</option>;
}

interface UserSelectProps {
  value: number | null;
  onChange: (id: number | null) => void;
  required?: boolean;
  /** Relie le champ à son `<label htmlFor>`. Les libellés sont des FRÈRES du
   *  contrôle dans la grille du formulaire, jamais des parents : sans cet
   *  identifiant, rien ne les associe — ni pour un lecteur d'écran, ni au clic. */
  id?: string;
  /** Forme minimale : `id` + `nom` suffisent à peupler le sélecteur. Accepte
   *  aussi bien un `User` complet que l'annuaire réduit (cf. C7). */
  users?: { id: number; nom: string }[];
}

export function UserSelect({ value, onChange, required, id, users: provided }: UserSelectProps) {
  const [users, setUsers] = useState<{ id: number; nom: string }[]>(provided ?? []);
  useEffect(() => {
    if (provided) {
      setUsers(provided);
      return;
    }
    usersApi.annuaire().then(setUsers).catch(() => {});
  }, [provided]);
  return (
    <select
      id={id}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      required={required}
    >
      <OptionVide required={required} />
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
  /** Relie le champ à son `<label htmlFor>` (cf. UserSelectProps). */
  id?: string;
  epics?: Epic[];
}

export function EpicSelect({ value, onChange, required, id, epics: provided }: EpicSelectProps) {
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
      id={id}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <OptionVide required={required} />
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
  /** Relie le champ à son `<label htmlFor>` (cf. UserSelectProps). */
  id?: string;
  projects?: Project[];
  epicTrigramme?: string; // si défini, filtre les projets de cet epic
}

export function ProjectSelect({
  value,
  onChange,
  required,
  id,
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
      id={id}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      required={required}
    >
      <OptionVide required={required} />
      {filtered.map((p) => (
        <option key={p.id} value={p.id}>{p.nom}</option>
      ))}
    </select>
  );
}

interface EquipeSelectProps {
  value: number | null;
  onChange: (id: number | null) => void;
  required?: boolean;
  /** Relie le champ à son `<label htmlFor>` (cf. UserSelectProps). */
  id?: string;
  equipes?: Equipe[];
}

export function EquipeSelect({ value, onChange, required, id, equipes: provided }: EquipeSelectProps) {
  const [equipes, setEquipes] = useState<Equipe[]>(provided ?? []);
  useEffect(() => {
    if (provided) {
      setEquipes(provided);
      return;
    }
    equipesApi.list().then(setEquipes).catch(() => {});
  }, [provided]);
  return (
    <select
      id={id}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      required={required}
    >
      <OptionVide required={required} />
      {equipes.map((eq) => (
        <option key={eq.id} value={eq.id}>{eq.nom}</option>
      ))}
    </select>
  );
}
