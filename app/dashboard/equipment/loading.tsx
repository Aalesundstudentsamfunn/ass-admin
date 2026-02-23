import { DashboardLoadingScreen } from "@/components/dashboard/loading-screen";

/**
 * Renders loading equipment page.
 *
 */
export default function LoadingEquipmentPage() {
  return (
    <DashboardLoadingScreen
      title="Laster utstyr"
      description="Henter utstyr, grupper og tilgjengelighet…"
    />
  );
}
