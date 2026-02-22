import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizePrivilege } from "@/lib/privilege-checks";
import { PRIVILEGE_REQUIREMENTS } from "@/lib/privilege-config";

/**
 * Shared server-side authorization guard for admin API routes.
 * Centralizes auth/session checks + privilege checks before mutations run.
 */
type AssertPermissionOptions = {
  minPrivilege?: number;
  requirement?: keyof typeof PRIVILEGE_REQUIREMENTS;
  forbiddenMessage?: string;
  check?: (context: {
    userId: string;
    privilege: number;
  }) => boolean;
};

type AssertPermissionSuccess = {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  privilege: number;
};

type AssertPermissionFailure = {
  ok: false;
  response: NextResponse<{ error: string }>;
};

type AssertPermissionResult = AssertPermissionSuccess | AssertPermissionFailure;

const deny = (status: number, error: string): AssertPermissionFailure => ({
  ok: false,
  response: NextResponse.json({ error }, { status }),
});

/**
 * Shared API guard:
 * - validates authenticated session
 * - loads current privilege from public.members
 * - applies min-privilege and optional custom rule
 */
export async function assertPermission(options: AssertPermissionOptions = {}): Promise<AssertPermissionResult> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return deny(401, "Mangler tilgang.");
  }

  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select("privilege_type")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (memberError) {
    return deny(500, memberError.message);
  }

  const privilege = normalizePrivilege(memberData?.privilege_type);
  const requiredFromConfig =
    options.requirement ? PRIVILEGE_REQUIREMENTS[options.requirement] : null;
  const minPrivilege = options.minPrivilege ?? requiredFromConfig ?? null;
  const context = {
    userId: authData.user.id,
    privilege,
  };

  if (minPrivilege !== null && privilege < minPrivilege) {
    return deny(403, options.forbiddenMessage ?? "Mangler tilgang.");
  }

  if (options.check && !options.check(context)) {
    return deny(403, options.forbiddenMessage ?? "Mangler tilgang.");
  }

  return {
    ok: true,
    supabase,
    userId: context.userId,
    privilege: context.privilege,
  };
}
