'use client';
import { createContext, useContext } from 'react';

// @ts-nocheck
type AddNewMember = (state: unknown, formData: FormData) => Promise<any>;

const ActionsCtx = createContext<{ addNewMember: AddNewMember } | null>(null);

export function ActionsProvider({
    children,
    addNewMember,
}: {
    children: React.ReactNode;
    addNewMember: AddNewMember;
}) {
    return <ActionsCtx.Provider value={{ addNewMember }}>{children}</ActionsCtx.Provider>;
}

export function useActions() {
    const ctx = useContext(ActionsCtx);
    if (!ctx) throw new Error('useActions must be used within ActionsProvider');
    return ctx;
}
