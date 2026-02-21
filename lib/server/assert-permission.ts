import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizePrivilege } from "@/lib/privilege-checks";
import { PRIVILEGE_REQUIREMENTS } from "@/lib/privilege-config";

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
    return {
      ok: false,
      response: NextResponse.json({ error: "Mangler tilgang." }, { status: 401 }),
    };
  }

  const { data: memberData, error: memberError } = await supabase
    .from("members")
    .select("privilege_type")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (memberError) {
    return {
      ok: false,
      response: NextResponse.json({ error: memberError.message }, { status: 500 }),
    };
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
    return {
      ok: false,
      response: NextResponse.json(
        { error: options.forbiddenMessage ?? "Mangler tilgang." },
        { status: 403 },
      ),
    };
  }

  if (options.check && !options.check(context)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: options.forbiddenMessage ?? "Mangler tilgang." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    supabase,
    userId: context.userId,
    privilege: context.privilege,
  };
}
