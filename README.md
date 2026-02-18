# LayerMint Packages

**Overrides without forks.**

Build tenant/brand/region variants with deterministic fallback, keep one shared codebase, and ship faster with less maintenance overhead.

This monorepo contains LayerMint publishable packages under the `@layermint/*` scope.

## Install and Use (2 minutes)

### Install from npmjs

```bash
npm i @layermint/sdk-vite @layermint/cli @layermint/shared-types
```

### Install from GitHub Packages

```bash
npm i @layermint/sdk-vite @layermint/cli @layermint/shared-types --registry=https://npm.pkg.github.com
```

For GitHub Packages, configure `.npmrc` with a read token:

```ini
@layermint:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

### Use the Vite plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createVariantOverridePlugin } from '@layermint/sdk-vite'

export default defineConfig({
  plugins: [
    react(),
    createVariantOverridePlugin({
      selector: {
        region: process.env.LAYERMINT_REGION,
        brand: process.env.LAYERMINT_BRAND,
        tenant: process.env.LAYERMINT_TENANT,
      },
      layers: ['region', 'brand', 'tenant', 'default'],
      roots: {
        coreRoot: 'src/core',
        variantsRoot: 'src/variants',
      },
      mergeStrategy: 'namedExport',
      contractChecks: true,
    }),
  ],
})
```

### Use the CLI

```bash
# validate contracts/resolution
npx variant check --region eu --brand nike --tenant acme

# view resolution graph
npx variant graph --region eu --brand nike --tenant acme --format mermaid

# diff between selectors
npx variant diff --from-region eu --to-region us --tenant acme
```

## Packages

- `@layermint/sdk-vite`: Vite plugin for layered variant override resolution.
- `@layermint/cli`: `variant` CLI for `check`, `graph`, and `diff` commands.
- `@layermint/shared-types`: shared contracts and reusable types across SDK/CLI.

## What is this for?

LayerMint removes the need for tenant/brand/region forks with deterministic symbol-level fallback:

- override only what you need,
- keep a shared base,
- reduce long-term maintenance and regressions.

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

## Development (repo maintainers)

### Structure

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

### Requirements

- Node.js 20+
- pnpm 9+

### Local commands

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## License

MIT — see [`LICENSE`](./LICENSE).

## Contributors

- andrico
