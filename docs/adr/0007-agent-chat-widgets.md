# ADR 0007: Widgets in the agent chat

Date: 2026-09-26. Status: accepted.

The owner wants a form in the agent chat for scheduling when the date or time is not given, and
similar widgets for other common requests. (A trial with a language model through OpenRouter
was withdrawn at the owner's request; the agent stays the rule-based scenario agent.)

## Decision
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
  - It is handled deterministically through `runAction`.
  - Every widget ends as a proposal. There is no new write path (rule 1).
- **State:**
  - Only the latest message's widget accepts input; older ones show "Sudah dilanjutkan".
  - No new table is needed.
- **Office-view lookups:** requests for a schedule, summary, completeness check or readiness
  check made from the office view find the berkas by the words of its title. The agent asks with
  a widget instead of refusing.
- **Dates:** a date in the past is never proposed; the form asks again.
