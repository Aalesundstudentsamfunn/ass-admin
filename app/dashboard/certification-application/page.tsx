"use client"
import { createClient } from "@/lib/supabase/client"
import { useCurrentPrivilege } from "@/lib/use-current-privilege"
import CertificationTabs from "@/components/certification/certification-tabs"
import { SupabaseClient } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { canManageCertificates as hasCertificateAccess } from "@/lib/privilege-checks"

type Application = {
  id: number
  created_at: string
  time_accepted: string | null
  certificate_id: number | null
  verified: boolean
  verified_by: string | null
  seeker_id: string | null
  rejected: boolean | null
  cert_image_id: string | null
  notes: string | null
  profiles: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  } | null
  type: {
    id: number;
    type: string
  } | null,
  verified_by_profile?: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  } | null
}

async function getApplications(client: SupabaseClient) {
  // fetch applications and join profiles
  const { data: as_data, error } = await client
    .from("certification_application")
    .select(`
    *,
    profiles:profiles!seeker_id ( id, firstname, lastname,email ),
    type:certificate_type!certificate_id ( id, type ),
    verified_by_profile:profiles!verified_by ( id, firstname, lastname,email )
  `).order("created_at", { ascending: true })

  const data = as_data as Application[];
  await Promise.all(data.map(async d => {
    if (!d.cert_image_id) {
      d.cert_image_id = null;
      return;
    }
    const { data } = await client.storage
      .from("certificates")
      .createSignedUrl(d.cert_image_id, 60); // gyldig i 60 sek
    d.cert_image_id = data?.signedUrl || null;
  }));
  if (error) {
    console.error("Supabase error:", error)
    return []
  }

  return (data || []) as Application[]
}

export default function CertificationPage() {
  const supabase = createClient()
  const [apps, setApps] = useState<Application[]>([])
  const currentPrivilege = useCurrentPrivilege()
  const canManageCertificates = hasCertificateAccess(currentPrivilege)
  useEffect(() => {
    const fetchData = async () => {
      const data = await getApplications(supabase)
      setApps(data)
    }
    fetchData()
  }, [supabase])

  const processed = apps.filter((a) => a.verified || a.rejected)
  const unprocessed = apps.filter((a) => !a.verified && !a.rejected)

  async function handleAccept(appId: number) {
    // mark verified = true, time_accepted = now
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      console.error("No authenticated user found");
      return;
    }
    const { error } = await supabase
      .from("certification_application")
      .update({ verified: true, time_accepted: new Date().toISOString(), rejected: false, verified_by: user.data.user.id })
      .eq("id", appId)

    if (error) {
      console.error("Failed to accept application", error)
      return
    }

    setApps((prev) => prev.map(a => a.id === appId ? { ...a, verified: true, time_accepted: new Date().toISOString(), rejected: false } : a))
  }

  async function handleReject(appId: number) {
    const { error } = await supabase
      .from("certification_application")
      .update({ rejected: true, verified: false })
      .eq("id", appId)

    if (error) {
      console.error("Failed to reject application", error)
      return
    }

    setApps((prev) => prev.map(a => a.id === appId ? { ...a, rejected: true, verified: false } : a))
  }

  async function handleDelete(appId: number) {
    // delete the application row
    const { error } = await supabase
      .from("certification_application")
      .delete()
      .eq("id", appId)

    if (error) {
      console.error("Failed to delete application", error)
      return
    }

    setApps((prev) => prev.filter(a => a.id !== appId))
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Sertifisering</h1>
      <p className="text-sm text-muted-foreground mb-4">Merk: Søkere kan kun ha én aktiv søknad om gangen, og alle brukere må søke gjennom appen. For å søke på nytt etter et avslag må den tidligere søknaden slettes.</p>

      <CertificationTabs
        processed={processed}
        unprocessed={unprocessed}
        onAccept={handleAccept}
        onReject={handleReject}
        onDelete={handleDelete}
        canManage={canManageCertificates}
      />
    </div>
  )
}
