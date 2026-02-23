/**
 * Login page for staff/admin members.
 */
import { LoginForm } from "@/components/auth/login-form";
import { AuthPageHeader } from "@/components/auth/auth-page-header";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AuthPageHeader backHref="/" />
        <LoginForm />
      </div>
    </div>
  );
}
