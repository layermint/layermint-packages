# @layermint/sdk-core

Shared core engine for LayerMint `srcRoot` override resolution, symbol-level fallback, and contract validation.

This package is consumed by framework adapters like `@layermint/sdk-vite` and `@layermint/sdk-webpack`.

It resolves any `@/*` module under `srcRoot`, looks for matching overrides under `variantsRoot`, and excludes `@/variants/*` from the override baseline.
