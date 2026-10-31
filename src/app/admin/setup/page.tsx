import { redirect } from "next/navigation";
import { ActionForm, Field, field } from "@/components/admin/ActionForm";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";
import { adminCount } from "@/lib/admin";
import { setupFirstAdmin } from "../actions";

export const dynamic = "force-dynamic";

/** One-time: creates the first admin. Needs the ADMIN_SETUP_CODE from the server's environment. */
export default async function AdminSetupPage() {
  if ((await adminCount()) > 0) redirect("/admin/login");
  return (
    <AdminAuthCard title="Create the first admin" subtitle="Enter the setup code from the ADMIN_SETUP_CODE setting, then choose your admin login.">
      <ActionForm action={setupFirstAdmin} submit="Create admin & sign in" className="grid gap-4">
        <Field label="Setup code">
          <input name="code" autoComplete="off" required className={`${field} font-mono`} />
        </Field>
        <Field label="Your name">
          <input name="name" autoComplete="name" required className={field} />
        </Field>
        <Field label="Admin email">
          <input name="email" type="email" autoComplete="username" required className={field} />
        </Field>
        <Field label="Password" hint="At least 10 characters. Different from your Google password.">
          <input name="password" type="password" autoComplete="new-password" minLength={10} required className={field} />
        </Field>
      </ActionForm>
    </AdminAuthCard>
  );
}
