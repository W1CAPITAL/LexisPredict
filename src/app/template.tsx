"use client";

/**
 * Route template stays intentionally transparent. Swarm is mounted by the
 * persistent app shell so it can never capture the sidebar or header.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
