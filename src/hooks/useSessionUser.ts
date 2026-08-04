import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type SessionInfo = {
  loading: boolean;
  user: User | null;
  isStaff: boolean;
  isAdmin: boolean;
  displayName: string;
};

export async function fetchIsStaff(userId: string) {
  const { data } = await supabase.from("profiles").select("id, role").eq("id", userId).maybeSingle();
  return { isStaff: Boolean(data), role: data?.role ?? null };
}

export function useSessionUser(): SessionInfo {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load(u: User | null) {
      if (!active) return;
      setUser(u);
      if (u) {
        const { role: r } = await fetchIsStaff(u.id);
        if (active) setRole(r);
      } else {
        setRole(null);
      }
      if (active) setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void load(session?.user ?? null);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName = (meta["full_name"] as string) || user?.email || "";

  return { loading, user, isStaff: Boolean(role), isAdmin: role === "admin", displayName };
}
