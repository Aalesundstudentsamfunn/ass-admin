"use client";

import { useCallback, useEffect, useState } from "react";

const AUTO_PRINT_KEY = "ass_admin_auto_print";

export function getStoredAutoPrint(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const raw = window.localStorage.getItem(AUTO_PRINT_KEY);
  if (raw === null) {
    return true;
  }

  return raw !== "false";
}

export function setStoredAutoPrint(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTO_PRINT_KEY, value ? "true" : "false");
}

export function useAutoPrintSetting() {
  const [autoPrint, setAutoPrintState] = useState(true);

  useEffect(() => {
    setAutoPrintState(getStoredAutoPrint());
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTO_PRINT_KEY) {
        setAutoPrintState(getStoredAutoPrint());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setAutoPrint = useCallback((value: boolean) => {
    setAutoPrintState(value);
    setStoredAutoPrint(value);
  }, []);

  return { autoPrint, setAutoPrint };
}
