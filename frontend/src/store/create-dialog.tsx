"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type CreateDialogContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const CreateDialogContext = createContext<CreateDialogContextValue | null>(null);

export function CreateDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <CreateDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </CreateDialogContext.Provider>
  );
}

export function useCreateDialog() {
  const ctx = useContext(CreateDialogContext);
  if (!ctx) throw new Error("useCreateDialog must be used within CreateDialogProvider");
  return ctx;
}
