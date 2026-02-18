'use client';
import { createContext, useContext } from 'react';

type AddNewMemberResult = {
    ok: boolean;
    error?: string;
    autoPrint?: boolean;
    queueId?: string | number;
    queueRef?: string | number;
    queueInvoker?: string;
};

type MemberLookup = {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    privilege_type: number | null;
    is_banned?: boolean | null;
};

type CheckMemberResult = {
    ok: boolean;
    error?: string;
    exists?: boolean;
    active?: boolean;
    banned?: boolean;
    email?: string;
    member?: MemberLookup;
};

type AddNewMember = (state: unknown, formData: FormData) => Promise<AddNewMemberResult>;
type CheckMemberEmail = (state: unknown, formData: FormData) => Promise<CheckMemberResult>;
type ActivateMember = (state: unknown, formData: FormData) => Promise<AddNewMemberResult>;

const ActionsCtx = createContext<{
    addNewMember: AddNewMember;
    checkMemberEmail: CheckMemberEmail;
    activateMember: ActivateMember;
} | null>(null);

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

export function useActions() {
    const ctx = useContext(ActionsCtx);
    if (!ctx) throw new Error('useActions must be used within ActionsProvider');
    return ctx;
}
