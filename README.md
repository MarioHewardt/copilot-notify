# Copilot Webhook Notifier

Sends a webhook notification every time VS Code Copilot (agent mode) is about to invoke a tool — terminal commands, file edits, file creation/deletion, etc.

Works with **Microsoft Teams, Slack, Discord**, or any HTTP endpoint that accepts JSON POST requests.

Uses [VS Code Agent Hooks](https://code.visualstudio.com/docs/copilot/customization/hooks) (`PreToolUse`) for deterministic, guaranteed execution. No extension needed — just a JSON config and a Node.js script.

## How It Works

```
Copilot determines it needs to invoke a tool
        │
        ▼
VS Code fires the PreToolUse hook (deterministic, every time)
        │
        ▼
scripts/copilot-notify.mjs receives tool_name + tool_input via stdin
        │
        ▼
Adaptive Card is POSTed to your webhook URL
        │
        ▼
Hook returns permissionDecision (allow / ask / deny)
```

## Files

```
.github/hooks/copilot-notify.json   ← Hook configuration
scripts/copilot-notify.mjs          ← Hook script (Node.js, zero dependencies)
```

## Setup

### Quick install (one-liner)

**Bash / macOS / Linux:**
```bash
curl -sL https://raw.githubusercontent.com/MarioHewardt/copilot-notify/main/setup.sh | bash
```

**PowerShell / Windows:**
```powershell
irm https://raw.githubusercontent.com/MarioHewardt/copilot-notify/main/setup.ps1 | iex
```

Run either command from the **root of your repo**. It downloads the two required files into the right locations.

### Manual install

Copy these two paths into your project:

```
your-repo/
├── .github/hooks/copilot-notify.json
└── scripts/copilot-notify.mjs
```

### 2. Create a webhook URL

**Microsoft Teams:**
1. Go to your channel → **⋯** → **Connectors** → **Incoming Webhook** → **Configure**
2. Or use **Workflows** → **"Post to a channel when a webhook request is received"**

**Slack:**
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create app → **Incoming Webhooks** → Activate

**Any HTTP endpoint:**
Any URL that accepts a JSON POST will work.

### 3. Set the environment variable

```powershell
# PowerShell (persistent for current user)
[Environment]::SetEnvironmentVariable("WEBHOOK_URL", "https://your-webhook-url-here", "User")
```

```bash
# Bash
export WEBHOOK_URL="https://your-webhook-url-here"
# Or add to ~/.bashrc / ~/.zshrc for persistence
```

Alternatively, set it directly in `.github/hooks/copilot-notify.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",
        "command": "node ./scripts/copilot-notify.mjs",
        "windows": "node .\\scripts\\copilot-notify.mjs",
        "timeout": 15,
        "env": {
          "WEBHOOK_URL": "https://your-webhook-url-here"
        }
      }
    ]
  }
}
```

### 4. Restart VS Code

The hook activates automatically when VS Code detects `.github/hooks/copilot-notify.json`.

## Modes

Set the `WEBHOOK_HOOK_MODE` environment variable to control behavior:

| Mode | Behavior |
|------|----------|
| `notify` (default) | Send notification, auto-approve tool execution |
| `ask` | Send notification, require user confirmation in VS Code |
| `deny_destructive` | Block high-risk operations, notify on others |

## Risk Classification

| Risk | Criteria |
|------|----------|
| **High** 🔴 | Commands matching deny patterns (see below) |
| **Medium** 🟡 | Destructive tools: `run_in_terminal`, `replace_string_in_file`, `create_file` |
| **Low** 🟢 | Read-only tools: searches, file reads, etc. |

### Custom deny patterns

Set `WEBHOOK_DENY_PATTERNS` to a comma-separated list of regexes to define what "high risk" means to you:

```powershell
# PowerShell
[Environment]::SetEnvironmentVariable("WEBHOOK_DENY_PATTERNS", "rm\s+-rf,DROP\s+TABLE,kubectl\s+delete,docker\s+rm", "User")
```

```bash
# Bash
export WEBHOOK_DENY_PATTERNS="rm\s+-rf,DROP\s+TABLE,kubectl\s+delete,docker\s+rm"
```

If not set, the defaults are:

| Pattern | Catches |
|---------|---------|
| `rm -rf` | Recursive file deletion |
| `DROP TABLE` / `DROP DATABASE` | SQL destruction |
| `git push --force` | Force push |
| `git reset --hard` | Discarding work |
| `format ... C:` | Disk formatting |
| `del /s /f /q` | Windows bulk deletion |

## Notification Format

Messages are sent as [Adaptive Cards](https://adaptivecards.io/) with:

- **Title**: Risk emoji + tool name (e.g., "🟡 Copilot PreToolUse — run_in_terminal")
- **Summary**: Human-readable description of the action
- **Facts**: Tool name, risk level, workspace, session ID, timestamp
- **Details**: The `tool_input` JSON (truncated to 500 chars)

## Backward Compatibility

If you're migrating from an earlier version, the old environment variables still work:

| Old variable | New variable |
|---|---|
| `TEAMS_WEBHOOK_URL` | `WEBHOOK_URL` |
| `TEAMS_HOOK_MODE` | `WEBHOOK_HOOK_MODE` |

## License

MIT
