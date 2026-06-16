import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface AuthState {
  loading: boolean;
  user: User | null;
  roles: AppRole[];
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, user: null, roles: [] });

  useEffect(() => {
    let mounted = true;

    async function loadRoles(userId: string): Promise<AppRole[]> {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) return [];
      return (data ?? []).map((r) => r.role as AppRole);
    }

    async function sync(user: User | null) {
      if (!mounted) return;
      if (!user) {
        setState({ loading: false, user: null, roles: [] });
        return;
      }
      const roles = await loadRoles(user.id);
      if (!mounted) return;
      setState({ loading: false, user, roles });
    }

    supabase.auth.getUser().then(({ data }) => sync(data.user ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        void sync(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function hasRole(roles: AppRole[], role: AppRole): boolean {
  return roles.includes(role);
}

export function isStaffOrAdmin(roles: AppRole[]): boolean {
  return roles.includes("admin") || roles.includes("staff");
}
