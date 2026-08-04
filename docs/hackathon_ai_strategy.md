# Hackathon AI Strategy

**Goal:** Make Kahayag's AI implementation compelling enough to win an international hackathon focused on AI innovation.

**Last updated:** August 2026

---

## Executive Summary

Kahayag has **AI breadth** (report narrative, design chat, quote audit, OCR) but **shallow agent depth** — the design agent plans tools without seeing real results, and the frontend never shows the reasoning chain. Judges need to *see* the AI think.

**Two pillars to ship:**

| Pillar | Hackathon role | Effort |
|--------|----------------|--------|
| **Quote Truth Engine** | The "wow" demo — upload quote → forensic audit → visual diff | 1–2 days |
| **True agent loop** | The "technical depth" story — observe → act → revise | 1–2 days |

Either alone is good. Both together is a top-tier pitch.

---

## Current State Assessment

### Strengths

| Area | Why judges notice |
|------|-------------------|
| End-to-end product | Property → roof → sizing → design → compare → PDF report |
| Real engineering | PH catalog, constraint solver, Google Solar shading |
| Responsible AI | Numbers from domain; AI narrates/parses only |
| Quote auditor | Genuinely differentiated vs generic solar calculators |
| Resilience | Works without API keys (`APP_AI_PROVIDER=disabled`) |

### Gaps

| Gap | Why it matters |
|-----|----------------|
| AI feels like a layer, not the hero | Report prose, Q&A, quote summary = mostly single-shot LLM calls |
| "Agent" isn't visibly agentic | Tool schemas exist, but no observe → act → revise loop |
| Default demo path may be AI disabled | Regex/templates work, but don't wow |
| No single "holy shit" demo moment | Solid workflow, but nothing that makes a judge lean forward |

**Rough scores for international hackathon AI judging:**

- Product completeness: **7/10**
- AI innovation: **4–5/10**
- Demo potential: **6/10**

### Is the agentic AI a killer feature today?

**Not yet.** The architecture is sound, but it won't win on "agent" branding alone.

Current flow:

```
User message → LLM plans tools (with fake "queued" responses)
             → backend runs tools sequentially
             → separate LLM call for final reply
```

This is **light orchestration**, not an agent loop. With `APP_AI_PROVIDER=disabled`, it's mostly keyword routing and templates.

**Key code smell:** In `backend/app/integrations/ai/design_agent.py`, tool results during planning are fake:

```python
messages.append({
    "role": "tool",
    "tool_call_id": call["id"],
    "content": json.dumps({"status": "queued"}),
})
```

The LLM plans blind. `run_design_agent_turn` in `backend/app/features/design/agent.py` then executes without replanning.

---

## Pillar 1: Quote Truth Engine

**Highest demo ROI.** Already in progress via `quote_diagram.py`, `extract_quote_lines()`, and canvas toggle.

### What to ship

#### 1. Finish the pipeline (mostly done)

- `backend/app/features/design/quote_diagram.py` → BOM components on canvas
- `extract_quote_lines()` in `backend/app/integrations/ai/quote_auditor.py` → line-item extraction
- Canvas toggle: Kahayag design vs uploaded quote (`SystemCanvas.tsx`)

#### 2. Component-level diff (new — high impact)

After deterministic findings in `quote_audit.py`, add per-component comparison:

- `missing_component` — installer quote lacks breakers/surge
- `substitution` — different inverter model than benchmark
- `line_item_inflation` — single line 40% above catalog tier

Wire `compare_vendors` (currently a stub in `design_tools.py`) into quote audit so findings can cite catalog min/max tiers.

#### 3. Negotiation brief (new — killer output)

Extend `QuoteAuditResponseSchema`:

```python
negotiation_brief: str  # LLM prose FROM deterministic findings only
questions_for_installer: tuple[str, ...]  # templated from findings
```

Prompt pattern: *"Given these findings [JSON], write 3 questions the homeowner should ask their installer. Do not invent numbers."*

#### 4. Side-by-side Compare UI (new — visual wow)

On the Compare page, after upload:

- Left card: Kahayag benchmark (kWp, panels, ₱ total)
- Right card: Extracted quote
- Red/yellow/green badges on mismatches
- Button: **"View on diagram"** → canvas with diff highlights

#### 5. Demo safety

- Ship `fixtures/demo_installer_quote.pdf` (or `.png`) in repo
- Pre-load in demo mode so OCR never fails live
- Force `APP_AI_PROVIDER=groq` + Vision key for demo

### Demo script (90 seconds)

```
"Maria got a quote from an installer for ₱450k. Is it fair?"
→ Upload PDF
→ AI extracts: 6.5 kWp, 12 panels, ₱450,000
→ Red flag: 18% above Kahayag benchmark
→ Yellow: missing surge protection line item
→ Toggle canvas: see component diff
→ "Questions to ask your installer" appears
```

**Pitch line:** *"AI that reads installer quotes so Filipino homeowners don't get ripped off."*

---

## Pillar 2: True Agent Loop

The core architectural fix. Move from blind planning to interleaved plan → execute → observe.

### Target flow

```
User: "Add battery backup under ₱300k"
         ↓
LLM calls run_solver(goal=backup)
         ↓
Execute → 0 valid combos
         ↓
LLM sees result → get_rejection_reasons
         ↓
LLM sees "inverter too small for battery"
         ↓
LLM calls query_catalog(batteries)
         ↓
LLM calls update_build(change_request=...)
         ↓
Execute → success, 5.2 kWh battery, ₱285k
         ↓
LLM generates final reply with real numbers
```

### Backend changes

#### 1. Refactor `run_design_agent_turn` (`agent.py`)

Move the loop into the feature layer. Groq client handles one LLM round-trip per iteration with **real** tool results fed back.

#### 2. Change `plan_tool_calls` → `next_tool_calls` (`design_agent.py`)

One iteration: send messages + tools → get tool_calls OR final text. Remove fake `"queued"` responses.

#### 3. Bump `MAX_TOOL_ITERATIONS` to 6 (`design_tools.py`)

Enough for solver-fail → diagnose → retry.

#### 4. Return reasoning steps to frontend

Extend `AgentDesignResponse` in `schemas.py`:

```python
reasoning_steps: tuple[ReasoningStepSchema, ...]

class ReasoningStepSchema(ContractModel):
    kind: Literal["thinking", "tool_call", "tool_result", "error"]
    label: str          # "Running solver with backup goal"
    detail: str | None  # "12 combos rejected — inverter undersized"
```

Populate from `tool_audit` with human-readable labels.

#### 5. Add tool: `audit_quote`

Bridge quote auditor into the agent so users can say in chat:

> *"Audit the quote I uploaded and tell me if I should negotiate"*

```python
{
    "name": "audit_quote",
    "description": "Compare uploaded installer quote against active build",
}
```

This unifies both pillars in one conversational surface.

---

## Pillar 3: Visible Reasoning UI

The frontend currently shows only final text. `agent_audit` exists in the session but `DesignChat.tsx` never renders it.

### Changes to `DesignChat.tsx`

#### 1. Show reasoning steps during execution

Replace static "Thinking…" with a live step list:

```
◉ Running solver (backup goal)…
◉ 12 combinations rejected
◉ Checking rejection reasons…
◉ Retrying with larger inverter…
✓ Updated to 5.2 kWh battery, ₱285k
```

#### 2. Collapsible "How I decided" on each assistant message

Expand to show `reasoning_steps` or `session.agent_audit[-1].tool_calls`.

#### 3. Optional: SSE streaming (polish, not required)

`POST /designs/agent/stream` emitting `{type: "step", label: "..."}` events. High wow factor but skip if time is tight — returning steps in the response is enough.

#### 4. Demo prompts as quick chips

Add to `ASK_AI_CHIPS` in `designViewModel.ts`:

- *"Why was this inverter chosen?"*
- *"Add backup for blackouts under my budget"*
- *"What got rejected in the last solve?"*

The third specifically triggers the visible agent loop.

---

## What NOT to Do

| Skip | Why |
|------|-----|
| Multi-agent orchestration | One good loop beats three shallow agents |
| RAG / vector DB | Session snapshot is enough for this domain |
| Moving calculations into prompts | Breaks the best architectural story |
| Generic "AI chat" marketing | Judges have seen 200 of these |
| Building new AI features from scratch | Polish quote audit + agent loop first |

---

## Prioritized Execution Plan

### Day 1 — Agent loop (backend)

1. Refactor `run_design_agent_turn` to interleaved loop
2. Real tool results fed back to Groq each iteration
3. Add `reasoning_steps` to `AgentDesignResponse`
4. Test: *"Add battery backup"* when solver initially fails

### Day 2 — Agent loop (frontend) + Quote diff

1. Render `reasoning_steps` in `DesignChat`
2. Finish quote diagram integration on canvas
3. Component-level diff findings in `quote_audit.py`
4. Side-by-side cards on Compare page

### Day 3 — Demo polish

1. `negotiation_brief` + questions for installer
2. Demo quote fixture + env config for live demo
3. Rehearse 3-minute pitch with scripted flow
4. Add `audit_quote` tool (if time)

### Day 4 — Buffer / stretch

1. SSE streaming for agent steps
2. Multi-quote upload (2 quotes ranked)
3. Report page inline AI preview

---

## Pitch Script

**Don't say:** *"We built an AI agent for solar."*

**Do say:**

> *"Kahayag protects Filipino homeowners from bad solar quotes. Our engineering engine computes every number deterministically. AI handles what humans can't — reading messy installer PDFs, reasoning through design constraints when the solver rejects combinations, and generating negotiation scripts. The AI never invents a price."*

### 3-minute demo flow

1. Assessment (30 sec — skip quickly)
2. **Quote upload → red flags → diagram diff** (60 sec)
3. **Chat: "Add backup under ₱300k" → visible reasoning steps** (60 sec)
4. PDF report download (15 sec)

---

## Success Criteria

| Test | Pass condition |
|------|----------------|
| Agent recovery | User asks for backup → solver fails → agent reads rejections → retries → succeeds |
| Visible reasoning | 3+ steps shown in chat UI, not just final reply |
| Quote demo | Upload demo PDF → findings + diagram + negotiation questions in <10 sec |
| No-AI fallback | Still works with `disabled` — but demo uses Groq |
| Architecture story | Can point to code where AI parses/explains and domain computes |

---

## Key Files Reference

| File | Role |
|------|------|
| `backend/app/features/design/agent.py` | Agent dispatch loop — refactor target |
| `backend/app/integrations/ai/design_agent.py` | Groq/disabled client — remove fake queued responses |
| `backend/app/integrations/ai/design_tools.py` | Tool schemas, `MAX_TOOL_ITERATIONS` |
| `backend/app/features/design/quote_audit.py` | Quote benchmark + findings |
| `backend/app/features/design/quote_diagram.py` | Quote → BOM diagram mapping |
| `backend/app/integrations/ai/quote_auditor.py` | OCR + extraction + summary |
| `frontend/src/features/design/DesignChat.tsx` | Chat UI — add reasoning steps |
| `frontend/src/features/compare/QuoteAuditorCard.tsx` | Quote upload UI |
| `frontend/src/features/design/SystemCanvas.tsx` | Diagram toggle |

---

## Architecture Principle (keep this in the pitch)

**The domain computes; AI explains.**

Every technical and financial number comes from `backend/app/domain/`. AI adapters may phrase those values in plain language. An agent must never move a calculation into a prompt, and never let a model output a number that was not computed deterministically.

This is a **strength**, not a limitation. It shows responsible AI — rare at hackathons.
