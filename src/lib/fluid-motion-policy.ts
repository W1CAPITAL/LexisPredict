/** Motion-safe policy for low-resource devices. Pure and independently testable. */
export type MotionCapacity = "full" | "lite";
export type MotionInputs = {
  reducedMotion: boolean;
  saveData: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

export function resolveMotionCapacity(value: MotionInputs): MotionCapacity {
  if (value.reducedMotion || value.saveData) return "lite";
  if (typeof value.deviceMemory === "number" && value.deviceMemory > 0 && value.deviceMemory <= 4) return "lite";
  if (typeof value.hardwareConcurrency === "number" && value.hardwareConcurrency > 0 && value.hardwareConcurrency <= 4) return "lite";
  return "full";
}
