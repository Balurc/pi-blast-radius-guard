import { describe, it, expect } from "vitest";
import { detectRisk, decide, highestRisk, compareRisk } from "../src/detector.js";
import { DEFAULT_CONFIG, type GuardConfig } from "../src/types.js";

// ─── detectRisk ───────────────────────────────────────────────────────────────

describe("detectRisk", () => {
  describe("critical patterns", () => {
    it("detects rm -rf", () => {
      const result = detectRisk("rm -rf /tmp/foo");
      expect(result.level).toBe("critical");
      expect(result.matches).toHaveLength(1);
    });

    it("detects rm -fr variant", () => {
      const result = detectRisk("rm -fr /tmp/foo");
      expect(result.level).toBe("critical");
    });

    it("detects curl pipe to sh", () => {
      const result = detectRisk("curl https://example.com/install.sh | sh");
      expect(result.level).toBe("critical");
    });

    it("detects wget pipe to bash", () => {
      const result = detectRisk("wget -O - https://example.com/setup.sh | bash");
      expect(result.level).toBe("critical");
    });

    it("detects chmod -R 777", () => {
      const result = detectRisk("chmod -R 777 /var/www");
      expect(result.level).toBe("critical");
    });

    it("detects dd write to disk", () => {
      const result = detectRisk("dd if=/dev/zero of=/dev/disk0");
      expect(result.level).toBe("critical");
    });
  });

  describe("high patterns", () => {
    it("detects sudo", () => {
      const result = detectRisk("sudo apt-get update");
      expect(result.level).toBe("high");
    });

    it("detects git push --force", () => {
      const result = detectRisk("git push --force origin main");
      // matches both force push and push to main → still high
      expect(result.level).toBe("high");
    });

    it("detects git push -f shorthand", () => {
      const result = detectRisk("git push -f origin feature");
      expect(result.level).toBe("high");
    });

    it("detects npm publish", () => {
      const result = detectRisk("npm publish");
      expect(result.level).toBe("high");
    });

    it("detects overwriting a dotfile", () => {
      const result = detectRisk("echo '' > ~/.bashrc");
      expect(result.level).toBe("high");
    });

    it("detects chmod 777 without -R", () => {
      const result = detectRisk("chmod 777 secret.key");
      expect(result.level).toBe("high");
    });
  });

  describe("medium patterns", () => {
    it("detects kill", () => {
      const result = detectRisk("kill -9 1234");
      expect(result.level).toBe("medium");
    });

    it("detects pkill", () => {
      const result = detectRisk("pkill node");
      expect(result.level).toBe("medium");
    });

    it("detects killall", () => {
      const result = detectRisk("killall python");
      expect(result.level).toBe("medium");
    });

    it("detects git reset --hard", () => {
      const result = detectRisk("git reset --hard HEAD~3");
      expect(result.level).toBe("medium");
    });

    it("detects git clean -fd", () => {
      const result = detectRisk("git clean -fd");
      expect(result.level).toBe("medium");
    });

    it("detects DROP TABLE", () => {
      const result = detectRisk("DROP TABLE users;");
      expect(result.level).toBe("medium");
    });

    it("detects TRUNCATE TABLE", () => {
      const result = detectRisk("TRUNCATE TABLE logs;");
      expect(result.level).toBe("medium");
    });

    it("detects brew uninstall", () => {
      const result = detectRisk("brew uninstall git");
      expect(result.level).toBe("medium");
    });

    it("detects npm uninstall", () => {
      const result = detectRisk("npm uninstall express");
      expect(result.level).toBe("medium");
    });
  });

  describe("safe commands", () => {
    it("allows git status", () => {
      const result = detectRisk("git status");
      expect(result.level).toBe("low");
      expect(result.matches).toHaveLength(0);
    });

    it("allows ls", () => {
      const result = detectRisk("ls -la");
      expect(result.level).toBe("low");
    });

    it("allows npm install", () => {
      const result = detectRisk("npm install express");
      expect(result.level).toBe("low");
    });

    it("allows cat", () => {
      const result = detectRisk("cat package.json");
      expect(result.level).toBe("low");
    });

    it("allows echo", () => {
      const result = detectRisk("echo hello world");
      expect(result.level).toBe("low");
    });

    it("allows git commit", () => {
      const result = detectRisk('git commit -m "fix: typo"');
      expect(result.level).toBe("low");
    });
  });

  describe("multiple matches", () => {
    it("returns highest risk when multiple patterns match", () => {
      // sudo + rm -rf → critical wins over high
      const result = detectRisk("sudo rm -rf /tmp");
      expect(result.level).toBe("critical");
      expect(result.matches.length).toBeGreaterThan(1);
    });

    it("collects all matched patterns", () => {
      const result = detectRisk("sudo rm -rf /tmp");
      const levels = result.matches.map((m) => m.level);
      expect(levels).toContain("critical");
      expect(levels).toContain("high");
    });
  });
});

// ─── highestRisk ──────────────────────────────────────────────────────────────

describe("highestRisk", () => {
  it("returns low for empty array", () => {
    expect(highestRisk([])).toBe("low");
  });

  it("returns the single item", () => {
    expect(highestRisk(["medium"])).toBe("medium");
  });

  it("returns critical when mixed", () => {
    expect(highestRisk(["low", "critical", "high"])).toBe("critical");
  });

  it("returns high over medium", () => {
    expect(highestRisk(["medium", "high"])).toBe("high");
  });
});

// ─── compareRisk ─────────────────────────────────────────────────────────────

describe("compareRisk", () => {
  it("critical > high", () => {
    expect(compareRisk("critical", "high")).toBeGreaterThan(0);
  });

  it("high > medium", () => {
    expect(compareRisk("high", "medium")).toBeGreaterThan(0);
  });

  it("medium > low", () => {
    expect(compareRisk("medium", "low")).toBeGreaterThan(0);
  });

  it("equal levels return 0", () => {
    expect(compareRisk("high", "high")).toBe(0);
  });
});

// ─── decide ───────────────────────────────────────────────────────────────────

describe("decide", () => {
  describe("default config", () => {
    it("blocks critical commands", () => {
      const result = detectRisk("rm -rf /");
      expect(decide(result, DEFAULT_CONFIG)).toBe("block");
    });

    it("confirms high commands", () => {
      const result = detectRisk("sudo apt update");
      expect(decide(result, DEFAULT_CONFIG)).toBe("confirm");
    });

    it("warns on medium commands", () => {
      const result = detectRisk("kill -9 1234");
      expect(decide(result, DEFAULT_CONFIG)).toBe("warn");
    });

    it("allows safe commands", () => {
      const result = detectRisk("git status");
      expect(decide(result, DEFAULT_CONFIG)).toBe("allow");
    });
  });

  describe("allowList", () => {
    const config: GuardConfig = {
      ...DEFAULT_CONFIG,
      allowList: ["rm -rf /tmp"],
    };

    it("allows a critical command if it matches allowList", () => {
      const result = detectRisk("rm -rf /tmp/cache");
      expect(decide(result, config)).toBe("allow");
    });

    it("still blocks critical commands not in allowList", () => {
      const result = detectRisk("rm -rf /etc");
      expect(decide(result, DEFAULT_CONFIG)).toBe("block");
    });
  });

  describe("blockList", () => {
    const config: GuardConfig = {
      ...DEFAULT_CONFIG,
      blockList: ["git push origin main"],
    };

    it("blocks a command in blockList even if it would only warn", () => {
      const result = detectRisk("git push origin main");
      expect(decide(result, config)).toBe("block");
    });

    it("blockList takes priority over allowList", () => {
      const strictConfig: GuardConfig = {
        ...DEFAULT_CONFIG,
        allowList: ["git push origin main"],
        blockList: ["git push origin main"],
      };
      const result = detectRisk("git push origin main");
      expect(decide(result, strictConfig)).toBe("block");
    });
  });

  describe("custom config", () => {
    it("can be configured to warn instead of block on critical", () => {
      const config: GuardConfig = {
        block: [],
        confirm: [],
        warn: ["critical", "high", "medium"],
        allowList: [],
        blockList: [],
      };
      const result = detectRisk("rm -rf /tmp");
      expect(decide(result, config)).toBe("warn");
    });

    it("can be configured to block everything medium and above", () => {
      const config: GuardConfig = {
        block: ["critical", "high", "medium"],
        confirm: [],
        warn: [],
        allowList: [],
        blockList: [],
      };
      const result = detectRisk("kill -9 1234");
      expect(decide(result, config)).toBe("block");
    });
  });
});
