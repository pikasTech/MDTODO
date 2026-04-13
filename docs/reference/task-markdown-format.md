# Task Markdown Format

## Task identity

MDTODO tasks use hierarchical `R` identifiers:

- root task: `R1`
- child task: `R1.1`
- deeper task: `R1.1.1`

The extension and CLI both assume this identifier format.

## Typical heading structure

```md
## R1 Root task

Task description text.

### R1.1 Child task [in_progress]

More detail.
```

## Status markers

Current normalized task states:

- no marker: not started
- `[in_progress]`: processing
- `[completed]`: completed

Legacy markers such as `[Processing]` and `[Finished]` are normalized during parsing.

## Parsed data model

The shared `TodoTask` shape carries these persistent fields:

- `id`
- `title`
- `description`
- `rawContent`
- `completed`
- `processing`
- `children`
- `lineNumber`
- `filePath`
- `linkCount`
- `linkExists`

Non-task narrative sections are preserved as `TextBlock`.

## Report-link convention

New task templates include a report link under:

```text
./details/{TODO_FILE_BASENAME}/{TIMESTAMP}_Task_Report.md
```

Current timestamp precision is:

```text
YYYYMMDD_HHmmss
```

## Stable editing rules distilled from process history

- Markdown source remains the source of truth
- multi-line task content must be preserved during edits
- newly created tasks should enter editable state immediately
- task links must remain valid Markdown and keep their original target paths
- process documents under `docs/details/` are historical sources and must not be rewritten
