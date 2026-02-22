"use client";

/**
 * Dashboard page module.
 * Fetches data and renders route-specific admin UI.
 */

import * as React from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useCurrentPrivilege } from "@/lib/use-current-privilege";
import { canManageCertificates as hasCertificateAccess } from "@/lib/privilege-checks";
import CertificationTabs from "@/components/certification/certification-tabs";
import { AppShape } from "@/components/certification/certification-card";

const APPLICATION_SELECT = `
  *,
  profiles:profiles!seeker_id ( id, firstname, lastname, email ),
  type:certificate_type!certificate_id ( id, type ),
  verified_by_profile:profiles!verified_by ( id, firstname, lastname, email )
`;

async function getSignedCertificateUrl(
  client: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) {
    return null;
  }

  const { data, error } = await client.storage
    .from("certificates")
    .createSignedUrl(path, 60);

  if (error) {
    console.error("Could not sign certificate image URL:", error);
    return null;
  }

  return data?.signedUrl ?? null;
}

async function fetchApplications(client: SupabaseClient): Promise<AppShape[]> {
  const { data, error } = await client
    .from("certification_application")
    .select(APPLICATION_SELECT)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase error while loading applications:", error);
    return [];
  }

  const rows = (data ?? []) as AppShape[];
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      cert_image_id: await getSignedCertificateUrl(client, row.cert_image_id),
    })),
  );
}

export default function CertificationApplicationPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const [applications, setApplications] = React.useState<AppShape[]>([]);
  const currentPrivilege = useCurrentPrivilege();
  const canManageCertificates = hasCertificateAccess(currentPrivilege);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      const rows = await fetchApplications(supabase);
      if (active) {
        setApplications(rows);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const processed = React.useMemo(
    () => applications.filter((application) => application.verified || application.rejected),
    [applications],
  );
  const unprocessed = React.useMemo(
    () => applications.filter((application) => !application.verified && !application.rejected),
    [applications],
  );

  const handleAccept = React.useCallback(
    async (applicationId: number) => {
      const { data: authData } = await supabase.auth.getUser();
      const actorId = authData.user?.id;
      if (!actorId) {
        console.error("No authenticated user found.");
        return;
      }

      const acceptedAt = new Date().toISOString();
      const { error } = await supabase
        .from("certification_application")
        .update({
          verified: true,
          time_accepted: acceptedAt,
          rejected: false,
          verified_by: actorId,
        })
        .eq("id", applicationId);

      if (error) {
        console.error("Failed to accept application:", error);
        return;
      }

      setApplications((prev) =>
        prev.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                verified: true,
                rejected: false,
                time_accepted: acceptedAt,
                verified_by: actorId,
              }
            : application,
        ),
      );
    },
    [supabase],
  );

  const handleReject = React.useCallback(
    async (applicationId: number) => {
      const { error } = await supabase
        .from("certification_application")
        .update({ rejected: true, verified: false })
        .eq("id", applicationId);

      if (error) {
        console.error("Failed to reject application:", error);
        return;
      }

      setApplications((prev) =>
        prev.map((application) =>
          application.id === applicationId
            ? { ...application, rejected: true, verified: false }
            : application,
        ),
      );
    },
    [supabase],
  );

  const handleDelete = React.useCallback(
    async (applicationId: number) => {
      const { error } = await supabase
        .from("certification_application")
        .delete()
        .eq("id", applicationId);

      if (error) {
        console.error("Failed to delete application:", error);
        return;
      }

      setApplications((prev) =>
        prev.filter((application) => application.id !== applicationId),
      );
    },
    [supabase],
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Sertifisering</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Merk: Søkere kan kun ha én aktiv søknad om gangen, og alle brukere må
        søke gjennom appen. For å søke på nytt etter et avslag må den tidligere
        søknaden slettes.
      </p>

      <CertificationTabs
        processed={processed}
        unprocessed={unprocessed}
        onAccept={handleAccept}
        onReject={handleReject}
        onDelete={handleDelete}
        canManage={canManageCertificates}
      />
    </div>
  );
}
