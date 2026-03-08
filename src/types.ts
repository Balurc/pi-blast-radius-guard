export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskPattern {
  // The regex pattern to match against the command
  pattern: RegExp;
  // Risk level of this pattern
  level: RiskLevel;
  // Human readable reason shown to the user
  reason: string;
  // Example of what this catches
  example: string;
}

export interface DetectionResult {
  // The original command that was analyzed
  command: string;
  // Highest risk level found (or "low" if nothing matched)
  level: RiskLevel;
  // All matched patterns
  matches: MatchedPattern[];
}

export interface MatchedPattern {
  level: RiskLevel;
  reason: string;
  example: string;
}

export interface GuardConfig {
  // Risk levels that should be blocked entirely
  block: RiskLevel[];
  // Risk levels that should prompt for confirmation
  confirm: RiskLevel[];
  // Risk levels that should just log a warning
  warn: RiskLevel[];
  // Specific commands to always allow (override any pattern)
  allowList: string[];
  // Specific commands to always block (override allowList)
  blockList: string[];
}

export const DEFAULT_CONFIG: GuardConfig = {
  block: ["critical"],
  confirm: ["high"],
  warn: ["medium"],
  allowList: [],
  blockList: [],
};
