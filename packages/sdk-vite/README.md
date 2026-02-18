# @layermint/sdk-vite

Vite plugin for LayerMint composable overrides (`region + brand + tenant`) with named-export fallback and contract checks.

## Install

```bash
pnpm add @layermint/sdk-vite
```

## Usage

```ts
import { defineConfig } from "vite"
import { createVariantOverridePlugin } from "@layermint/sdk-vite"

export default defineConfig({
  plugins: [
    createVariantOverridePlugin({
      selector: {
        region: process.env.LAYERMINT_REGION,
        brand: process.env.LAYERMINT_BRAND,
        tenant: process.env.LAYERMINT_TENANT,
      },
      layers: ["region", "brand", "tenant", "default"],
      roots: {
        coreRoot: "src/core",
        variantsRoot: "src/variants",
      },
      mergeStrategy: "namedExport",
      contractChecks: true,
    }),
  ],
})
```

## Rules

- Overrideable modules must use named exports only (no `export default`).
- Canonical override path order: `region/<key>/brand/<key>/tenant/<key>`.

## Docs

- Repository: https://github.com/layermint/layermint-packages

