"use client";

import * as React from "react";

export type DashboardSession = {
  userId: string;
  privilegeType: number;
  name?: string | null;
  email?: string | null;
};

const DashboardSessionContext = React.createContext<DashboardSession | null>(null);

/**
 * Exposes authenticated dashboard user id + privilege to client components.
 */
export function DashboardSessionProvider({
  value,
  children,
}: React.PropsWithChildren<{ value: DashboardSession }>) {
  return (
    <DashboardSessionContext.Provider value={value}>
      {children}
    </DashboardSessionContext.Provider>
  );
}

/**
 * Optional consumer used by hooks that can fall back outside dashboard context.
 */
export function useDashboardSessionOptional() {
  return React.useContext(DashboardSessionContext);
}
