# @layermint/cli

CLI for inspecting LayerMint override resolution across a `srcRoot` baseline and a `variantsRoot` override tree.

## Install

```bash
pnpm add -D @layermint/cli
```

## Commands

```bash
variant check --region us --brand nike --tenant acme --root .
variant graph --import @/features/Header --region us --tenant acme --format mermaid --root .
variant diff --from-region eu --to-region us --root .
```

## Notes

- Works with composable selector flags: `--region`, `--brand`, `--tenant`.
- Scans imports from `srcRoot` and skips `variantsRoot` as a source baseline.
- Legacy `--variant` is still accepted but deprecated.

## Docs

- Repository: https://github.com/layermint/layermint-packages
