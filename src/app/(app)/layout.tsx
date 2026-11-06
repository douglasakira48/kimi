import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { getMember } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const member = await getMember(sb);
  if (!member) redirect("/onboarding");
  return (
    <>
      <main className="shell">{children}</main>
      <BottomNav />
    </>
  );
}
