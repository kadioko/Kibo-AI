import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { isAppAdmin } from "@/lib/admin";

export default async function GroupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = user ? await isAppAdmin(user.id) : false;
  return <AppShell email={user?.email} isAdmin={admin}>{children}</AppShell>;
}
