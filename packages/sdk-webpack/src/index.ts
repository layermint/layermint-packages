import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { VariantPluginOptions } from '@layermint/shared-types'
import { buildResolutionGraph, resolveSelector, validateContracts } from '@layermint/sdk-core/engine'

const PLUGIN_NAME = 'LayerMintWebpackPlugin'
const GENERATED_ROOT = 'node_modules/.cache/layermint-webpack'

function isOverrideablePath(request: string): boolean {
  const [cleanRequest] = request.split('?')
  if (!cleanRequest) return false
  const normalized = cleanRequest.replace(/^@\//, '')
  return normalized.startsWith('core/') || normalized.startsWith('theme/')
}

function normalizeRequestPath(request: string): string {
  const [cleanRequest] = request.split('?')
  const withoutAlias = (cleanRequest ?? request).replace(/^@\//, '')
  return withoutAlias.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, '')
}

function toVirtualModuleSource(options: VariantPluginOptions, importPath: string, normalizedPath: string): string {
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

  return lines.join('\n') + '\n'
}

export interface WebpackVariantPluginOptions extends VariantPluginOptions {
  cacheDir?: string
}

export class LayerMintWebpackPlugin {
  private warnedLegacyVariant = false
  private readonly options: WebpackVariantPluginOptions

  constructor(options: WebpackVariantPluginOptions) {
    this.options = options
  }

  apply(compiler: any): void {
    if (this.options.mergeStrategy !== 'namedExport') {
      throw new Error('LayerMint only supports mergeStrategy="namedExport" in v1')
    }

    const context = resolve(compiler?.options?.context ?? process.cwd())
    const selector = resolveSelector(this.options)
    const selectorHash = createHash('sha1').update(JSON.stringify(selector.selector)).digest('hex').slice(0, 10)
    const cacheDir = resolve(context, this.options.cacheDir ?? GENERATED_ROOT, selectorHash)
    mkdirSync(cacheDir, { recursive: true })

    const logger = compiler.getInfrastructureLogger?.(PLUGIN_NAME)

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation: any) => {
      compilation.contextDependencies?.add(resolve(this.options.roots.coreRoot, '..'))
      compilation.contextDependencies?.add(resolve(this.options.roots.variantsRoot))
    })

    compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (normalModuleFactory: any) => {
      normalModuleFactory.hooks.beforeResolve.tap(PLUGIN_NAME, (resolveData: any) => {
        if (!resolveData || typeof resolveData.request !== 'string') return resolveData

        if (selector.usedLegacyVariant && !this.warnedLegacyVariant) {
          logger?.warn('[LayerMint] `variant` string is deprecated. Use `selector: { region?, brand?, tenant? }`.')
          this.warnedLegacyVariant = true
        }

        const request = resolveData.request
        if (!request.startsWith('@/') || !isOverrideablePath(request)) {
          return resolveData
        }

        const normalizedPath = normalizeRequestPath(request)
        const importPath = `@/${normalizedPath}`
        const source = toVirtualModuleSource(this.options, importPath, normalizedPath)

        const safePath = normalizedPath.replace(/[\\/]/g, '__')
        const fileHash = createHash('sha1').update(importPath).update(source).digest('hex').slice(0, 10)
        const generatedFile = resolve(cacheDir, `${safePath}.${fileHash}.mjs`)

        writeFileSync(generatedFile, source, 'utf8')
        resolveData.request = generatedFile
        return resolveData
      })
    })
  }
}

export function createVariantOverrideWebpackPlugin(
  options: WebpackVariantPluginOptions
): LayerMintWebpackPlugin {
  return new LayerMintWebpackPlugin(options)
}

export { buildResolutionGraph, resolveSelector, validateContracts } from '@layermint/sdk-core/engine'
