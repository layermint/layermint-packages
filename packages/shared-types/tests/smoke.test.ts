import { describe, expect, it } from 'vitest'
import type { VariantPluginOptions } from '../src/index.js'

describe('shared types', () => {
  it('exposes VariantPluginOptions shape', () => {
    const input: VariantPluginOptions = {
      selector: { region: 'eu', tenant: 'acme' },
      layers: ['region', 'brand', 'tenant', 'default'],
      roots: { coreRoot: 'src/core', variantsRoot: 'src/variants' },
      mergeStrategy: 'namedExport',
      contractChecks: true,
    }
    expect(input.layers[0]).toBe('region')
  })
})
