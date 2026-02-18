# LayerMint Packages

Monorepo for LayerMint publishable packages.

This repository contains the variant runtime for frontends, a CLI for validation/diff tooling, and shared contracts/types, all as independent packages under the `@layermint/*` scope.

## Packages

- `@layermint/sdk-vite`: Vite plugin for layered variant override resolution.
- `@layermint/cli`: `variant` CLI for `check`, `graph`, and `diff` commands.
- `@layermint/shared-types`: shared contracts and reusable types across SDK/CLI.

## What is this for?

LayerMint removes the need for tenant/brand/region forks with deterministic symbol-level fallback:

- override only what you need,
- keep a shared base,
- reduce long-term maintenance and regressions.

## Structure

```txt
.
├── packages/
│   ├── sdk-vite/
│   ├── cli/
│   └── shared-types/
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Requirements

- Node.js 20+
- pnpm 9+

## Local Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## 2-Minute Quickstart

1. Clone and install:

```bash
git clone https://github.com/layermint/layermint-packages.git
cd layermint-packages
pnpm install
```

2. Build + run tests:

```bash
pnpm build
pnpm test
```

3. Run local CLI help:

```bash
pnpm --filter @layermint/cli exec variant --help
```

4. (Optional) pack tarballs locally:

```bash
pnpm --filter @layermint/shared-types pack
pnpm --filter @layermint/sdk-vite pack
pnpm --filter @layermint/cli pack
```

At this point, SDK/CLI/shared-types are verified end-to-end locally.

## Install from Registry

### npmjs

```bash
npm i @layermint/sdk-vite @layermint/cli @layermint/shared-types
```

### GitHub Packages

```bash
npm i @layermint/sdk-vite @layermint/cli @layermint/shared-types --registry=https://npm.pkg.github.com
```

> For GitHub Packages, configure `.npmrc` with a read token.

## Publishing

This repository publishes via release workflow on `v*` tags.

- CI: lint + typecheck + test + build
- Release: publish to GitHub Packages and npmjs

### Required Secret

- `NPM_TOKEN`: npm token with publish permissions for `@layermint`.

### Recommended Flow

1. Update package versions (`package.json` for each package).
2. Commit + push to `main`.
3. Create and push a release tag:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

## License

MIT — see [`LICENSE`](./LICENSE).

## Contributors

- andrico
