import React, { createContext, useContext, useEffect, useState } from "react";
import { users } from "./api/endpoints";
import type { User } from "./types";

// Auth débrayée en attendant Keycloak : plus de login ni de guard côté front.
// L'API tourne en AUTH_DISABLED, donc users.me() renvoie l'admin par défaut —
// on le garde pour l'affichage (nom, nav admin) et l'audit updated_by.
interface AuthCtx {
  user: User | null;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    users
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
