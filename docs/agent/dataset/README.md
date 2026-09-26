# Agent fine-tuning dataset (synthetic)

`verity-tools.synthetic.jsonl` teaches a model which Verity tool to call, and with which
arguments, for a request in Bahasa Indonesia, plus a few requests it must decline
(finalizing, numbering, signing, changing party data, and legal rules from memory).

- **Format:** OpenAI chat fine-tuning, one example per line. Each line has `messages`
  (system prompt, user, and the assistant's tool call or answer) and `tools`.
- **Source:** `apps/web/src/lib/agent/dataset/build.ts`. It reuses the scenario agent's parser
  and the OpenRouter tool specs, so the dataset, the scenario agent and the LLM agent agree.
- **Data:** synthetic only. The names are fictional (demo seed), the date is fixed at Friday
  25 September 2026, and no database content is included.
- **Regenerate:** `pnpm --filter @verity/web agent:dataset`. The normal unit test run fails if
  the file is out of date.

OpenRouter does not host custom fine-tunes. Training on this file happens elsewhere, and only
with synthetic data. Any model trained for production must run in Indonesia (PLAN.md §7,
ADR 0007).
