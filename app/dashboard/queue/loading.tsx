import { DashboardLoadingScreen } from "@/components/dashboard/loading-screen";

export default function LoadingQueuePage() {
  return (
    <DashboardLoadingScreen
      title="Laster printerkø"
      description="Henter utskriftslogger og status…"
      embedded
    />
  );
}
