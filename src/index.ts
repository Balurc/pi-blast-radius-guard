import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ExtensionAPI, ToolCallEvent } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { detectRisk, decide } from "./detector.js";
import { DEFAULT_CONFIG, type GuardConfig } from "./types.js";

// ─── Config Loading ───────────────────────────────────────────────────────────

function loadConfig(): GuardConfig {
  const paths = [
    join(process.cwd(), ".pi", "settings.json"),
    join(homedir(), ".pi", "agent", "settings.json"),
  ];

  for (const settingsPath of paths) {
    try {
      const raw = readFileSync(settingsPath, "utf-8");
      const parsed = JSON.parse(raw);
      const guard = parsed?.blastRadiusGuard;
      if (guard) {
        return {
          block: guard.block ?? DEFAULT_CONFIG.block,
          confirm: guard.confirm ?? DEFAULT_CONFIG.confirm,
          warn: guard.warn ?? DEFAULT_CONFIG.warn,
          allowList: guard.allowList ?? DEFAULT_CONFIG.allowList,
          blockList: guard.blockList ?? DEFAULT_CONFIG.blockList,
        };
      }
    } catch {
      // file doesn't exist or isn't valid JSON — try next path
    }
  }

  return { ...DEFAULT_CONFIG };
}

// ─── Extension Entry Point ────────────────────────────────────────────────────

export default function blastRadiusGuard(pi: ExtensionAPI): void {
  const config = loadConfig();

  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    // Use the official type guard to narrow to bash events
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command ?? "";
    if (!command.trim()) return;

    const result = detectRisk(command);
    const decision = decide(result, config);

    const matchSummary = result.matches
      .map((m) => `  [${m.level.toUpperCase()}] ${m.reason}`)
      .join("\n");

    switch (decision) {
      case "allow":
        return;

      case "warn":
        ctx.ui.notify(
          [`⚠️  Blast Radius Guard — medium risk detected:`, `   $ ${command}`, matchSummary].join(
            "\n"
          ),
          "warning"
        );
        return;

      case "confirm": {
        const approved = await ctx.ui.confirm(
          "🔶 Blast Radius Guard — High Risk Command",
          [`$ ${command}`, ``, matchSummary, ``, `Do you want to proceed?`].join("\n")
        );
        if (!approved) {
          return {
            block: true,
            reason: "High risk command blocked by user via Blast Radius Guard.",
          };
        }
        return;
      }

      case "block":
        ctx.ui.notify(
          [
            `🚫 Blast Radius Guard — CRITICAL command blocked:`,
            `   $ ${command}`,
            matchSummary,
            `   Add to blastRadiusGuard.allowList in settings to override.`,
          ].join("\n"),
          "error"
        );
        return {
          block: true,
          reason: "Critical risk command automatically blocked by Blast Radius Guard.",
        };
    }
  });
}
