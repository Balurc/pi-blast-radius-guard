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

export type InterceptOutcome =
  | "blocked" // auto-blocked (critical)
  | "user-blocked" // user said No to confirm
  | "user-allowed" // user said Yes to confirm
  | "warned"; // medium — warned but allowed through

export interface HistoryEntry {
  timestamp: Date;
  command: string;
  level: RiskLevel;
  outcome: InterceptOutcome;
  reasons: string[];
}

export interface SessionStats {
  blocked: number; // auto-blocked + user-blocked
  warned: number; // warned but allowed
  userAllowed: number; // user explicitly approved high risk
  history: HistoryEntry[];
}

export function createSessionStats(): SessionStats {
  return {
    blocked: 0,
    warned: 0,
    userAllowed: 0,
    history: [],
  };
}
