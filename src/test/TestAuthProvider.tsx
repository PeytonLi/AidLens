import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const client = new ConvexReactClient("https://example.convex.cloud");

/** Wraps UI that mounts auth-aware shell chrome under jsdom. */
export function TestAuthProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}
