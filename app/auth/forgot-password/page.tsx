/**
 * Page that renders the forgot-password form.
 */
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AuthPageHeader backHref="/auth/login" />
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
