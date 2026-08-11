# Model decision protocol

## Purpose

The model decides which existing sentence units deserve emphasis or explicit boundaries. It never returns replacement prose. The renderer accepts unit IDs and layout decisions only.

## Decision file

Create one JSON file for every packet, using the same basename, under the work directory's `decisions/` folder:

```json
{
  "schema_version": 1,
  "packet_id": "p0001",
  "reviewed": true,
  "decisions": [
    {
      "unit_id": "u0000042",
      "importance": "pivotal_dialogue",
      "standalone": true,
      "reason": "The confession changes the relationship and needs visual emphasis."
    },
    {
      "unit_id": "u0000049",
      "importance": "scene_turn",
      "break_before": true,
      "reason": "Time and location shift here."
    },
    {
      "unit_id": "u0000063",
      "importance": "normal",
      "split_after_offsets": [287, 641],
      "reason": "These strong clause endings keep both resulting thoughts grammatically complete."
    }
  ]
}
```

The `decisions` array may be empty after a genuine full-packet review. Omit normal units rather than listing them all.

## Allowed fields

- `unit_id`: required exact ID from the packet.
- `importance`: `normal`, `pivotal_dialogue`, `pivotal_description`, `pivotal_interiority`, or `scene_turn`.
- `standalone`: explicitly request a standalone paragraph for a normal or scene-turn unit. The three pivotal categories force standalone behavior even when this field is omitted.
- `break_before`: require a paragraph boundary before the unit.
- `break_after`: require a paragraph boundary after the unit.
- `keep_with_next`: discourage a boundary after the unit, usually for a setup/payoff or speech/attribution pair.
- `split_after_offsets`: for a sentence longer than the hard maximum, choose sorted offsets only from that unit's `split_candidates`. Choose enough candidates that no resulting piece exceeds the hard maximum.
- `reason`: concise editorial reason. Do not quote or rewrite the source.

Do not add fields, replacement text, Markdown, summaries, scores, or revised punctuation.

## Importance standard

Use `pivotal_dialogue` for a statement, question, refusal, confession, revelation, command, or emotional reversal that materially changes the scene. A quotation is not important merely because it is short or emphatic.

Use `pivotal_description` for an image, action, realization, entrance, discovery, or sensory detail that carries thematic or plot weight. Decorative description is normally not pivotal.

Use `pivotal_interiority` for a consequential thought, realization, fear, decision, self-deception, memory, or psychological reversal. Routine internal commentary is normally not pivotal.

The three pivotal categories are hard layout instructions. The sentence must be a paragraph by itself even if it is one word. In an intense exchange, `“No!”` or Swahili `“Hapana!”` may therefore stand alone. Never set `standalone=false` or `keep_with_next=true` on a pivotal unit; the renderer rejects both.

Use `scene_turn` for a meaningful transition in time, place, viewpoint, dramatic pressure, or scene objective. Do not mark ordinary connective phrases.

## Boundary rules

1. Read `context_before`, every unit, and `context_after` before deciding.
2. Keep dialogue attribution with its spoken line when both occur in the same source sentence and separating them would create an orphan such as `he said` or `alisema`.
3. Adjacent pivotal sentences each remain standalone when both independently deserve emphasis; do not merge them merely to avoid short paragraphs.
4. Avoid turning sustained narrative into a sequence of one-sentence paragraphs.
5. Let the deterministic rhythm planner handle normal prose. Add decisions only where semantic judgment improves the reading experience.
6. For every unit longer than 360 characters, inspect `split_candidates` and select grammatically natural clause boundaries. Prefer semicolons, colons, em dashes, and full stops; use commas only when both visual fragments remain coherent.
7. When uncertain about emphasis, leave the unit normal. Do not leave an unusually long sentence's internal boundary choice to character count alone.

After rendering, read every entry in `emergency_split_review` in context. These are clause-level breaks forced inside unusually long sentences and may create dependent or visually awkward fragments. A formal release with such splits requires a second render using `--ack-emergency-splits`, and that flag must never be supplied before the inspection.

## Cross-packet consistency

Review packets in numeric order. Before final rendering, compare the frequency of pivotal dialogue, description, and interiority across early, middle, and late packets. If one section is much denser without a narrative reason, recheck the decisions for inconsistent standards.
