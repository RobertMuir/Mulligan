---
name: setup-mulligan
description: Set Mulligan up on a project — the .mulligan workspace and local-only .MulliganMem, model providers (cloud and local Llama/Ollama/llama.cpp/LM Studio/vLLM), manual or difficulty-based automatic routing, verification commands, the private rubric, and fan-out settings. Use for /setup-mulligan, "set up Mulligan", "connect models", "use a local model".
---

# Set up Mulligan

Do these in order. Show the developer each choice and let them make it; never write API keys into any file.

## 1. Create the workspace

```bash
Mulligan setup-mulligan
```

This creates `.mulligan/` (config, cookbook, golden PRs, verification, architecture, audit, memory history, sessions), an empty `.MulliganMem`, and the private rubric `.mulligan/verification/rubric.yaml`. It adds the local-only paths to `.gitignore`: `.MulliganMem`, `.mulligan/verification/`, `.mulligan/memory/`, `.mulligan/sessions/`, `.mulligan/audit/`, `.mulligan/handoffs/`. The cookbook, golden PRs and config are team standards and stay committed.

## 2. Connect models

Mulligan works with any mix of providers. Keys come from environment variables only.

| Kind | Example | Key |
|---|---|---|
| `anthropic` | `/models add claude anthropic claude-opus-5-5` | `ANTHROPIC_API_KEY` |
| `openai` | `/models add gpt openai <model-id>` | `OPENAI_API_KEY` |
| `gemini` | `/models add gemini gemini <model-id>` | `GEMINI_API_KEY` |
| `openrouter` (hundreds of models) | `/models add or openrouter <vendor/model>` | `OPENROUTER_API_KEY` |
| `mistral`, `groq`, `together`, `deepseek`, `xai`, `fireworks` | `/models add ds deepseek <model-id>` | `<VENDOR>_API_KEY` |
| `ollama` (local) | `/models add llama ollama llama3.1:8b` | none |
| `llamacpp` (local `llama-server`) | `/models add lc llamacpp <model>` | none |
| `lmstudio`, `vllm` (local) | `/models add lm lmstudio <model>` | none |
| `openai-compatible` (any other endpoint) | `/models add gw openai-compatible <model> MY_KEY https://host/v1` | your choice |

**Local models:** start the server (for example `ollama serve` and `ollama pull llama3.1`), then run `/models discover`. Mulligan finds models on the default ports of Ollama, llama.cpp, LM Studio and vLLM and offers to add them. Local models need no key, cost nothing per token, and keep code on the machine.

Ask the developer which providers they want, then confirm each shows ✓ in `/models`.

## 3. Choose how models are picked

- **Manual** (default): assign a provider per role — `/models assign reviewer gpt`. Roles: architect, implementer, reviewer, verifier, teacher, technical-writer. With only `default` set, Mulligan runs in single-model mode.
- **Automatic:** `/models routing auto` (add `--prefer-local` to use local models whenever they are capable enough). Each task is scored for difficulty from transparent factors — architecture, concurrency, security, data integrity, performance, number of files, Safety mode, the role, and every Mulligan already taken — and gets the cheapest ready model whose capability meets that difficulty. `/route <task>` shows the score, every factor and the choice.
  - Capability (1–5) is estimated from the model name; correct it with `/models capability <name> <1-5>`.
  - Factor weights can be tuned under `models.routing.weights` in `.mulligan/config.yaml`.
  - Roles listed in `models.routing.pinned` keep their manual assignment.

## 4. Verification commands

Add the commands that prove the project works to `.mulligan/config.yaml`:

```yaml
verification:
  commands:
    typecheck: npx tsc --noEmit
    test: npm test
    lint: npm run lint
```

Mulligan Review runs them, and fan-out runs them inside every candidate's sandbox. Offer to pre-approve them (`/permissions approve npm test`) so they run unattended; the developer decides. If the project cannot be checked by script yet, offer **create-verification-skill**.

## 5. Fan-out and the rubric

`loop.fanout` in the config controls the automatic fan-out: `auto`, `minDifficulty` (default 60), `count` (default 3), `verify`, and `judges`. The rubric in `.mulligan/verification/rubric.yaml` weights Correctness, the four Karpathy principles and project standards. It is private: judges see it, implementing models never do. Walk the developer through the weights if they want to tune them.

`loop.delegation` controls how Mulligan hands code to worker subagents: `mode` — `auto` (default: spawn workers without asking), `ask` (show the split first) or `off`; `maxWorkers` per wave (default 4); and `workerModel` (default `sonnet`; on Cursor use `fast`). Ask the developer which mode this project wants.

## 6. Next

Offer, in order: **setup-mulligan-cookbook** (team standards), **setup-mulligan-pr** (golden PRs), and a first **mulligan-review**.
