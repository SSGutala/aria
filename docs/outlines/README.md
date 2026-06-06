# Aria — PM / Technical Product Manager Document Outlines

Drop your outline for each document into the matching numbered file in this
folder. Aria ingests these into the document template registry
(`api/lib/documentTemplates.js`).

**The section headings you put here become the FIXED skeleton of each generated
document.** The AI fills each section with content but can never add, drop, or
rename sections. This is how "do not make up your own documents" is enforced
structurally — your outline is the contract.

## How to fill each file

Each file has a metadata header and a SECTIONS area. Replace the placeholder
sections with YOUR real section list. Format per section:

```
## <Section Title>
guidance: <one line telling the AI what content belongs in this section>
kind: bullets | table | paragraphs        # optional, default paragraphs
table_columns: Col A, Col B, Col C         # only if kind: table
min_words: 60                              # optional length floor

### <Subsection Title>                     # optional, nest as needed
guidance: ...
```

## Metadata header fields

- **Title** — the exact document name shown in Aria Drive
- **Format** — `formal_doc` (PDF/DOCX), `presentation` (PPTX), or `spreadsheet` (XLSX)
- **Purpose** — 1–2 lines on what the document is for
- **Audience** — who reads it
- **Depth** — `exec` | `standard` | `enterprise` (controls length/detail)

## Generation order

The number prefix is the order documents are generated in the progressive,
approval-gated chat workflow (Competitive Analysis first → Pitch Deck last).
Reorder by renaming the number prefixes.

## When you're done

Tell Aria **"ingest the outlines"** and it will build/refresh the registry
entries, each validated against your section list. Nothing is generated for end
users until the registry reflects your outlines.
