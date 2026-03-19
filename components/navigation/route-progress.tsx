"use client";

import { cn } from "@/lib/utils";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type RouteProgressContextValue = {
  isNavigating: boolean;
  startNavigation: () => void;
};

const RouteProgressContext = createContext<RouteProgressContextValue | null>(null);

/**
 * Provides a lightweight global route transition indicator.
 */
export function RouteProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);
  const searchKey = searchParams.toString();

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const startNavigation = useCallback(() => {
    clearHideTimeout();
    setIsNavigating(true);
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsNavigating(false);
      hideTimeoutRef.current = null;
    }, 10000);
  }, [clearHideTimeout]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
        return;
      }
      if (anchor.target && anchor.target !== "_self") {
        return;
      }
      if (anchor.hasAttribute("download")) {
        return;
      }

      const currentUrl = new URL(window.location.href);
      const nextUrl = new URL(anchor.href, currentUrl);

      if (nextUrl.origin !== currentUrl.origin) {
        return;
      }
      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) {
        return;
      }

      startNavigation();
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [startNavigation]);

  useEffect(() => {
    if (!isNavigating) {
      return;
    }

    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsNavigating(false);
      hideTimeoutRef.current = null;
    }, 150);

    return clearHideTimeout;
  }, [pathname, searchKey, isNavigating, clearHideTimeout]);

  useEffect(() => clearHideTimeout, [clearHideTimeout]);

  const value = useMemo(
    () => ({
      isNavigating,
      startNavigation,
    }),
    [isNavigating, startNavigation],
  );

  return (
    <RouteProgressContext.Provider value={value}>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden transition-opacity duration-150",
          isNavigating ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="h-full w-full bg-transparent">
          <div className="route-progress-bar h-full w-1/3 rounded-r-full bg-primary/90 shadow-[0_0_12px_rgba(0,0,0,0.18)]" />
        </div>
      </div>
      {children}
      <style jsx global>{`
        @keyframes route-progress-slide {
          0% {
            transform: translateX(-120%);
          }
          60% {
            transform: translateX(140%);
          }
          100% {
            transform: translateX(220%);
          }
        }

        .route-progress-bar {
          animation: route-progress-slide 1.1s ease-in-out infinite;
        }
      `}</style>
    </RouteProgressContext.Provider>
  );
}

/**
 * Accesses the shared route transition controls.
 */
export function useRouteProgress() {
  const context = useContext(RouteProgressContext);

  if (!context) {
    throw new Error("useRouteProgress must be used within RouteProgressProvider");
  }

  return context;
}
