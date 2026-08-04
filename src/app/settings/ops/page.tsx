import { redirect } from "next/navigation";

/** Alias: /settings/ops → /ops */
export default function SettingsOpsRedirect() {
  redirect("/ops");
}
