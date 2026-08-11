# Agent decision protocol — v4.2.2-format-only HTML-native

## Purpose

The Agent is the primary paragraph editor. The HTML preparation script only makes existing prose paragraphs addressable and exposes **safe raw HTML offsets**. The Agent never returns replacement prose or replacement HTML.

## Required file shape

Create one JSON file for every packet under `decisions/`, using the same basename:

```json
{
  "schema_version": 4,
  "packet_id": "p0001",
  "reviewed": true,
  "decisions": [
    {
      "unit_id": "u000001_0000",
      "importance": "normal",
      "break_after": false,
      "reason": "The next sentence completes the same action beat."
    },
    {
      "unit_id": "u000001_0001",
      "importance": "pivotal_dialogue",
      "break_after": true,
      "reason": "The refusal reverses the scene and deserves isolation."
    },
    {
      "unit_id": "u000014_0000",
      "importance": "normal",
      "break_after": true,
      "split_after_offsets": [28741],
      "reason": "The supplied semicolon boundary is grammatically complete on both sides."
    }
  ]
}
```

`split_after_offsets` in this formatter are **absolute raw source offsets** supplied by the packet. Never invent or calculate a different HTML offset.

## Coverage rule

`required_editable_unit_ids` is authoritative. Include exactly one decision for every listed ID.

Each `decisions/pNNNN.json` may contain decisions only for units belonging to that same packet. The renderer rejects cross-packet unit IDs even if the global unit ID exists elsewhere.

Even when a unit is ordinary, explicitly choose `break_after=true` or `false`. This prevents the helper script from becoming the editor by default.

## Existing HTML paragraph rule

Each source `<p>` is a hard semantic boundary. `break_after=false` may keep neighboring units inside that source paragraph together, but it never merges two different source `<p>` blocks.

This is intentional: Standard Ebooks and Gutenberg HTML already encode author/editor paragraph structure. The formatter may make mobile-friendly subdivisions without flattening semantic paragraphs.

## Safe-boundary rule

Each unit contains:

- `break_after_source_offset`;
- `break_after_safe`;
- optional `split_candidates`.

A boundary may be selected only when the packet marks it safe. The script will reject a requested boundary that is still inside active inline markup.

Inline markup that closes immediately after sentence punctuation can still be safe; the preparer moves the candidate past the closing tag without changing prose.

## Allowed fields

- `unit_id`: required exact packet ID.
- `break_after`: required boolean.
- `importance`: optional: `normal`, `pivotal_dialogue`, `pivotal_description`, `pivotal_interiority`, `scene_turn`.
- `standalone`: optional boolean.
- `break_before`: optional boolean.
- `split_after_offsets`: optional sorted unique absolute source offsets chosen only from `split_candidates`.
- `reason`: concise editorial reason; never quote/rewrite the source.

Do not add replacement text, HTML, Markdown, summaries, scores, corrected punctuation, or modernized spelling.

## Importance standard

Use `pivotal_dialogue` only when speech materially changes pressure, relationship, knowledge, or action.

Use `pivotal_description` for a consequential image, entrance, discovery, action, or sensory detail whose isolation materially strengthens the scene.

Use `pivotal_interiority` for a consequential realization, fear, choice, memory, self-deception, or psychological reversal.

These three categories force a paragraph before and after the unit **only when safe HTML boundaries exist**. If markup makes isolation unsafe, do not rewrite tags; keep the source structure and flag the location for manual review.

Use `scene_turn` for a meaningful shift in time, place, viewpoint, objective, or dramatic pressure.

## Ordinary paragraph decisions

Prefer `break_after=false` when:

- the next sentence completes the same action/explanation;
- a pronoun/reference would feel detached;
- dialogue attribution/reaction belongs tightly to the utterance;
- classical prose needs sustained cadence;
- splitting would create artificial one-sentence staccato.

Prefer `break_after=true` when:

- focus or dramatic pressure clearly changes;
- a new speaker/action beat deserves visual space;
- time/place/viewpoint/objective turns;
- an important image or realization should land;
- the source paragraph is visually heavy and a natural semantic boundary exists.

Character count is evidence, never the sole reason.

## Exceptional long units

Read every candidate in context. Candidate sources include punctuation and sparse whitespace fallback. Prefer strong grammatical boundaries. A fallback whitespace split requires especially careful review.

The script never auto-splits an overlong unit in formal mode.

## Second pass

After render:

1. inspect all QA warnings;
2. inspect every `agent_selected_internal_splits` entry;
3. inspect beginning, middle, and end;
4. inspect pivotal standalone paragraphs;
5. inspect long/short rhythm runs visually in the final HTML;
6. inspect HTML/security QA;
7. revise decisions and re-render if necessary.
