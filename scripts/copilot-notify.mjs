// PreToolUse hook: sends a webhook notification before every Copilot tool invocation.
// Reads JSON from stdin, posts an Adaptive Card to a webhook URL, outputs JSON to stdout.
//
// Works with Microsoft Teams, Slack (via webhook), Discord, or any HTTP endpoint.
//
// Environment variable required:
//   WEBHOOK_URL — Webhook endpoint (also accepts TEAMS_WEBHOOK_URL for backward compat)
//
// Optional environment variables:
//   WEBHOOK_HOOK_MODE — "notify" (default): send notification, allow tool to proceed
//                       "ask": send notification and require user confirmation in VS Code
//                       "deny_destructive": auto-deny destructive tools, notify on others
//   WEBHOOK_DENY_PATTERNS — comma-separated regexes that define "high risk" commands
//                           (overrides defaults when set)

import { readFileSync } from "fs";
import https from "https";
import http from "http";

// ── Read hook input from stdin ──────────────────────────────────────────────
const raw = readFileSync(0, "utf-8"); // fd 0 = stdin
let input;
try {
  input = JSON.parse(raw);
} catch {
  // If we can't parse input, let the tool proceed without notification
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

const toolName = input.tool_name ?? "unknown";
const toolInput = input.tool_input ?? {};
const hookEvent = input.hookEventName ?? "PreToolUse";
const sessionId = input.sessionId ?? "";
const cwd = input.cwd ?? "";
const timestamp = input.timestamp ?? new Date().toISOString();

// ── Configuration ───────────────────────────────────────────────────────────
const webhookUrl = process.env.WEBHOOK_URL ?? process.env.TEAMS_WEBHOOK_URL;
const mode = (process.env.WEBHOOK_HOOK_MODE ?? process.env.TEAMS_HOOK_MODE ?? "notify").toLowerCase();

if (!webhookUrl) {
  // No webhook configured — just let the tool proceed silently
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ── Classify risk ───────────────────────────────────────────────────────────
const DESTRUCTIVE_TOOLS = new Set([
  "run_in_terminal",
  "multi_replace_string_in_file",
  "replace_string_in_file",
  "create_file",
]);

const DEFAULT_HIGH_RISK_PATTERNS = [
  /\brm\s+(-rf?|--recursive)/i,
  /\bdrop\s+table/i,
  /\bdrop\s+database/i,
  /\bgit\s+push\s+--force/i,
  /\bgit\s+reset\s+--hard/i,
  /\bformat\b.*\b[a-z]:/i,
  /\bdel\s+\/[sfq]/i,
];

// WEBHOOK_DENY_PATTERNS overrides the defaults (comma-separated regexes)
const userPatterns = process.env.WEBHOOK_DENY_PATTERNS;
const HIGH_RISK_PATTERNS = userPatterns
  ? userPatterns.split(",").map((p) => new RegExp(p.trim(), "i"))
  : DEFAULT_HIGH_RISK_PATTERNS;

function classifyRisk(name, toolInput) {
  const command = toolInput.command ?? toolInput.details ?? "";

  if (HIGH_RISK_PATTERNS.some((p) => p.test(command))) return "high";
  if (DESTRUCTIVE_TOOLS.has(name)) return "medium";
  return "low";
}

const risk = classifyRisk(toolName, toolInput);

// ── Build summary ───────────────────────────────────────────────────────────
function buildSummary(name, toolInput) {
  switch (name) {
    case "run_in_terminal":
      return `Terminal: ${toolInput.command ?? "(no command)"}`;
    case "replace_string_in_file":
    case "multi_replace_string_in_file":
      return `Edit: ${toolInput.filePath ?? toolInput.replacements?.[0]?.filePath ?? "(unknown file)"}`;
    case "create_file":
      return `Create: ${toolInput.filePath ?? "(unknown)"}`;
    case "editFiles":
      return `Edit files: ${JSON.stringify(toolInput.files ?? [])}`;
    default:
      return `${name}: ${JSON.stringify(toolInput).slice(0, 200)}`;
  }
}

const summary = buildSummary(toolName, toolInput);

// ── Build Adaptive Card ─────────────────────────────────────────────────────
const riskEmoji = { low: "🟢", medium: "🟡", high: "🔴" };

const card = {
  type: "message",
  attachments: [
    {
      contentType: "application/vnd.microsoft.card.adaptive",
      contentUrl: null,
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          {
            type: "TextBlock",
            size: "Medium",
            weight: "Bolder",
            text: `${riskEmoji[risk]} Copilot PreToolUse — ${toolName}`,
          },
          {
            type: "TextBlock",
            text: summary,
            wrap: true,
            weight: "Bolder",
          },
          {
            type: "FactSet",
            facts: [
              { title: "Tool", value: toolName },
              { title: "Risk", value: risk.toUpperCase() },
              { title: "Workspace", value: cwd },
              { title: "Session", value: sessionId.slice(0, 12) || "—" },
              { title: "Time", value: timestamp },
            ],
          },
          {
            type: "TextBlock",
            text: `\`\`\`\n${JSON.stringify(toolInput, null, 2).slice(0, 500)}\n\`\`\``,
            wrap: true,
            fontType: "Monospace",
            size: "Small",
          },
        ],
      },
    },
  ],
};

// ── Send to Teams ───────────────────────────────────────────────────────────
function sendWebhook(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;
    const data = JSON.stringify(body);

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(buf);
          else reject(new Error(`Teams webhook ${res.statusCode}: ${buf}`));
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
try {
  await sendWebhook(webhookUrl, card);
} catch (err) {
  // Notification failure should NOT block the tool — just warn
  const output = {
    continue: true,
    systemMessage: `⚠️ Webhook notification failed: ${err.message}`,
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

// ── Decide permission ───────────────────────────────────────────────────────
let permissionDecision = "allow"; // default: notify only, auto-approve
let permissionReason = "Teams notification sent";

if (mode === "ask") {
  permissionDecision = "ask";
  permissionReason = "Teams notification sent — awaiting user confirmation in VS Code";
} else if (mode === "deny_destructive" && risk === "high") {
  permissionDecision = "deny";
  permissionReason = `Blocked: high-risk operation (${summary})`;
}

const output = {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision,
    permissionDecisionReason: permissionReason,
  },
};

process.stdout.write(JSON.stringify(output));
process.exit(0);
