# k9s-doctor: Internal Design Specification

## Architecture

```
K9s plugin (Shift-E)
  │
  └─▶ k9s-doctor explain pod --context --namespace --name --container --kubeconfig
          │
          ├─ 1. Config load        internal/config/config.go
          ├─ 2. Collect            internal/collector/pod.go      → CollectionResult
          ├─ 3. Redact             internal/redact/redact.go      → sanitized strings
          ├─ 4. Prompt build       internal/agent/prompt.go       → system + user messages
          ├─ 5. LLM call           internal/agent/client.go       → DiagnosisResult
          ├─ 6. Validate           internal/schema/diagnosis.go   → error if invalid
          └─ 7. Render             internal/render/{text,json,markdown}.go → stdout
```

The LLM is a single bounded reasoning step. It receives fixed context and returns structured JSON. It does not have tools and cannot call kubectl. Context collection is deterministic and happens before the LLM call.

---

## Go Project Layout

```
k9s-doctor/
  README.md
  SPEC.md
  go.mod                              # module github.com/ejoliet/k9s-doctor
  go.sum
  cmd/
    k9s-doctor/
      main.go                         # cobra root, explain subcommand, version
  internal/
    agent/
      client.go                       # LLMClient: OpenAI-compatible HTTP POST
      prompt.go                       # builds system + user messages from CollectionResult
    collector/
      pod.go                          # CollectPod() → CollectionResult
      events.go                       # namespace event collection
      owner.go                        # owner reference traversal (RS → Deploy / Job)
    redact/
      redact.go                       # Redact(), SummarizeSecret()
    schema/
      diagnosis.go                    # DiagnosisResult struct, Validate()
      categories.go                   # Category and Confidence constants
    render/
      text.go                         # human-readable terminal output
      json.go                         # marshalled DiagnosisResult
      markdown.go                     # Slack/GitHub-friendly markdown
    config/
      config.go                       # env vars + config file merge
  examples/
    plugins.yaml                      # K9s plugin definition
    install.sh                        # idempotent install script
  tests/
    testdata/
      crashloop_pod.yaml
      missing_secret_describe.txt
      crashloop_logs.txt
      imagepull_pod.yaml
      oomkilled_pod.yaml
    redact_test.go
    schema_test.go
    collector_test.go
    render_test.go
```

### Dependencies

| Package                             | Use                        |
|-------------------------------------|----------------------------|
| `github.com/spf13/cobra`            | CLI subcommands and flags  |
| `encoding/json` (stdlib)            | JSON marshal/unmarshal     |
| `net/http` (stdlib)                 | LLM API HTTP calls         |
| `gopkg.in/yaml.v3`                  | Config file parsing        |
| `github.com/charmbracelet/lipgloss` | Terminal text styling      |

No LangChain, no LLM SDK wrapper, no Swival. The LLM integration is a single HTTP POST.

---

## LLM Abstraction

File: `internal/agent/client.go`

```go
type Client struct {
    BaseURL string
    Model   string
    APIKey  string
    Timeout time.Duration
}

// Complete sends a single bounded prompt and parses the response as DiagnosisResult.
// On JSON parse failure it saves a debug file and returns a fallback result.
func (c *Client) Complete(ctx context.Context, system, user string) (*schema.DiagnosisResult, error)
```

**Request shape** (OpenAI-compatible):

```json
{
  "model": "llama3.2",
  "messages": [
    {"role": "system", "content": "<system prompt>"},
    {"role": "user",   "content": "<collected context>"}
  ],
  "response_format": {"type": "json_object"},
  "temperature": 0.1
}
```

On JSON parse failure:
- Write raw response to `/tmp/k9s-doctor-debug-<unix-timestamp>.json`
- Return a `DiagnosisResult` with `Confidence: low`, `MissingContext: ["LLM returned invalid JSON — debug file saved"]`
- Never crash; always render something useful

---

## Prompt Contract

### System prompt

```
You are a Kubernetes incident triage assistant.
Analyze the selected resource using only the context provided below.
Return valid JSON only. No prose outside the JSON object.
Do not invent facts not present in the context.
Do not recommend destructive actions unless they are clearly safe and reversible.
Separate direct evidence from inference.
If the provided context is insufficient to diagnose the issue, populate missing_context.
Use only the diagnosis categories listed in the schema.
```

### User prompt template

```
## Selected Resource
Kind: Pod
Name: <name>
Namespace: <namespace>
Context: <kube-context>

## Pod Manifest (YAML)
<pod yaml — redacted>

## Pod Describe
<kubectl describe output — redacted>

## Logs (last 200 lines)
<logs — redacted>

## Previous Logs (if restart count > 0)
<previous logs or "unavailable">

## Namespace Events
<events sorted by lastTimestamp>

## Owner Chain
<replicaset/deployment/job yaml if collected, or "none">

## Missing Context
<list of artifacts that could not be collected>
```

Context is capped at 120,000 characters total. If over limit, truncate logs first, then events.

---

## Diagnosis Schema

File: `internal/schema/diagnosis.go`

```go
type Confidence string

const (
    ConfidenceLow    Confidence = "low"
    ConfidenceMedium Confidence = "medium"
    ConfidenceHigh   Confidence = "high"
)

type Category string

const (
    CategoryCrashLoop              Category = "crash_loop"
    CategoryImagePullError         Category = "image_pull_error"
    CategoryOOMKilled              Category = "oom_killed"
    CategoryResourcePressure       Category = "resource_pressure"
    CategoryNodePressure           Category = "node_pressure"
    CategoryPendingScheduling      Category = "pending_scheduling"
    CategoryMissingSecret          Category = "missing_secret"
    CategoryMissingConfigMap       Category = "missing_configmap"
    CategoryBadEnvConfig           Category = "bad_env_config"
    CategoryPermissionRBAC         Category = "permission_rbac"
    CategoryNetworkMisroute        Category = "network_misroute"
    CategorySelectorMismatch       Category = "service_selector_mismatch"
    CategoryReadinessProbe         Category = "readiness_probe_failure"
    CategoryLivenessProbe          Category = "liveness_probe_failure"
    CategoryStartupProbe           Category = "startup_probe_failure"
    CategoryDNSFailure             Category = "dns_failure"
    CategoryStorageMountFailure    Category = "storage_mount_failure"
    CategoryPVCPending             Category = "pvc_pending"
    CategoryJobFailed              Category = "job_failed"
    CategoryUnknown                Category = "unknown"
)

type DiagnosisResult struct {
    Resource                string     `json:"resource"`
    Namespace               string     `json:"namespace"`
    Category                Category   `json:"category"`
    Confidence              Confidence `json:"confidence"`
    Summary                 string     `json:"summary"`
    Evidence                []string   `json:"evidence"`
    LikelyCauses            []string   `json:"likely_causes"`
    VerifyCommands          []string   `json:"verify_commands"`
    SafeNextActions         []string   `json:"safe_next_actions"`
    DangerousActionsToAvoid []string   `json:"dangerous_actions_to_avoid"`
    MissingContext          []string   `json:"missing_context"`
}

func (d *DiagnosisResult) Validate() error
// checks: Resource non-empty, Namespace non-empty, Category is a known constant,
// Confidence is one of low/medium/high, Summary non-empty
```

---

## Pod Collector

File: `internal/collector/pod.go`

```go
type CollectorConfig struct {
    KubeContext string
    Namespace   string
    PodName     string
    Container   string
    KubeConfig  string
    LogTail     int    // default 200
    Timeout     time.Duration
}

type CollectionResult struct {
    Artifacts map[string]string  // key: artifact name, value: content
    Missing   []string           // artifact names that could not be collected
}

func CollectPod(ctx context.Context, cfg CollectorConfig) CollectionResult
```

**Collected artifacts (keys):**

| Key                    | Command                                                                 |
|------------------------|-------------------------------------------------------------------------|
| `pod_yaml`             | `kubectl get pod <name> -o yaml`                                        |
| `pod_describe`         | `kubectl describe pod <name>`                                           |
| `pod_logs`             | `kubectl logs <name> --tail=<tail>` (or `-c <container>`)              |
| `pod_logs_previous`    | `kubectl logs <name> --previous` (only if restart count > 0)           |
| `events`               | `kubectl get events --sort-by=.lastTimestamp`                           |
| `owner_replicaset`     | `kubectl get rs <name> -o yaml` (if pod has RS owner ref)              |
| `owner_deployment`     | `kubectl get deploy <name> -o yaml` (if RS has Deploy owner ref)       |
| `owner_job`            | `kubectl get job <name> -o yaml` (if pod has Job owner ref)            |

**Rules:**
- Each kubectl call uses `--context`, `--namespace`, `--kubeconfig` flags
- Each call has a per-command timeout of 10s (context timeout governs total)
- Failure of any single artifact appends the artifact name to `Missing` and continues
- Output is trimmed but not truncated at collection time (truncation happens at prompt-build time)

---

## Redaction Rules

File: `internal/redact/redact.go`

Redact the following patterns before sending any text to the LLM:

| Pattern                                      | Replacement             |
|----------------------------------------------|-------------------------|
| `Authorization: Bearer <token>`              | `Authorization: Bearer <REDACTED:token>` |
| `password=<value>` / `password: <value>`     | `password=<REDACTED:password>` |
| `token=<value>` / `token: <value>`           | `token=<REDACTED:token>` |
| `api_key=<value>` / `api_key: <value>`       | `api_key=<REDACTED:api_key>` |
| `client_secret=<value>`                      | `client_secret=<REDACTED:secret>` |
| `-----BEGIN ... PRIVATE KEY-----`            | `<REDACTED:private-key>` |
| Connection strings with embedded credentials | `<REDACTED:connection-string>` |
| `AWS_SECRET_ACCESS_KEY=<value>`              | `AWS_SECRET_ACCESS_KEY=<REDACTED:aws-secret>` |

Kubernetes Secret objects are never included as-is. Use `SummarizeSecret`:

```go
func SummarizeSecret(name, namespace string, keys []string) string
// Returns a JSON summary: {"kind":"Secret","name":"...","namespace":"...","keys":[...],"values_redacted":true}
```

The flag `--include-secret-values` does not exist in MVP.

---

## Rendering

### Text mode (default)

```
k9s-doctor: pod/<name>
Likely cause: <summary>
Confidence: <high|medium|low>
Evidence:
  - <evidence[0]>
  - <evidence[1]>
Verify:
  <verify_commands[0]>
  <verify_commands[1]>
Safe next action:
  <safe_next_actions[0]>
Avoid:
  <dangerous_actions_to_avoid[0]>
Missing context:
  <missing_context[0]>   (omitted if empty)
```

Use `charmbracelet/lipgloss` for confidence color coding: high=green, medium=yellow, low=red.

### JSON mode (`--output json`)

Marshal `DiagnosisResult` to indented JSON and print to stdout.

### Markdown mode (`--output markdown`)

Suitable for pasting into Slack, GitHub issues, or incident notes.

```markdown
## k9s-doctor: pod/<name>

**Likely cause:** <summary>
**Confidence:** high

### Evidence
- <evidence[0]>

### Verify
```
<verify_commands[0]>
```

### Safe next action
<safe_next_actions[0]>

### Avoid
<dangerous_actions_to_avoid[0]>
```

---

## Safety Model

### Allowed kubectl verbs (MVP)

```
get
describe
logs
top
```

### Disallowed in MVP (never called)

```
delete   apply   patch   edit   scale
rollout  drain   cordon  uncordon  exec
```

### Secret values

The collector does not call `kubectl get secret -o yaml` and pipe values through `base64 -d`. It may call `kubectl get secret <name> -o jsonpath='{.data}'` to enumerate key names only. Values are never collected.

### Log bounds

`--tail=200` by default. Configurable via `K9S_DOCTOR_LOG_TAIL` or config file. Maximum accepted value: 2000.

### No cluster mutations

MVP has no mutating code paths. Future phases require dry-run preview + explicit human confirmation before any mutation.

---

## K9s Plugin YAML

File: `examples/plugins.yaml`

```yaml
plugins:
  doctor-explain-pod:
    shortCut: Shift-E
    description: Explain selected pod (k9s-doctor)
    scopes:
      - po
    command: k9s-doctor
    background: false
    args:
      - explain
      - pod
      - --context
      - $CONTEXT
      - --namespace
      - $NAMESPACE
      - --name
      - $NAME
      - --container
      - $CONTAINER
      - --kubeconfig
      - $KUBECONFIG
```

`background: false` means K9s blocks and displays stdout in the terminal. The operator sees the diagnosis directly in the K9s pane.

---

## Configuration

File: `internal/config/config.go`

Precedence (highest to lowest): env vars → config file → defaults.

| Env Var                      | Config Key                  | Default                          |
|------------------------------|-----------------------------|----------------------------------|
| `K9S_DOCTOR_BASE_URL`        | `agent.base_url`            | `http://localhost:11434/v1`      |
| `K9S_DOCTOR_MODEL`           | `agent.model`               | `llama3.2`                       |
| `K9S_DOCTOR_API_KEY`         | `agent.api_key`             | `""`                             |
| `K9S_DOCTOR_TIMEOUT_SECONDS` | `agent.timeout_seconds`     | `45`                             |
| `K9S_DOCTOR_LOG_TAIL`        | `collection.log_tail`       | `200`                            |
| `K9S_DOCTOR_REDACT_SECRETS`  | `safety.redact_secrets`     | `true`                           |

Config file path: `$XDG_CONFIG_HOME/k9s-doctor/config.yaml` (falls back to `~/.config/k9s-doctor/config.yaml` if `XDG_CONFIG_HOME` is unset).

---

## Agent-Executable Build Phases

Each phase is a self-contained task. An agent can execute them sequentially; each phase has explicit acceptance criteria.

---

### Phase 0 — Go module skeleton

**Task:** Initialize the Go module and create the directory/file skeleton.

```bash
cd k9s-doctor
go mod init github.com/ejoliet/k9s-doctor
go get github.com/spf13/cobra
go get gopkg.in/yaml.v3
go get github.com/charmbracelet/lipgloss
```

Create the following files with correct package declarations and no implementation yet:

```
cmd/k9s-doctor/main.go           package main
internal/agent/client.go         package agent
internal/agent/prompt.go         package agent
internal/collector/pod.go        package collector
internal/collector/events.go     package collector
internal/collector/owner.go      package collector
internal/redact/redact.go        package redact
internal/schema/diagnosis.go     package schema
internal/schema/categories.go   package schema
internal/render/text.go          package render
internal/render/json.go          package render
internal/render/markdown.go      package render
internal/config/config.go        package config
```

Implement `cmd/k9s-doctor/main.go` with:
- cobra root command
- `explain pod` subcommand (stub that prints "not implemented")
- `--version` flag printing `0.1.0-dev`

**Acceptance:**
```bash
go build ./...          # exits 0
./k9s-doctor --version  # prints "0.1.0-dev"
./k9s-doctor explain pod --help  # prints flag list
```

---

### Phase 1 — Schema + redaction

**Task:** Implement `internal/schema/` and `internal/redact/`, with tests.

`internal/schema/categories.go`:
- All `Category` constants listed in the Diagnosis Schema section
- All `Confidence` constants

`internal/schema/diagnosis.go`:
- `DiagnosisResult` struct with all fields and JSON tags
- `Validate() error`: checks Resource non-empty, Namespace non-empty, Category is known, Confidence is known, Summary non-empty

`internal/redact/redact.go`:
- `Redact(input string) string`: applies all patterns from the Redaction Rules table
- `SummarizeSecret(name, namespace string, keys []string) string`: returns JSON summary string

Create `tests/testdata/` and add:
- `crashloop_pod.yaml` — realistic pod YAML in CrashLoopBackOff with an envFrom referencing a secret
- `missing_secret_describe.txt` — kubectl describe output showing missing secret key
- `crashloop_logs.txt` — logs showing "DATABASE_URL is required" error

Write table-driven tests:
- `tests/redact_test.go`: test each redaction pattern; test that non-sensitive text is not altered
- `tests/schema_test.go`: test `Validate()` with valid and invalid inputs; test JSON round-trip

**Acceptance:**
```bash
go test ./internal/redact/... ./internal/schema/...   # passes
```

---

### Phase 2 — Pod collector

**Task:** Implement `internal/collector/pod.go` with full subprocess logic and tests.

`CollectorConfig` and `CollectionResult` types as specified in the Pod Collector section.

`CollectPod(ctx context.Context, cfg CollectorConfig) CollectionResult`:
- Build kubectl command args for each artifact
- Execute with `exec.CommandContext(ctx, "kubectl", args...)`
- Each command has a 10s sub-timeout derived from `ctx`
- On error (non-zero exit, timeout): append artifact key to `Missing`, continue
- Parse restart count from `pod_yaml` artifact to decide whether to attempt `pod_logs_previous`
- Call `internal/redact.Redact()` on each artifact value before storing

`tests/collector_test.go`:
- Use a `CommandRunner` interface (or `exec.Cmd`-wrapping function) to inject a fake kubectl
- Test: normal pod collection returns expected artifact keys
- Test: kubectl failure for one artifact populates `Missing` and does not fail the others
- Test: container flag passes `-c <container>` to logs command
- No live cluster needed

**Acceptance:**
```bash
go test ./internal/collector/...   # passes without a live cluster
```

---

### Phase 3 — LLM client + config

**Task:** Implement `internal/agent/client.go`, `internal/agent/prompt.go`, `internal/config/config.go`.

`internal/config/config.go`:
- `Config` struct with all fields
- `Load() Config`: reads env vars first, then merges config file if present
- `(c Config) IsConfigured() bool`: returns false when `BaseURL` is the default AND no API key is set AND the default Ollama endpoint is unreachable (TCP connect to `localhost:11434` with 1s timeout)

`internal/agent/prompt.go`:
- `BuildPrompt(result collector.CollectionResult, podName, namespace, kubeContext string) (system, user string)`
- Applies the prompt template from the Prompt Contract section
- Truncates user prompt to 120,000 characters (logs first, then events)

`internal/agent/client.go`:
- `Client` struct and `NewClient(cfg config.Config) *Client`
- `Complete(ctx context.Context, system, user string) (*schema.DiagnosisResult, error)`
- On JSON error: writes debug file, returns fallback result

Write unit test for `BuildPrompt` verifying truncation behavior.
Write unit test for `Complete` using `httptest.NewServer` to mock the LLM endpoint.

**Acceptance:**
```bash
go test ./internal/agent/... ./internal/config/...   # passes
```

---

### Phase 4 — CLI + render

**Task:** Wire everything together in `cmd/k9s-doctor/main.go` and implement renderers.

`cmd/k9s-doctor/main.go`:
- `explain pod` command accepts all flags: `--context`, `--namespace`, `--name`, `--container`, `--kubeconfig`, `--output [text|json|markdown]`, `--summary`
- Calls: config.Load → **provider check** → collector.CollectPod → agent.BuildPrompt → client.Complete → render
- If `cfg.IsConfigured()` returns false, print the first-run help message (see below) and exit 0

**First-run message** (printed to stdout so K9s displays it in the plugin pane):

```
k9s-doctor: no LLM provider reachable.

Quick start with Ollama (local, free, no API key):
  ollama pull llama3.2
  # then press Shift-E again

Or configure a remote provider:
  export K9S_DOCTOR_BASE_URL=https://openrouter.ai/api/v1
  export K9S_DOCTOR_MODEL=anthropic/claude-3.5-haiku
  export K9S_DOCTOR_API_KEY=sk-or-...

See https://github.com/ejoliet/k9s-doctor#configure for all options.
```

The message must fit the K9s plugin pane (no pager needed). Add a test asserting this message is printed when `IsConfigured()` returns false.

`internal/render/text.go`:
- `RenderText(result *schema.DiagnosisResult, summary bool) string`
- Uses lipgloss for confidence color; falls back to plain text if stdout is not a TTY

`internal/render/json.go`:
- `RenderJSON(result *schema.DiagnosisResult) ([]byte, error)`

`internal/render/markdown.go`:
- `RenderMarkdown(result *schema.DiagnosisResult) string`

`tests/render_test.go`:
- Golden-output style test: given a known `DiagnosisResult`, assert output contains expected strings (not exact match)
- Test all three modes

End-to-end integration test in `tests/` using `httptest.NewServer` to mock the LLM and `exec.Command` mock for kubectl. Run `k9s-doctor explain pod` and assert on stdout.

**Acceptance:**
```bash
go build ./...
go test ./...                    # passes
./k9s-doctor explain pod --help  # shows all flags
```

---

### Phase 5 — Plugin YAML + install script

**Task:** Write `examples/plugins.yaml` and `examples/install.sh`.

`examples/plugins.yaml`: exact plugin definition as shown in the K9s Plugin YAML section.

`examples/install.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
PLUGINS_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/k9s"
mkdir -p "$PLUGINS_DIR"
DEST="$PLUGINS_DIR/plugins.yaml"
if [ -f "$DEST" ]; then
  echo "k9s-doctor: appending to existing $DEST"
  # append only if doctor-explain-pod key is absent
  grep -q "doctor-explain-pod" "$DEST" || cat examples/plugins.yaml >> "$DEST"
else
  cp examples/plugins.yaml "$DEST"
fi
echo "k9s-doctor: plugin installed at $DEST"
echo "Restart K9s and press Shift-E on a pod."
```

**Acceptance:**
- `yamllint examples/plugins.yaml` passes (or manual validation)
- `bash examples/install.sh` is idempotent (running twice does not duplicate entries)

---

## Error Handling Matrix

| Failure                          | Behavior                                                                 |
|----------------------------------|--------------------------------------------------------------------------|
| No LLM provider configured/reachable | Print first-run help message with Ollama quickstart + env var examples; exit 0 |
| `kubectl` not found in PATH      | Print: "k9s-doctor: kubectl not found. Install kubectl and retry."       |
| Invalid kube context             | Print: "k9s-doctor: context <ctx> not found in kubeconfig."              |
| Pod not found                    | Print: "k9s-doctor: pod <name> not found in namespace <ns>."             |
| metrics-server unavailable       | Continue; omit metrics from context; add to `missing_context`            |
| Logs unavailable (no container)  | Continue; add `pod_logs` to `Missing`                                    |
| LLM timeout                      | Print collected context summary + manual verification commands           |
| LLM returns invalid JSON         | Save debug file; print fallback result with `confidence: low`            |
| Config file parse error          | Print warning; continue with env vars and defaults                        |
| Total timeout (60s)              | Cancel context; print partial results if any                              |

---

## Performance Targets

| Stage              | Target   | Implementation note                                      |
|--------------------|----------|----------------------------------------------------------|
| Context collection | < 5s     | All kubectl calls run concurrently with `errgroup`       |
| LLM call           | < 45s    | Configurable via `K9S_DOCTOR_TIMEOUT_SECONDS`            |
| Total              | < 60s    | Root context timeout cancels all in-flight calls          |

The collector should use `golang.org/x/sync/errgroup` to run kubectl calls concurrently rather than sequentially.

---

## Distribution Plan

**goreleaser** (`goreleaser.yaml`):
- Builds linux/amd64, linux/arm64, darwin/amd64, darwin/arm64, windows/amd64
- Produces checksums and GitHub release assets
- Generates Homebrew formula for `ejoliet/homebrew-tap`

**Homebrew tap** (`ejoliet/homebrew-tap`):
- Auto-updated by goreleaser on each release tag

**curl install**:
```bash
curl -sSL https://github.com/ejoliet/k9s-doctor/releases/latest/download/install.sh | sh
```

---

## Open Questions (deferred)

1. Should the plugin cache diagnosis results per (pod UID, restart count) to avoid re-calling the LLM on the same crash?
2. Should `--output` in text mode open in a pager (`less`) when output exceeds terminal height?
3. Should Phase 3+ add `kubectl auth can-i` pre-flight checks to fail fast when RBAC blocks collection?
4. Should a future `--watch` mode re-diagnose automatically when restart count increments?
5. Should the tool support OpenTelemetry context propagation for correlation with traces?
6. Should `--output markdown` write to a temp file and open it in `$EDITOR` or `bat`?
