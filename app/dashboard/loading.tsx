import { DashboardLoadingScreen } from "@/components/dashboard/loading-screen";

export default function LoadingDashboardPage() {
  return (
    <DashboardLoadingScreen
      title="Laster dashboard"
      description="Henter data og klargjør adminvisningen…"
      embedded
    />
  );
}
