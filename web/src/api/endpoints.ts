import type {
  Dependency,
  Epic,
  LoginResponse,
  Measure,
  Milestone,
  Project,
  Task,
  User,
} from "../types";
import { api } from "./client";

export const auth = {
  login: (email: string, password: string) =>
    api<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
};

export const users = {
  list: () => api<User[]>("/api/users"),
  me: () => api<User>("/api/users/me"),
  create: (data: Partial<User> & { password: string }) =>
    api<User>("/api/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<User> & { password?: string }) =>
    api<User>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: number) => api<void>(`/api/users/${id}`, { method: "DELETE" }),
};

export const epics = {
  list: () => api<Epic[]>("/api/epics"),
  get: (trigramme: string) => api<Epic>(`/api/epics/${trigramme}`),
  create: (data: Partial<Epic> & { trigramme: string; nom: string }) =>
    api<Epic>("/api/epics", { method: "POST", body: JSON.stringify(data) }),
  update: (trigramme: string, data: Partial<Epic>) =>
    api<Epic>(`/api/epics/${trigramme}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (trigramme: string) =>
    api<void>(`/api/epics/${trigramme}`, { method: "DELETE" }),
};

export const projects = {
  list: (epic?: string) =>
    api<Project[]>(`/api/projects${epic ? `?epic=${epic}` : ""}`),
  create: (data: Partial<Project>) =>
    api<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Project>) =>
    api<Project>(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) => api<void>(`/api/projects/${id}`, { method: "DELETE" }),
};

export const tasks = {
  list: (projet_id?: number) =>
    api<Task[]>(`/api/tasks${projet_id ? `?projet_id=${projet_id}` : ""}`),
  create: (data: Partial<Task>) =>
    api<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Task>) =>
    api<Task>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: number) => api<void>(`/api/tasks/${id}`, { method: "DELETE" }),
};

export const milestones = {
  list: (params: { epic?: string; projet_id?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.epic) q.set("epic", params.epic);
    if (params.projet_id) q.set("projet_id", String(params.projet_id));
    const s = q.toString();
    return api<Milestone[]>(`/api/milestones${s ? `?${s}` : ""}`);
  },
  create: (data: Partial<Milestone>) =>
    api<Milestone>("/api/milestones", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<Milestone>) =>
    api<Milestone>(`/api/milestones/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    api<void>(`/api/milestones/${id}`, { method: "DELETE" }),
};

export const dependencies = {
  list: () => api<Dependency[]>("/api/dependencies"),
  create: (data: Partial<Dependency>) =>
    api<Dependency>("/api/dependencies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  remove: (id: number) =>
    api<void>(`/api/dependencies/${id}`, { method: "DELETE" }),
};

export const measures = {
  list: (epic?: string) =>
    api<Measure[]>(`/api/measures${epic ? `?epic=${epic}` : ""}`),
  create: (data: Partial<Measure>) =>
    api<Measure>("/api/measures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: Partial<Measure>) =>
    api<Measure>(`/api/measures/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (id: number) => api<void>(`/api/measures/${id}`, { method: "DELETE" }),
};
