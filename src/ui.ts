import type { ExtensionUIContext } from "@mariozechner/pi-coding-agent";
import type { SessionStats } from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const WIDGET_KEY = "blast-radius-guard";
const STATUS_KEY = "blast-radius-guard";

const ICONS = {
  guard: "🛡️",
  blocked: "🚫",
  warned: "⚠️",
  allowed: "🔶",
  critical: "🚫",
  high: "🔶",
  medium: "⚠️",
  low: "✅",
} as const;

// ─── Type needed by helpers ───────────────────────────────────────────────────

type InterceptOutcome = import("./types.js").InterceptOutcome;

// ─── Time Formatting ──────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5); // "HH:MM"
}

// ─── Footer Status ────────────────────────────────────────────────────────────

export function updateStatus(ui: ExtensionUIContext, stats: SessionStats): void {
  const parts: string[] = [];

  if (stats.blocked > 0) {
    parts.push(`${ICONS.blocked} ${stats.blocked} blocked`);
  }

  if (stats.warned > 0) {
    parts.push(`${ICONS.warned} ${stats.warned} warned`);
  }

  if (stats.userAllowed > 0) {
    parts.push(`${ICONS.allowed} ${stats.userAllowed} approved`);
  }

  if (parts.length === 0) {
    ui.setStatus(STATUS_KEY, `${ICONS.guard} active`);
  } else {
    ui.setStatus(STATUS_KEY, `${ICONS.guard} ${parts.join(" · ")}`);
  }
}

// ─── Session Widget ───────────────────────────────────────────────────────────

export function updateWidget(ui: ExtensionUIContext, stats: SessionStats): void {
  const lastEntry = stats.history[stats.history.length - 1];

  const lines: string[] = [
    `  ${ICONS.guard}  BLAST RADIUS GUARD`,
    `  ${"─".repeat(42)}`,
    `  ${ICONS.blocked}  Blocked : ${String(stats.blocked).padEnd(4)}  ${ICONS.warned}  Warned  : ${stats.warned}`,
  ];

  if (stats.userAllowed > 0) {
    lines.push(`  ${ICONS.allowed}  User approved: ${stats.userAllowed}`);
  }

  if (lastEntry) {
    lines.push(`  ${"─".repeat(42)}`);
    const outcomeIcon = getOutcomeIcon(lastEntry.outcome);
    const truncated =
      lastEntry.command.length > 35 ? lastEntry.command.slice(0, 32) + "..." : lastEntry.command;
    lines.push(`  Last : ${outcomeIcon} [${lastEntry.level.toUpperCase()}] ${truncated}`);
    if (lastEntry.reasons[0]) {
      lines.push(`         ${lastEntry.reasons[0]}`);
    }
  }

  lines.push(`  ${"─".repeat(42)}`);

  ui.setWidget(WIDGET_KEY, lines, { placement: "aboveEditor" });
}

// ─── History Command Output ───────────────────────────────────────────────────

export function renderHistory(stats: SessionStats): string {
  if (stats.history.length === 0) {
    return `${ICONS.guard}  Blast Radius Guard — No events this session.`;
  }

  const lines: string[] = [
    ``,
    `  ${ICONS.guard}  Blast Radius Guard — Session History`,
    `  ${"─".repeat(50)}`,
  ];

  for (const entry of stats.history) {
    const time = formatTime(entry.timestamp);
    const outcomeIcon = getOutcomeIcon(entry.outcome);
    const outcomeLabel = getOutcomeLabel(entry.outcome);

    lines.push(
      `  [${time}] ${outcomeIcon} ${entry.level.toUpperCase().padEnd(8)} ${entry.command}`
    );
    lines.push(`           ${outcomeLabel}`);

    for (const reason of entry.reasons) {
      lines.push(`           › ${reason}`);
    }

    lines.push("");
  }

  lines.push(
    `  ${"─".repeat(50)}`,
    `  Total: ${stats.blocked} blocked · ${stats.warned} warned · ${stats.userAllowed} approved`,
    ``
  );

  return lines.join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOutcomeIcon(outcome: InterceptOutcome): string {
  switch (outcome) {
    case "blocked":
      return ICONS.blocked;
    case "user-blocked":
      return ICONS.blocked;
    case "user-allowed":
      return ICONS.allowed;
    case "warned":
      return ICONS.warned;
  }
}

function getOutcomeLabel(outcome: InterceptOutcome): string {
  switch (outcome) {
    case "blocked":
      return "Auto-blocked (critical)";
    case "user-blocked":
      return "Blocked by user";
    case "user-allowed":
      return "Approved by user";
    case "warned":
      return "Warning shown, allowed";
  }
}
