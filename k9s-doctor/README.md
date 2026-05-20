# k9s-doctor

Context-aware Kubernetes diagnosis from inside K9s.

`k9s-doctor` is a K9s plugin that explains failing Kubernetes resources using the object the operator is already looking at. Press **Shift-E** on a pod and get a concise, evidence-backed diagnosis — no copy-pasting logs into a chat window.

---

## Status

**Prototype / RDD.** This repository defines the design, plugin contract, safety model, and implementation plan. Phase 0 code is in progress.

---

## Motivation

Kubernetes debugging is a context-gathering problem before it is a reasoning problem. Operators routinely switch between:

```
kubectl describe pod ...
kubectl logs ...
kubectl get events ...
kubectl get deploy / rs / svc / ingress ...
kubectl top pod ...
```

K9s already knows the selected resource, namespace, cluster context, container, and kubeconfig. `k9s-doctor` uses that to collect bounded live context automatically, then asks a local or remote LLM for a structured diagnosis.

The goal is not a general Kubernetes chatbot. The goal is to make K9s better at the moment an operator is already investigating something.

---

## Example

An operator opens K9s, navigates to a pod in `CrashLoopBackOff`, and presses **Shift-E**.

```
k9s-doctor: pod/api-7c9b9f9d4f-m2r8q
Likely cause: missing configuration value
Confidence: high
Evidence:
  - container exited after config validation
  - logs show: "DATABASE_URL is required"
  - deployment references envFrom secret api-runtime
  - secret api-runtime exists, but key DATABASE_URL was not found
Verify:
  kubectl -n api get secret api-runtime -o yaml
  kubectl -n api describe pod api-7c9b9f9d4f-m2r8q
Safe next action:
  Restore DATABASE_URL in api-runtime or roll back the secret/config change.
Avoid:
  Do not repeatedly delete the pod; it will restart with the same missing config.
```

---

## Install

### Homebrew (recommended)

```bash
brew install ejoliet/tap/k9s-doctor
```

### curl

```bash
curl -sSL https://github.com/ejoliet/k9s-doctor/releases/latest/download/install.sh | sh
```

### Build from source

```bash
git clone https://github.com/ejoliet/k9s-doctor
cd k9s-doctor
go build -o k9s-doctor ./cmd/k9s-doctor
mv k9s-doctor /usr/local/bin/
```

---

## Configure

`k9s-doctor` does not ship a model. You bring your own provider — local or remote.

If no provider is reachable when you press Shift-E, the plugin pane shows a first-run message instead of timing out:

```
k9s-doctor: no LLM provider reachable.

Quick start with Ollama (local, free, no API key):
  ollama pull llama3.2
  # then press Shift-E again

Or configure a remote provider:
  export K9S_DOCTOR_BASE_URL=https://openrouter.ai/api/v1
  export K9S_DOCTOR_MODEL=anthropic/claude-3.5-haiku
  export K9S_DOCTOR_API_KEY=sk-or-...
```

`k9s-doctor` is local-first. By default it talks to [Ollama](https://ollama.com) running on your machine.

```bash
# Ollama (default)
export K9S_DOCTOR_BASE_URL=http://localhost:11434/v1
export K9S_DOCTOR_MODEL=llama3.2

# OpenRouter (remote)
export K9S_DOCTOR_BASE_URL=https://openrouter.ai/api/v1
export K9S_DOCTOR_MODEL=anthropic/claude-3.5-haiku
export K9S_DOCTOR_API_KEY=sk-or-...

# Anthropic direct
export K9S_DOCTOR_BASE_URL=https://api.anthropic.com/v1
export K9S_DOCTOR_MODEL=claude-haiku-4-5-20251001
export K9S_DOCTOR_API_KEY=sk-ant-...
```

Any OpenAI-compatible endpoint works (LM Studio, llama.cpp, vLLM, etc.).

Optional config file at `$XDG_CONFIG_HOME/k9s-doctor/config.yaml` (environment variables take precedence):

```yaml
agent:
  base_url: http://localhost:11434/v1
  model: llama3.2
  api_key: ""
  timeout_seconds: 45
collection:
  log_tail: 200
  include_previous_logs: true
  include_events: true
  include_owner_chain: true
safety:
  redact_secrets: true
output:
  default_format: text
```

---

## Add the K9s Plugin

```bash
mkdir -p "$XDG_CONFIG_HOME/k9s"
cp examples/plugins.yaml "$XDG_CONFIG_HOME/k9s/plugins.yaml"
# or append to an existing plugins.yaml
```

Restart K9s. Navigate to a pod and press **Shift-E**.

---

## Shortcuts

| Shortcut | Name    | Scope                        | Status |
|----------|---------|------------------------------|--------|
| Shift-E  | Explain | po, deploy, sts, ds, job     | MVP    |
| Shift-N  | Network | po, svc, ing                 | Future |
| Shift-S  | Safety  | all                          | Future |
| Shift-D  | Drift   | deploy, sts, ds, svc, ing    | Future |

MVP implements **Shift-E for pods only**.

---

## Usage

```bash
# Called automatically by K9s plugin, or run directly:
k9s-doctor explain pod \
  --context dev \
  --namespace api \
  --name api-7c9b9f9d4f-m2r8q \
  --container api

# JSON output
k9s-doctor explain pod --context dev --namespace api --name api-pod --output json

# Markdown (for pasting into Slack/GitHub)
k9s-doctor explain pod --context dev --namespace api --name api-pod --output markdown

# Short summary only
k9s-doctor explain pod --context dev --namespace api --name api-pod --summary

k9s-doctor version
```

---

## Safety Model

`k9s-doctor` is **read-only by default**. It will never mutate your cluster.

**Allowed kubectl verbs:** `get`, `describe`, `logs`, `top`

**Never called in MVP:** `delete`, `apply`, `patch`, `edit`, `scale`, `rollout restart`, `drain`, `cordon`

**Secret handling:** The plugin detects secret references but never sends decoded secret values to the LLM. It sends only secret names, key names, and whether a referenced key exists. Logs are scanned for common credential patterns and redacted before the LLM call.

**Bounded context:** Logs are capped at `--tail=200` by default. Total context sent to the LLM is capped at 120,000 characters.

---

## Non-Goals

- Not a replacement for K9s or kubectl
- Not an autonomous remediation system
- Not a general Kubernetes chatbot
- Does not mutate clusters without explicit human approval (MVP: never mutates)
- Not a full observability platform

---

## Configuration Reference

| Environment Variable         | Default                          | Description                              |
|------------------------------|----------------------------------|------------------------------------------|
| `K9S_DOCTOR_BASE_URL`        | `http://localhost:11434/v1`      | OpenAI-compatible API base URL           |
| `K9S_DOCTOR_MODEL`           | `llama3.2`                       | Model name passed to the API             |
| `K9S_DOCTOR_API_KEY`         | _(empty)_                        | API key (not needed for local Ollama)    |
| `K9S_DOCTOR_TIMEOUT_SECONDS` | `45`                             | LLM call timeout                         |
| `K9S_DOCTOR_LOG_TAIL`        | `200`                            | Lines of logs to collect                 |
| `K9S_DOCTOR_REDACT_SECRETS`  | `true`                           | Redact credential patterns before LLM   |

---

## Performance Targets

| Stage              | Target   |
|--------------------|----------|
| Context collection | < 5s     |
| LLM call           | < 45s    |
| Total              | < 60s    |

If the LLM call times out, `k9s-doctor` prints the collected context summary and suggests manual verification commands.

---

## Security Notice

`k9s-doctor` sends cluster metadata (pod YAML, logs, events, manifests) to the configured model provider. For remote providers, data leaves your environment. Provider choice determines data handling. Use a local model (Ollama, LM Studio) if your cluster contains sensitive workloads.

API keys are read from environment variables or the config file. They are never stored in the K9s plugin YAML.
