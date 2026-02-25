'use client';
import { createContext, useContext } from 'react';
import type {
    AddMemberActionResult,
    CheckMemberEmailResult,
} from "@/lib/members/actions-types";

type AddNewMember = (state: unknown, formData: FormData) => Promise<AddMemberActionResult>;
type CheckMemberEmail = (state: unknown, formData: FormData) => Promise<CheckMemberEmailResult>;
type ActivateMember = (state: unknown, formData: FormData) => Promise<AddMemberActionResult>;

const ActionsCtx = createContext<{
    addNewMember: AddNewMember;
    checkMemberEmail: CheckMemberEmail;
    activateMember: ActivateMember;
} | null>(null);

/**
 * Provides server actions used by the create/activate member dialog.
 */
export function ActionsProvider({
    children,
    addNewMember,
    checkMemberEmail,
    activateMember,
}: {
    children: React.ReactNode;
    addNewMember: AddNewMember;
    checkMemberEmail: CheckMemberEmail;
    activateMember: ActivateMember;
}) {
    return <ActionsCtx.Provider value={{ addNewMember, checkMemberEmail, activateMember }}>{children}</ActionsCtx.Provider>;
}

/**
 * Reads member action functions from context.
 */
export function useActions() {
    const ctx = useContext(ActionsCtx);
    if (!ctx) throw new Error('useActions must be used within ActionsProvider');
    return ctx;
}
