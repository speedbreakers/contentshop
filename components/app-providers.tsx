"use client";

import * as React from "react";
import { SWRConfig } from "swr";
import { ThemeProvider } from "@/components/theme-provider";
import { swrFetcher } from "@/lib/swr/fetcher";

export function AppProviders({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: Record<string, unknown>;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SWRConfig
        value={{
          fetcher: swrFetcher,
          revalidateOnFocus: true,
          shouldRetryOnError: (err) =>
            !(
              err &&
              typeof err === "object" &&
              "status" in err &&
              (err as any).status === 401
            ),
          fallback,
        }}
      >
        {children}
      </SWRConfig>
    </ThemeProvider>
  );
}


