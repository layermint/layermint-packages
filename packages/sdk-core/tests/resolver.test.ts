import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildResolutionGraph, validateContracts } from '../src/engine.js'
import type { VariantPluginOptions } from '@layermint/shared-types'

function write(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf8')
}

function setup(): { root: string; options: VariantPluginOptions } {
  const root = mkdtempSync(join(tmpdir(), 'layermint-sdk-core-'))
  mkdirSync(join(root, 'src', 'core'), { recursive: true })
  mkdirSync(join(root, 'src', 'theme'), { recursive: true })

  mkdirSync(join(root, 'src', 'variants', 'tenant', 'acme', 'theme'), { recursive: true })
  mkdirSync(join(root, 'src', 'variants', 'region', 'eu', 'theme'), { recursive: true })
  mkdirSync(join(root, 'src', 'variants', 'region', 'eu', 'brand', 'nike', 'theme'), { recursive: true })
  mkdirSync(join(root, 'src', 'variants', 'region', 'eu', 'tenant', 'acme', 'theme'), { recursive: true })

  write(join(root, 'src', 'theme', 'Greeting.ts'), 'export const title = "default"\nexport const subtitle = "base"\n')
  write(join(root, 'src', 'variants', 'tenant', 'acme', 'theme', 'Greeting.ts'), 'export const title = "tenant"\n')
  write(join(root, 'src', 'variants', 'region', 'eu', 'theme', 'Greeting.ts'), 'export const subtitle = "region"\n')
  write(join(root, 'src', 'variants', 'region', 'eu', 'tenant', 'acme', 'theme', 'Greeting.ts'), 'export const title = "region-tenant"\n')

  const options: VariantPluginOptions = {
    selector: {
      region: 'eu',
      brand: 'nike',
      tenant: 'acme',
    },
    layers: ['region', 'brand', 'tenant', 'default'],
    roots: {
      coreRoot: join(root, 'src', 'core'),
      variantsRoot: join(root, 'src', 'variants'),
    },
    mergeStrategy: 'namedExport',
    contractChecks: true,
  }

  return { root, options }
}

describe('sdk-core resolver engine', () => {
  it('resolves fallback by symbol with composed candidates', () => {
    const { root, options } = setup()
    try {
      const graph = buildResolutionGraph(options, '@/theme/Greeting')
      const title = graph.symbols.find(s => s.symbol === 'title')
      const subtitle = graph.symbols.find(s => s.symbol === 'subtitle')

      expect(title?.candidatePath).toBe('region/eu/tenant/acme')
      expect(subtitle?.candidatePath).toBe('region/eu')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 15000)

  it('rejects default export in overrideable modules', () => {
    const { root, options } = setup()
    try {
      write(join(root, 'src', 'variants', 'tenant', 'acme', 'theme', 'Greeting.ts'), 'export default function Bad(){}\n')
      const result = validateContracts(options, 'theme/Greeting')
      expect(result.ok).toBe(false)
      expect(result.errors.some(e => e.code === 'LM001')).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 15000)

  it('warns instead of failing when symbol is shadowed in lower-priority candidates', () => {
    const { root, options } = setup()
    try {
      write(join(root, 'src', 'variants', 'region', 'eu', 'brand', 'nike', 'theme', 'Greeting.ts'), 'export const title = "brand"\n')
      const result = validateContracts(options, 'theme/Greeting')
      expect(result.errors.some(e => e.code === 'LM004')).toBe(false)
      expect(result.warnings.some(e => e.code === 'LM004')).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 15000)
})
