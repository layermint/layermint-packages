import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { createVariantOverrideWebpackPlugin } from '../src/index.js'
import type { VariantPluginOptions } from '@layermint/shared-types'

class Hook<T> {
  public handler: ((arg: T) => T | void) | null = null

  tap(_name: string, fn: (arg: T) => T | void): void {
    this.handler = fn
  }
}

function makeOptions(root: string): VariantPluginOptions {
  return {
    selector: {
      tenant: 'acme',
    },
    layers: ['tenant', 'default'],
    roots: {
      srcRoot: join(root, 'src'),
      variantsRoot: join(root, 'src', 'variants'),
    },
    mergeStrategy: 'namedExport',
    contractChecks: true,
  }
}

describe('sdk-webpack plugin', () => {
  it('generates a virtual module with merged symbol exports', () => {
    const root = mkdtempSync(join(tmpdir(), 'layermint-webpack-'))
    try {
      mkdirSync(join(root, 'src', 'features'), { recursive: true })
      mkdirSync(join(root, 'src', 'variants', 'tenant', 'acme', 'features'), { recursive: true })

      writeFileSync(join(root, 'src', 'features', 'Greeting.ts'), 'export const title = "default"\nexport const subtitle = "base"\n')
      writeFileSync(join(root, 'src', 'variants', 'tenant', 'acme', 'features', 'Greeting.ts'), 'export const title = "tenant"\n')

      const plugin = createVariantOverrideWebpackPlugin({
        ...makeOptions(root),
        cacheDir: '.tmp-layermint-cache',
      })

      const beforeResolve = new Hook<{ request: string }>()
      const normalModuleFactoryHook = new Hook<{ hooks: { beforeResolve: Hook<{ request: string }> } }>()
      const thisCompilationHook = new Hook<{ contextDependencies: Set<string> }>()
      const warnings: string[] = []

      const compiler = {
        options: { context: root },
        getInfrastructureLogger: () => ({ warn: (msg: string) => warnings.push(msg) }),
        hooks: {
          thisCompilation: thisCompilationHook,
          normalModuleFactory: normalModuleFactoryHook,
        },
      }

      plugin.apply(compiler)

      thisCompilationHook.handler?.({ contextDependencies: new Set<string>() })
      normalModuleFactoryHook.handler?.({ hooks: { beforeResolve } })

      const resolveData = { request: '@/features/Greeting' }
      beforeResolve.handler?.(resolveData)

      expect(resolveData.request).not.toBe('@/features/Greeting')
      expect(resolveData.request.endsWith('.mjs')).toBe(true)
      expect(existsSync(resolveData.request)).toBe(true)

      const generated = readFileSync(resolveData.request, 'utf8')
      expect(generated).toContain('export { title } from')
      expect(generated).toContain('variants/tenant/acme/features/Greeting')
      expect(generated).toContain('export { subtitle } from')
      expect(generated).toContain('src/features/Greeting')
      expect(warnings).toHaveLength(0)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 20000)

  it('skips imports inside variants', () => {
    const root = mkdtempSync(join(tmpdir(), 'layermint-webpack-'))
    try {
      const plugin = createVariantOverrideWebpackPlugin({
        ...makeOptions(root),
        cacheDir: '.tmp-layermint-cache',
      })

      const beforeResolve = new Hook<{ request: string }>()
      const normalModuleFactoryHook = new Hook<{ hooks: { beforeResolve: Hook<{ request: string }> } }>()

      const compiler = {
        options: { context: root },
        getInfrastructureLogger: () => ({ warn: () => undefined }),
        hooks: {
          thisCompilation: { tap: () => undefined },
          normalModuleFactory: normalModuleFactoryHook,
        },
      }

      plugin.apply(compiler)
      normalModuleFactoryHook.handler?.({ hooks: { beforeResolve } })

      const resolveData = { request: '@/variants/tenant/acme/features/Greeting' }
      beforeResolve.handler?.(resolveData)

      expect(resolveData.request).toBe('@/variants/tenant/acme/features/Greeting')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('throws when mergeStrategy is not namedExport', () => {
    const root = mkdtempSync(join(tmpdir(), 'layermint-webpack-'))
    try {
      const plugin = createVariantOverrideWebpackPlugin({
        ...makeOptions(root),
        mergeStrategy: 'namedExport',
      })

      // Simulate an invalid runtime config cast from JS consumers.
      ;(plugin as unknown as { options: { mergeStrategy: string } }).options.mergeStrategy = 'defaultExport'

      expect(() =>
        plugin.apply({
          options: { context: root },
          hooks: {
            thisCompilation: { tap: () => undefined },
            normalModuleFactory: { tap: () => undefined },
          },
        })
      ).toThrow('LayerMint only supports mergeStrategy="namedExport" in v1')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
