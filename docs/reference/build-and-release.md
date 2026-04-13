# Build And Release

## Windows command rule

On Windows, use `npm.cmd` instead of `npm`.

## Root commands

Stable root-level commands:

```bash
npm.cmd install
npm.cmd run watch
npm.cmd run compile
npm.cmd run package
npm.cmd run test
```

## Build outputs

The repository produces two main bundles:

- extension bundle: `out/extension.js`
- webview bundle: `resources/bundle.js`

## Installation flow

`install.bat` is the stable packaging-and-install entrypoint. It performs:

1. dependency installation
2. compile and bundle
3. VSIX packaging
4. uninstall of the previous extension version
5. install of the new VSIX into VS Code

## Practical release constraints

- webpack size warnings are non-blocking for the current project
- packaging depends on `vsce`
- the generated extension artifact is a `.vsix`

## CSS and webview build rule

Persistent style rule distilled from later process docs:

- webview CSS should be imported from React components and bundled into `resources/bundle.js`
- deprecated standalone style outputs such as `resources/style.css` are not the current source of truth

## Historical source trail

This release workflow was established and repeatedly validated in:

- `docs/20260120_MDTODO.md`
- `docs/20260120_MDTODO2.md`
- release-related reports under `docs/details/20260120_MDTODO/` and `docs/details/20260120_MDTODO2/`
