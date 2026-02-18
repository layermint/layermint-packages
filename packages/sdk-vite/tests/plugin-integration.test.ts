import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { createVariantOverridePlugin } from '../src/index.js'

describe('vite plugin integration', () => {
  it('creates a virtual module with merged named exports', async () => {
    const root = mkdtempSync(join(tmpdir(), 'layermint-plugin-'))
    try {
      mkdirSync(join(root, 'src', 'core'), { recursive: true })
      mkdirSync(join(root, 'src', 'theme'), { recursive: true })
      mkdirSync(join(root, 'src', 'variants', 'region', 'eu', 'tenant', 'acme', 'theme'), { recursive: true })

      writeFileSync(
        join(root, 'src', 'theme', 'Widget.ts'),
        'export const One = 1\nexport const Two = 2\n',
        'utf8'
      )
      writeFileSync(
        join(root, 'src', 'variants', 'region', 'eu', 'tenant', 'acme', 'theme', 'Widget.ts'),
        'export const One = 10\n',
        'utf8'
      )

      const plugin = createVariantOverridePlugin({
        selector: {
          region: 'eu',
          tenant: 'acme',
        },
        layers: ['region', 'brand', 'tenant', 'default'],
        roots: {
          coreRoot: join(root, 'src', 'core'),
          variantsRoot: join(root, 'src', 'variants'),
        },
        mergeStrategy: 'namedExport',
        contractChecks: true,
      })

      const resolved = plugin.resolveId?.('@/theme/Widget', undefined)
      expect(typeof resolved).toBe('string')

      const loaded = await plugin.load?.call({} as never, resolved as string)
      expect(loaded).toContain('export { One }')
      expect(loaded).toContain('export { Two }')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
