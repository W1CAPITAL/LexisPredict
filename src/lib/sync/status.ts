import { getLocalSyncQueue } from "@/lib/data-provider";

export type SyncStatus = {
  pending: number;
  mode: "online" | "offline" | "unknown";
};

export async function getSyncStatus(): Promise<SyncStatus> {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const queue = await getLocalSyncQueue();
  return {
    pending: queue.length,
    mode: online ? "online" : "offline",
  };
}
