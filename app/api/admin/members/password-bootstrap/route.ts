/**
 * POST /api/admin/members/password-bootstrap
 * Sets temporary passwords for one or more members and sends one-time password emails.
 * Access is restricted to IT members.
 */
import { NextResponse } from "next/server";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/server/assert-permission";
import { canUseBulkTemporaryPasswordAction } from "@/lib/server/temporary-password-access";
import { logAdminAction } from "@/lib/server/admin-audit-log";
import {
  getTemporaryPasswordEmailReadinessError,
  sendTemporaryPasswordEmail,
} from "@/lib/server/temporary-password-email";

/**
 * Bulk bootstrap flow:
 * - generate unique temp password per member
 * - set auth password + user metadata
 * - send one-time password email via configured provider
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const idsFromArray: string[] = Array.isArray(body?.member_ids)
      ? body.member_ids
          .map((value: unknown) => String(value ?? "").trim())
          .filter((value: string): value is string => Boolean(value))
      : [];
    const singleId = String(body?.member_id ?? "").trim();
    const memberIds: string[] = Array.from(
      new Set(singleId ? [singleId, ...idsFromArray] : idsFromArray),
    );

    if (!memberIds.length) {
      return NextResponse.json({ error: "Medlems-ID mangler." }, { status: 400 });
    }

    const permission = await assertPermission({ requirement: "bulkTemporaryPasswords" });
    if (!permission.ok) {
      return permission.response;
    }
    const { supabase, userId, privilege } = permission;
    if (!canUseBulkTemporaryPasswordAction({ privilege })) {
      return NextResponse.json({ error: "Mangler tilgang." }, { status: 403 });
    }

    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, firstname, lastname, email, is_banned")
      .in("id", memberIds);

    if (membersError) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.password_bootstrap.send",
        targetTable: "members",
        targetId: memberIds.length === 1 ? memberIds[0] : null,
        status: "error",
        errorMessage: membersError.message,
        details: { requested_member_ids: memberIds },
      });
      return NextResponse.json({ error: membersError.message }, { status: 400 });
    }

    const foundById = new Map((members ?? []).map((member) => [String(member.id), member]));
    const missingIds = memberIds.filter((id) => !foundById.has(id));
    const blockedBannedIds: string[] = [];
    const missingEmailIds: string[] = [];
    const eligibleMembers = (members ?? []).filter((member) => {
      const memberId = String(member.id);
      if (member.is_banned === true) {
        blockedBannedIds.push(memberId);
        return false;
      }
      if (!member.email) {
        missingEmailIds.push(memberId);
        return false;
      }
      return true;
    });

    const unavailableIds = [...missingIds, ...missingEmailIds];
    const readinessError = getTemporaryPasswordEmailReadinessError();
    if (readinessError) {
      await logAdminAction(supabase, {
        actorId: userId,
        action: "member.password_bootstrap.send",
        targetTable: "members",
        targetId: memberIds.length === 1 ? memberIds[0] : null,
        status: "error",
        errorMessage: readinessError,
        details: {
          requested_member_ids: memberIds,
          updated_member_ids: [],
          blocked_banned_ids: blockedBannedIds,
          invalid_member_ids: unavailableIds,
          failed_member_ids: [],
          failed_reasons_by_member: {},
          updated_count: 0,
          failed_count: 0,
          skipped_unavailable_count: unavailableIds.length + blockedBannedIds.length,
        },
      });
      return NextResponse.json({ error: readinessError }, { status: 500 });
    }

    const admin = createAdminClient();
    const updatedMemberIds: string[] = [];
    const failedMemberIds: string[] = [];
    const failedReasonsByMember: Record<string, string> = {};

    for (const member of eligibleMembers) {
      const memberId = String(member.id);
      const tempPassword = generateTemporaryPassword();
      const firstname = String(member.firstname ?? "").trim();
      const lastname = String(member.lastname ?? "").trim();
      const fullName = `${firstname} ${lastname}`.trim();
      const userMetadata = {
        firstname,
        lastname,
        full_name: fullName,
        temporary_password: tempPassword,
        temporary_password_created_at: new Date().toISOString(),
      };

      const { error: updateError } = await admin.auth.admin.updateUserById(memberId, {
        password: tempPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      });
      if (updateError) {
        failedMemberIds.push(memberId);
        failedReasonsByMember[memberId] = updateError.message;
        continue;
      }

      const emailResult = await sendTemporaryPasswordEmail({
        email: member.email!,
        firstname,
        lastname,
        temporaryPassword: tempPassword,
      });
      if (!emailResult.ok) {
        failedMemberIds.push(memberId);
        failedReasonsByMember[memberId] = emailResult.error;
        continue;
      }

      updatedMemberIds.push(memberId);
    }

    if (updatedMemberIds.length > 0) {
      const { error: resetMarkerError } = await supabase
        .from("members")
        .update({ password_set_at: null })
        .in("id", updatedMemberIds);

      if (resetMarkerError) {
        await logAdminAction(supabase, {
          actorId: userId,
          action: "member.password_bootstrap.send",
          targetTable: "members",
          targetId: memberIds.length === 1 ? memberIds[0] : null,
          status: "error",
          errorMessage: resetMarkerError.message,
          details: {
            requested_member_ids: memberIds,
            updated_member_ids: updatedMemberIds,
            blocked_banned_ids: blockedBannedIds,
            invalid_member_ids: [...missingIds, ...missingEmailIds],
            failed_member_ids: failedMemberIds,
            failed_reasons_by_member: failedReasonsByMember,
            updated_count: updatedMemberIds.length,
          },
        });
        return NextResponse.json({ error: resetMarkerError.message }, { status: 500 });
      }
    }

    const skippedCount = unavailableIds.length + blockedBannedIds.length;
    const status =
      updatedMemberIds.length === 0
        ? "error"
        : failedMemberIds.length > 0 || skippedCount > 0
          ? "partial"
          : "ok";

    await logAdminAction(supabase, {
      actorId: userId,
      action: "member.password_bootstrap.send",
      targetTable: "members",
      targetId: memberIds.length === 1 ? memberIds[0] : null,
      status,
      errorMessage:
        status === "error"
          ? "Ingen medlemmer kunne få engangspassord."
          : failedMemberIds.length > 0
            ? "Noen medlemmer kunne ikke oppdateres."
            : null,
      details: {
        requested_member_ids: memberIds,
        updated_member_ids: updatedMemberIds,
        blocked_banned_ids: blockedBannedIds,
        invalid_member_ids: unavailableIds,
        failed_member_ids: failedMemberIds,
        failed_reasons_by_member: failedReasonsByMember,
        updated_count: updatedMemberIds.length,
        failed_count: failedMemberIds.length,
        skipped_unavailable_count: skippedCount,
      },
    });

    if (status === "error") {
      return NextResponse.json(
        {
          ok: false,
          error: "Ingen valgte medlemmer kunne få engangspassord.",
          updated: 0,
          failed: failedMemberIds.length,
          skipped: skippedCount,
          updated_member_ids: [],
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      status,
      updated: updatedMemberIds.length,
      failed: failedMemberIds.length,
      skipped: skippedCount,
      updated_member_ids: updatedMemberIds,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukjent feil" },
      { status: 500 },
    );
  }
}
