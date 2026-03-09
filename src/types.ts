export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskPattern {
  pattern: RegExp;
  level: RiskLevel;
  reason: string;
  example: string;
}

export interface DetectionResult {
  command: string;
  level: RiskLevel;
  matches: MatchedPattern[];
}

export interface MatchedPattern {
  level: RiskLevel;
  reason: string;
  example: string;
}

export interface GuardConfig {
  block: RiskLevel[];
  confirm: RiskLevel[];
  warn: RiskLevel[];
  allowList: string[];
  blockList: string[];
}

export const DEFAULT_CONFIG: GuardConfig = {
  block: ["critical"],
  confirm: ["high"],
  warn: ["medium"],
  allowList: [],
  blockList: [],
};

// ─── Session Tracking ─────────────────────────────────────────────────────────

export type InterceptOutcome = "blocked" | "user-blocked" | "user-allowed" | "warned";

export interface HistoryEntry {
  timestamp: Date;
  command: string;
  level: RiskLevel;
  outcome: InterceptOutcome;
  reasons: string[];
}

export interface SessionStats {
  blocked: number;
  warned: number;
  userAllowed: number;
  history: HistoryEntry[];
}

export function createSessionStats(): SessionStats {
  return { blocked: 0, warned: 0, userAllowed: 0, history: [] };
}

export function recordEvent(
  stats: SessionStats,
  command: string,
  level: RiskLevel,
  outcome: InterceptOutcome,
  reasons: string[]
): void {
  if (outcome === "blocked" || outcome === "user-blocked") stats.blocked++;
  else if (outcome === "warned") stats.warned++;
  else if (outcome === "user-allowed") stats.userAllowed++;

  stats.history.push({ timestamp: new Date(), command, level, outcome, reasons });
}
