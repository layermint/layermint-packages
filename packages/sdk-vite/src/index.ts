import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import type { VariantPluginOptions } from '@layermint/shared-types'
import { buildResolutionGraph, resolveSelector, validateContracts } from './core/engine.js'

const VIRTUAL_PREFIX = '\0virtual:layermint/'

function isOverrideablePath(path: string): boolean {
  const normalized = path.replace(/^@\//, '')
  return normalized.startsWith('core/') || normalized.startsWith('theme/')
}

export function createVariantOverridePlugin(options: VariantPluginOptions): Plugin {
  if (options.mergeStrategy !== 'namedExport') {
    throw new Error('LayerMint only supports mergeStrategy="namedExport" in v1')
  }

  const baseRoot = resolve(options.roots.coreRoot, '..')
  const selectorState = resolveSelector(options)
  const usingLegacyVariant = !options.selector && !!options.variant
  let warnedLegacyVariant = false

  return {
    name: 'layermint-variant-override',
    enforce: 'pre',

    resolveId(id, importer) {
      if (importer?.startsWith(VIRTUAL_PREFIX)) return null
      if (!id.startsWith('@/')) return null
      if (!isOverrideablePath(id)) return null
      return `${VIRTUAL_PREFIX}${id.slice(2)}?selector=${encodeURIComponent(JSON.stringify(selectorState.selector))}`
    },

    load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return null
      if (usingLegacyVariant && !warnedLegacyVariant) {
        console.warn('[LayerMint] `variant` string is deprecated. Use `selector: { region?, brand?, tenant? }`.')
        warnedLegacyVariant = true
      }

      const [pathPart] = id.replace(VIRTUAL_PREFIX, '').split('?selector=')
      if (!pathPart) {
        throw new Error(`Invalid LayerMint virtual id: ${id}`)
      }
      const importPath = `@/${pathPart}`
      const normalizedPath = pathPart.replace(/\.(ts|tsx|mts|cts)$/, '')

      const graph = buildResolutionGraph(options, importPath)
      const contract = validateContracts(options, normalizedPath)
      if (!contract.ok && options.contractChecks) {
        const message = contract.errors.map(err => `${err.code}: ${err.message} (${err.file})`).join('\n')
        throw new Error(`LayerMint contract check failed:\n${message}`)
      }

      const symbolsByFile = new Map<string, string[]>()
      for (const symbol of graph.symbols) {
        const list = symbolsByFile.get(symbol.sourceFile) ?? []
        list.push(symbol.symbol)
        symbolsByFile.set(symbol.sourceFile, list)
      }

      const lines: string[] = []
      for (const [file, symbols] of symbolsByFile.entries()) {
        lines.push(`export { ${symbols.join(', ')} } from ${JSON.stringify(file)}`)
      }

      if (lines.length === 0) {
        throw new Error(`LayerMint failed to resolve symbols for ${importPath}`)
      }

      return lines.join('\n')
    },

    handleHotUpdate(ctx) {
      const file = ctx.file.replace(/\\/g, '/')
      if (!file.includes('/core/') && !file.includes('/theme/') && !file.includes('/variants/')) return
      ctx.server.ws.send({ type: 'full-reload', path: '*' })
    },

    config() {
      return {
        resolve: {
          alias: {
            '@': baseRoot,
          },
        },
      }
    },
  }
}

export * from './core/engine.js'
