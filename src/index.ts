import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ExtensionAPI, ToolCallEvent } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { detectRisk, decide } from "./detector.js";
import { DEFAULT_CONFIG, createSessionStats, recordEvent, type GuardConfig } from "./types.js";
import { updateWidget, renderHistory } from "./ui.js";

function loadConfig(): GuardConfig {
  const paths = [
    join(process.cwd(), ".pi", "settings.json"),
    join(homedir(), ".pi", "agent", "settings.json"),
  ];
  for (const p of paths) {
    try {
      const guard = JSON.parse(readFileSync(p, "utf-8"))?.blastRadiusGuard;
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
      // not found or invalid — try next
    }
  }
  return { ...DEFAULT_CONFIG };
}

export default function blastRadiusGuard(pi: ExtensionAPI): void {
  const config = loadConfig();
  const stats = createSessionStats();

  pi.on("session_start", (_event, ctx) => {
    updateWidget(ctx.ui, stats);
  });

  pi.registerCommand("guard-history", {
    description: "Show Blast Radius Guard session history",
    handler: (_args, ctx) => {
      ctx.ui.notify(renderHistory(stats), "info");
      return Promise.resolve();
    },
  });

  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command ?? "";
    if (!command.trim()) return;

    const result = detectRisk(command);
    const decision = decide(result, config);
    const reasons = result.matches.map((m) => m.reason);
    const matchSummary = result.matches
      .map((m) => `  [${m.level.toUpperCase()}] ${m.reason}`)
      .join("\n");

    switch (decision) {
      case "allow":
        return;

      case "warn":
        recordEvent(stats, command, result.level, "warned", reasons);
        ctx.ui.notify(
          [`⚠️  Blast Radius Guard — medium risk:`, `   $ ${command}`, matchSummary].join("\n"),
          "warning"
        );
        updateWidget(ctx.ui, stats);
        return;

      case "confirm": {
        const approved = await ctx.ui.confirm(
          "🔶 Blast Radius Guard — High Risk Command",
          [`$ ${command}`, ``, matchSummary, ``, `Do you want to proceed?`].join("\n")
        );
        recordEvent(
          stats,
          command,
          result.level,
          approved ? "user-allowed" : "user-blocked",
          reasons
        );
        updateWidget(ctx.ui, stats);
        if (!approved) {
          return { block: true, reason: "Blocked by user via Blast Radius Guard." };
        }
        return;
      }

      case "block":
        recordEvent(stats, command, result.level, "blocked", reasons);
        ctx.ui.notify(
          [
            `🚫 Blast Radius Guard — CRITICAL blocked:`,
            `   $ ${command}`,
            matchSummary,
            `   Add to blastRadiusGuard.allowList to override.`,
          ].join("\n"),
          "error"
        );
        updateWidget(ctx.ui, stats);
        return { block: true, reason: "Critical command blocked by Blast Radius Guard." };
    }
  });
}
