"use client";

import { createContext, useContext } from "react";

export type StaffRole = "admin" | "cashier";

interface AdminRoleContextValue {
  role: StaffRole;
}

const AdminRoleContext = createContext<AdminRoleContextValue | null>(null);

export function AdminRoleProvider({
  role,
  children,
}: {
  role: StaffRole;
  children: React.ReactNode;
}) {
  return (
    <AdminRoleContext.Provider value={{ role }}>
      {children}
    </AdminRoleContext.Provider>
  );
}

export function useAdminRole() {
  const context = useContext(AdminRoleContext);

  if (!context) {
    throw new Error("useAdminRole must be used inside AdminRoleProvider");
  }

  return context;
}
