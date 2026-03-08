import { detectRisk, decide } from "./detector.js";
import { DEFAULT_CONFIG, type GuardConfig } from "./types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

// Minimal pi ExtensionAPI types we need
// Full types are provided by pi at runtime
interface ToolCallEvent {
  name: string;
  input: Record<string, unknown>;
}

interface ExtensionAPI {
  on(
    event: "tool_call",
    handler: (event: ToolCallEvent) => Promise<string | undefined> | string | undefined
  ): void;
  getConfig<T>(key: string, defaultValue: T): T;
  log(message: string): void;
  confirm(message: string): Promise<boolean>;
  warning(message: string): void;
  error(message: string): void;
}

// ─── Extension Entry Point ────────────────────────────────────────────────────

export default function blastRadiusGuard(pi: ExtensionAPI): void {
  // Load config from pi settings, falling back to safe defaults
  const config: GuardConfig = {
    block: pi.getConfig("blastRadiusGuard.block", DEFAULT_CONFIG.block),
    confirm: pi.getConfig("blastRadiusGuard.confirm", DEFAULT_CONFIG.confirm),
    warn: pi.getConfig("blastRadiusGuard.warn", DEFAULT_CONFIG.warn),
    allowList: pi.getConfig("blastRadiusGuard.allowList", DEFAULT_CONFIG.allowList),
    blockList: pi.getConfig("blastRadiusGuard.blockList", DEFAULT_CONFIG.blockList),
  };

  pi.log("Blast Radius Guard active 🛡️");

  // ─── Intercept bash tool calls ─────────────────────────────────────────────

  pi.on("tool_call", async (event) => {
    // Only care about bash calls
    if (event.name !== "bash") return undefined;

    const command = String(event.input["command"] ?? "");
    if (!command.trim()) return undefined;

    const result = detectRisk(command);
    const decision = decide(result, config);

    // Build a summary of what was matched
    const matchSummary = result.matches
      .map((m) => `  [${m.level.toUpperCase()}] ${m.reason}`)
      .join("\n");

    switch (decision) {
      case "allow":
        return undefined; // proceed silently

      case "warn":
        pi.warning(
          [
            `⚠️  Blast Radius Guard — medium risk command detected:`,
            `   $ ${command}`,
            matchSummary,
            `   Proceeding automatically.`,
          ].join("\n")
        );
        return undefined; // allow but warned

      case "confirm": {
        const message = [
          `🔶 Blast Radius Guard — high risk command:`,
          `   $ ${command}`,
          matchSummary,
          `\nDo you want to proceed?`,
        ].join("\n");

        const approved = await pi.confirm(message);

        if (!approved) {
          return "Command blocked by user via Blast Radius Guard.";
        }
        return undefined; // user approved, proceed
      }

      case "block":
        pi.error(
          [
            `🚫 Blast Radius Guard — CRITICAL command blocked:`,
            `   $ ${command}`,
            matchSummary,
            `   This command was automatically blocked.`,
            `   To allow it, add it to blastRadiusGuard.allowList in your pi settings.`,
          ].join("\n")
        );
        return "Command automatically blocked by Blast Radius Guard (critical risk level).";
    }
  });
}
