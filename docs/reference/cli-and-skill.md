# CLI And Skill

## CLI role in this project

The CLI under `cli/` is the scriptable interface for reading and mutating MDTODO files outside the VS Code webview.

Its current function set includes:

- `list`
- `get`
- `add`
- `add-sub`
- `delete` or `remove`
- `complete` or `done`
- `start`
- `update`
- `stats`

## Project-specific relationship to the extension

- the extension and CLI both operate on the same Markdown TODO format
- parser and file-editing assumptions were intentionally aligned between the two tracks
- CLI tests rely on real MDTODO-shaped fixture data rather than synthetic minimal examples

## Skill-related note

This repository also preserves an `mdtodo-edit` skill process document in `docs/MDTODO_SKILL.md`.

For skill-specific generic usage, install flow, or CLI details, use the skill's own `SKILL.md` as the canonical source rather than duplicating general instructions here.

This reference document only records the project-specific relationship:

- the skill track exists to make MDTODO workflows reusable outside the extension UI
- the skill packaging was built on top of the CLI track
- the historical evidence for that packaging work lives under `docs/details/mdtodo-edit/`

## Canonical source docs

- user-facing CLI usage: `docs/MDTODO_CLI_USAGE.md`
- CLI process history: `docs/MDTODO_CLI.md`
- skill process history: `docs/MDTODO_SKILL.md`

## Distilled development outline

- CLI track: extracted Node-compatible task operations from the extension-oriented codebase
- skill track: packaged those operations for agent-oriented reuse
- extension remains the primary integrated surface in this repository
