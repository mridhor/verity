# ADR 0007: OpenRouter agent for the synthetic demo; widgets in the agent chat

Date: 2026-09-26. Status: accepted.

The owner wants the chat agent to run on a language model from OpenRouter, grounded in Verity's
context. The owner also wants a form in the chat for scheduling when the date or time is not
given, plus similar widgets for other common requests.

PLAN.md:16 and §10.3 bar OpenRouter from receiving client data, because it forwards prompts to
providers outside Indonesia. The owner chose to use it **only on the demo, which holds
synthetic data**. For "fine-tuned", the owner chose a Verity-specific system prompt and tools
now, and a synthetic dataset for a later fine-tune. OpenRouter itself hosts no custom fine-tunes.

## Decision

### OpenRouter agent (`VERITY_AGENT_PROVIDER=openrouter`)
- **Guard:** the provider refuses to run unless `VERITY_DATA_CLASS=synthetic`, and it accepts
  only models on an allow-list in code (`lib/agent/openrouter/config.ts`, with tests).
  - Default model: `anthropic/claude-sonnet-5`.
  - Production keeps `scenario` until the in-country engine exists (PLAN.md §7).
- **Tools** are the scenario agent's skills behind function schemas (`tool-specs.ts`,
  `tools.ts`):
  - They read under the user's RLS and never write. The only writes are proposals through
    `create_proposed_changes`, still approved by a person (rule 1).
  - The model's arguments are coerced. A past date is never proposed.
  - Tests check that the folder has no `insert`/`update`/`delete`, builds no database client, and
    calls no URL except OpenRouter.
- **Answering:**
  - The model reads the skills' output: text with `[[cN]]` markers, table rows, and a sources map.
  - It writes the answer. The UI shows that answer together with the skills' tables, widgets,
    proposals and links.
  - Markers the tools did not produce are removed by the existing citation validation, and the
    paragraph is flagged "tanpa sumber yang valid".
- **Limits:**
  - at most 4 tool rounds and a 45-second timeout per call
  - the last 12 messages of the thread as history
  - `temperature` 0.2
- **Privacy:**
  - Requests carry `provider: {data_collection: "deny", zdr: true}`, so only zero-retention
    endpoints that do not collect data are used.
  - Errors log only the failure kind and status, never the prompt (rule 9).
- **System prompt** (`system-prompt.ts`):
  - Covers the office vocabulary, the page context and today's date in WIB.
  - Sets the hard limits: read-only, no finalizing, numbering or signing, akta verification
    and approval manual (ADR 0006), and no legal rules from memory (rule 8).
  - Answers use only facts from tool results, cited with the given markers.
  - When something is missing, the agent asks through a widget instead of guessing.

### Where the API key lives
- **Place:** Vercel, as the server-only env var `OPENROUTER_API_KEY`, marked Sensitive, on the
  demo project (Production, and Preview if used). No `NEXT_PUBLIC_` prefix.
- **Why:**
  - The agent runs in the Next.js route `/api/agent` (region sin1), so the key is read on the
    server and never reaches the browser.
  - A Supabase Edge Function would add a hop without any security gain.
  - A separate AI gateway would add another data processor.
- **On the OpenRouter account:**
  - set a credit limit on the key
  - turn off prompt logging and training in the privacy settings
- **Production gets no OpenRouter key.**

### Widgets
- **New event `widget` in the contract** (`packages/schema/schemas/agent-event.schema.json`).
  There are four kinds:
  - `schedule_form`: date, time, kind, room and title, plus the berkas when it is not known.
    Shown when a schedule request lacks the berkas, date or time.
  - `checklist_form`: item and due date. Shown when a checklist request has no item.
  - `berkas_picker`: shown when several berkas match a request made from the office view; the
    request then continues for the chosen berkas.
  - `checklist_batch`: shown after a completeness check. It lists what is missing, with a due date
    the day before the next signing if one is booked. The user ticks items and they become one
    proposal.
- **Answers:**
  - The answer to a widget is an `AgentAction` (`agent-action.schema.json`), sent with a readable
    summary as the next user message.
  - Both providers handle it deterministically through `runAction`. It never goes to a model,
    because the values are the user's own.
  - Every widget ends as a proposal. There is no new write path.
- **State:**
  - Only the latest message's widget accepts input; older ones show "Sudah dilanjutkan".
  - No new table is needed.
- **Office-view lookups:** requests for a schedule, summary, completeness check or readiness
  check made from the office view find the berkas by the words of its title. The agent asks with
  a widget instead of refusing.

### Fine-tuning dataset (later)
- **File:** `docs/agent/dataset/verity-tools.synthetic.jsonl`. It holds 140 examples in OpenAI
  chat format: which tool to call with which arguments, plus requests the agent must decline.
- **Source:** built by `lib/agent/dataset/build.ts` from the scenario agent's own parser. The
  unit tests fail if the file is out of date.
- **Training:** happens outside OpenRouter, on synthetic data only. A production model must run
  in Indonesia.

## Not yet
- Streaming the model's answer token by token. The answer arrives whole; steps stream per tool.
- A groundedness check (REQ-AI-06 c) beyond citation validation.
- Using the dataset to train a model.
