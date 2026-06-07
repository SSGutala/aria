# Aria — Sample Documents (reference data)

Drop your reference/sample documents into the matching subfolder. Aria reads
these to learn each document type's **structure, section order, content depth,
tone, and table/layout patterns** — then encodes that into the locked template
for that type.

## Subfolders
- `01-competitive-analysis/`
- `02-product-strategy-vision-okrs/`
- `03-prd-specs-user-stories/`
- `04-product-roadmap-release-plan/`
- `05-product-design/`
- `06-business-case-product-proposal/`
- `07-pitch-deck/`

## Preferred formats (easiest → hardest for Aria to process)
1. **Markdown (.md)** — best. Cheapest, fastest, cleanest to extract structure.
2. **.docx** — great. Clean text + heading structure (extracted via pandoc).
3. **.txt** — fine for content/structure.
4. **.pdf** — readable, but heavier per file. Best used for 1–2 "this is the
   visual/quality bar" references per type rather than the bulk.
5. **Pitch deck** — a markdown slide outline or a PDF export is easier than a
   raw .pptx.

## How many
3–5 strong, representative samples per type is plenty to extract a reliable
pattern. More than that mostly adds processing cost without improving the
template. If you already have 10, that's fine — Aria will sample the best ones.

## Naming
Anything is fine. Optional: prefix with a quality hint, e.g. `best-…`, so Aria
weights those highest.
