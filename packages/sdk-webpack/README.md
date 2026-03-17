# @layermint/sdk-webpack

Webpack plugin for LayerMint composable overrides (`region + brand + tenant`) with named-export fallback and contract checks.

## Install

```bash
pnpm add @layermint/sdk-webpack
```

## Usage

```ts
import { createVariantOverrideWebpackPlugin } from "@layermint/sdk-webpack"

export default {
  // Keep your own alias config to map "@" to your src root.
  resolve: {
    alias: {
      "@": require("node:path").resolve(__dirname, "src"),
    },
  },
  plugins: [
    createVariantOverrideWebpackPlugin({
      selector: {
        region: process.env.LAYERMINT_REGION,
        brand: process.env.LAYERMINT_BRAND,
        tenant: process.env.LAYERMINT_TENANT,
      },
      layers: ["region", "brand", "tenant", "default"],
      roots: {
        srcRoot: "src",
        variantsRoot: "src/variants",
      },
      mergeStrategy: "namedExport",
      contractChecks: true,
    }),
  ],
}
```

## Rules

- Overrideable modules must use named exports only (no `export default`).
- Any `@/*` import under `srcRoot` can be overridden, except `@/variants/*`.
- Canonical override path order: `region/<key>/brand/<key>/tenant/<key>`.

## Notes

- Requires Webpack 5 (`peerDependency`).
- Intercepts imports under `@/*`, excluding `@/variants/*`.
- Generates merged virtual modules in `node_modules/.cache/layermint-webpack`.

## Docs

- Repository: https://github.com/layermint/layermint-packages
