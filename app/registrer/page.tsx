import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import RegistrerClient from "./wrappedPage";

function safeNext(next?: string) {
    // kun interne paths
    if (!next) return "/utstyr";
    if (!next.startsWith("/")) return "/utstyr";
    if (next.startsWith("//")) return "/utstyr";
    return next;
}

export default async function RegistrerPage({
    searchParams,
}: {
    searchParams: { next?: string };
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const next = safeNext(searchParams?.next);

    const { data: profile } = await supabase
        .from("profiles")
        .select("firstname, lastname, img_path, img_type")
        .eq("id", user.id)
        .single();

    const isComplete = Boolean(profile?.firstname && profile?.lastname);

    if (isComplete) redirect(next);

    return <RegistrerClient nextPath={next} />;
}