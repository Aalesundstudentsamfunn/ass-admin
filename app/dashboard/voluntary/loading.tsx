import { DashboardLoadingScreen } from "@/components/dashboard/loading-screen";

/**
 * Loading voluntary page.
 */
export default function LoadingVoluntaryPage() {
  return (
    <DashboardLoadingScreen
      title="Laster frivillige"
      description="Henter frivilligoversikt og tilganger…"
    />
  );
}
