import type { ExtensionUIContext } from "@mariozechner/pi-coding-agent";
import type { InterceptOutcome, SessionStats } from "./types.js";

const WIDGET_KEY = "blast-radius-guard";

const OUTCOME_ICON: Record<InterceptOutcome, string> = {
  blocked: "🚫",
  "user-blocked": "🚫",
  "user-allowed": "🔶",
  warned: "⚠️",
};

const OUTCOME_LABEL: Record<InterceptOutcome, string> = {
  blocked: "Auto-blocked",
  "user-blocked": "Blocked by user",
  "user-allowed": "Approved by user",
  warned: "Warning shown, allowed",
};

export function updateWidget(ui: ExtensionUIContext, stats: SessionStats): void {
  const last = stats.history[stats.history.length - 1];

  const counts = [
    stats.blocked > 0 ? `🚫 ${stats.blocked}` : null,
    stats.warned > 0 ? `⚠️ ${stats.warned}` : null,
    stats.userAllowed > 0 ? `🔶 ${stats.userAllowed}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const lastPart = last
    ? `  |  Last: [${last.level.toUpperCase()}] ${
        last.command.length > 30 ? last.command.slice(0, 27) + "..." : last.command
      }`
    : "";

  const line = `🛡 BRG  ${counts || "no events yet"}${lastPart}`;

  ui.setWidget(WIDGET_KEY, [line], { placement: "aboveEditor" });
}

export function renderHistory(stats: SessionStats): string {
  if (stats.history.length === 0) {
    return `🛡 BRG — No events this session.`;
  }

  const lines: string[] = [``, `  🛡 Blast Radius Guard — Session History`, `  ${"─".repeat(48)}`];

  for (const entry of stats.history) {
    const time = entry.timestamp.toTimeString().slice(0, 5);
    const icon = OUTCOME_ICON[entry.outcome];
    const label = OUTCOME_LABEL[entry.outcome];

    lines.push(`  [${time}] ${icon} ${entry.level.toUpperCase().padEnd(8)} ${entry.command}`);
    lines.push(`           ${label}`);
    for (const reason of entry.reasons) {
      lines.push(`           › ${reason}`);
    }
    lines.push("");
  }

  lines.push(
    `  ${"─".repeat(48)}`,
    `  🚫 ${stats.blocked} blocked · ⚠️ ${stats.warned} warned · 🔶 ${stats.userAllowed} approved`,
    ``
  );

  return lines.join("\n");
}
