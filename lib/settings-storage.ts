"use client";

/**
 * Typed localStorage helpers and hooks for persisted UI preferences.
 */

import { useCallback, useEffect, useState } from "react";

type Parser<T> = (raw: string) => T;
type Serializer<T> = (value: T) => string;

/**
 * Reads and parses a typed setting from localStorage.
 */
export function getStoredSetting<T>(key: string, defaultValue: T, parse: Parser<T>): T {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  const raw = window.localStorage.getItem(key);
  if (raw === null) {
    return defaultValue;
  }

  try {
    return parse(raw);
  } catch {
    return defaultValue;
  }
}

/**
 * Serializes and stores a typed setting in localStorage.
 */
export function setStoredSetting<T>(key: string, value: T, serialize: Serializer<T>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, serialize(value));
}

/**
 * React hook that binds a typed setting to component state and cross-tab sync.
 */
export function useStoredSetting<T>(
  key: string,
  defaultValue: T,
  parse: Parser<T>,
  serialize: Serializer<T>,
) {
  const [value, setValueState] = useState(defaultValue);

  useEffect(() => {
    setValueState(getStoredSetting(key, defaultValue, parse));
  }, [key, defaultValue, parse]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) {
        setValueState(getStoredSetting(key, defaultValue, parse));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, defaultValue, parse]);

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      setStoredSetting(key, next, serialize);
    },
    [key, serialize],
  );

  return { value, setValue };
}
