import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildResolutionGraph, checkVariant, validateContracts } from '../src/engine.js'
import type { VariantPluginOptions } from '@layermint/shared-types'

function write(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf8')
}

function setup(): { root: string; options: VariantPluginOptions } {
  const root = mkdtempSync(join(tmpdir(), 'layermint-sdk-core-'))
  mkdirSync(join(root, 'src', 'features'), { recursive: true })
  mkdirSync(join(root, 'src', 'variants', 'tenant', 'acme', 'features'), { recursive: true })
  mkdirSync(join(root, 'src', 'variants', 'region', 'eu', 'features'), { recursive: true })
  mkdirSync(join(root, 'src', 'variants', 'region', 'eu', 'brand', 'nike', 'features'), { recursive: true })
  mkdirSync(join(root, 'src', 'variants', 'region', 'eu', 'tenant', 'acme', 'features'), { recursive: true })

  write(join(root, 'src', 'features', 'Greeting.ts'), 'export const title = "default"\nexport const subtitle = "base"\n')
  write(join(root, 'src', 'variants', 'tenant', 'acme', 'features', 'Greeting.ts'), 'export const title = "tenant"\n')
  write(join(root, 'src', 'variants', 'region', 'eu', 'features', 'Greeting.ts'), 'export const subtitle = "region"\n')
  write(join(root, 'src', 'variants', 'region', 'eu', 'tenant', 'acme', 'features', 'Greeting.ts'), 'export const title = "region-tenant"\n')

  const options: VariantPluginOptions = {
    selector: {
      region: 'eu',
      brand: 'nike',
      tenant: 'acme',
    },
    layers: ['region', 'brand', 'tenant', 'default'],
    roots: {
      srcRoot: join(root, 'src'),
      variantsRoot: join(root, 'src', 'variants'),
    },
    mergeStrategy: 'namedExport',
    contractChecks: true,
  }

  return { root, options }
}

describe('sdk-core resolver engine', () => {
  it('resolves fallback by symbol for any src file outside variants', () => {
    const { root, options } = setup()
    try {
      const graph = buildResolutionGraph(options, '@/features/Greeting')
      const title = graph.symbols.find(s => s.symbol === 'title')
      const subtitle = graph.symbols.find(s => s.symbol === 'subtitle')

      expect(title?.candidatePath).toBe('region/eu/tenant/acme')
      expect(subtitle?.candidatePath).toBe('region/eu')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 15000)

  it('rejects default export in overrideable source modules', () => {
    const { root, options } = setup()
    try {
      write(join(root, 'src', 'variants', 'tenant', 'acme', 'features', 'Greeting.ts'), 'export default function Bad(){}\n')
      const result = validateContracts(options, 'features/Greeting')
      expect(result.ok).toBe(false)
      expect(result.errors.some(e => e.code === 'LM001')).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 15000)

  it('warns instead of failing when symbol is shadowed in lower-priority candidates', () => {
    const { root, options } = setup()
    try {
      write(join(root, 'src', 'variants', 'region', 'eu', 'brand', 'nike', 'features', 'Greeting.ts'), 'export const title = "brand"\n')
      const result = validateContracts(options, 'features/Greeting')
      expect(result.errors.some(e => e.code === 'LM004')).toBe(false)
      expect(result.warnings.some(e => e.code === 'LM004')).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 15000)

  it('rejects imports from variants as override targets', () => {
    const { root, options } = setup()
    try {
      expect(() => buildResolutionGraph(options, '@/variants/tenant/acme/features/Greeting')).toThrow(
        'Expected any @/* path outside @/variants/*'
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 15000)

  it('checks source files under src while skipping files inside variants', () => {
    const { root, options } = setup()
    try {
      write(join(root, 'src', 'variants', 'orphan.ts'), 'export default function Ignored() {}\n')
      const result = checkVariant(options)
      expect(result.errors.some(e => e.file.endsWith('orphan.ts'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 15000)
})
