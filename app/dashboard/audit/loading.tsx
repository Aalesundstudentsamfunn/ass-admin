import { DashboardLoadingScreen } from "@/components/dashboard/loading-screen";

/**
 * Renders loading audit page.
 *
 */
export default function LoadingAuditPage() {
  return (
    <DashboardLoadingScreen
      title="Laster auditlogg"
      description="Henter hendelser og forbereder detaljer…"
    />
  );
}
