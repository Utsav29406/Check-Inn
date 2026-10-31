import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Field, field } from "@/components/admin/ActionForm";
import { AdminAuthCard } from "@/components/admin/AdminAuthCard";
import { adminCount, getCurrentAdmin } from "@/lib/admin";
import { adminLogin } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  const noAdmins = (await adminCount()) === 0;
  return (
    <AdminAuthCard title="Admin sign in" subtitle="For the CheckInn team. Customers sign in on the main site.">
      <ActionForm action={adminLogin} submit="Sign in" className="grid gap-4">
        <Field label="Email">
          <input name="email" type="email" autoComplete="username" required className={field} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required className={field} />
        </Field>
      </ActionForm>
      {noAdmins && (
        <p className="mt-5 text-center text-sm text-muted">
          No admin yet? <Link href="/admin/setup" className="font-semibold text-brand-600">Create the first admin</Link>
        </p>
      )}
    </AdminAuthCard>
  );
}
