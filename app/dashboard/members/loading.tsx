import { DashboardLoadingScreen } from "@/components/dashboard/loading-screen";

export default function LoadingMembersPage() {
  return (
    <DashboardLoadingScreen
      title="Laster medlemmer"
      description="Henter medlemsliste og tabelloppsett…"
    />
  );
}
