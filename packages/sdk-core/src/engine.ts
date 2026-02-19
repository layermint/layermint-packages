import { existsSync, readdirSync, statSync } from "node:fs"
import { relative, resolve } from "node:path"
import type {
  CheckResult,
  ContractError,
  DiffEntry,
  LayerName,
  ModuleResolutionGraph,
  VariantDimension,
  VariantPluginOptions,
  VariantSelector,
} from "@layermint/shared-types"
import { getExportsFromFile } from "./exports.js"
import { resolveConcreteFile } from "./files.js"

const OVERRIDABLE_ROOTS = ["core/", "theme/"]
const CANONICAL_ORDER: VariantDimension[] = ["region", "brand", "tenant"]
const TIE_BREAK_ORDER: VariantDimension[] = ["region", "tenant", "brand"]

function toOverridePath(importPath: string): string | null {
  const stripped = importPath.replace(/^@\//, "")
  if (OVERRIDABLE_ROOTS.some(prefix => stripped.startsWith(prefix))) {
    return stripped
  }
  return null
}

function defaultFile(options: VariantPluginOptions, normalizedPath: string): string | null {
  const baseDir = resolve(options.roots.coreRoot, "..")
  return resolveConcreteFile(baseDir, normalizedPath)
}

function parseLegacyVariant(value?: string): VariantSelector {
  if (!value) return {}
  const match = value.match(/^(tenant|brand|region)\/(.+)$/)
  if (!match) return {}
  const dimension = match[1] as VariantDimension
  const key = match[2]
  return { [dimension]: key }
}

export function resolveSelector(options: VariantPluginOptions): { selector: VariantSelector; usedLegacyVariant: boolean } {
  if (options.selector) {
    return { selector: options.selector, usedLegacyVariant: false }
  }
  return { selector: parseLegacyVariant(options.variant), usedLegacyVariant: !!options.variant }
}

function selectorToLegacyString(selector: VariantSelector): string {
  return CANONICAL_ORDER.filter(d => !!selector[d])
    .map(d => `${d}/${selector[d]}`)
    .join("/")
}

function scoreDimensions(dimensions: VariantDimension[]): number {
  return TIE_BREAK_ORDER.reduce((acc, dimension, index) => {
    if (!dimensions.includes(dimension)) return acc
    return acc + Math.pow(10, TIE_BREAK_ORDER.length - index)
  }, 0)
}

function enumerateDimensionSubsets(selector: VariantSelector): VariantDimension[][] {
  const dims = CANONICAL_ORDER.filter(d => !!selector[d])
  const subsets: VariantDimension[][] = []

  for (let mask = 1; mask < 1 << dims.length; mask += 1) {
    const subset: VariantDimension[] = []
    for (let i = 0; i < dims.length; i += 1) {
      const dim = dims[i]
      if (!dim) continue
      if (mask & (1 << i)) subset.push(dim)
    }
    subsets.push(subset)
  }

  subsets.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length
    return scoreDimensions(b) - scoreDimensions(a)
  })

  return subsets
}

function toCandidatePath(selector: VariantSelector, dimensions: VariantDimension[]): string {
  const parts: string[] = []
  for (const dim of CANONICAL_ORDER) {
    if (!dimensions.includes(dim)) continue
    const value = selector[dim]
    if (!value) continue
    parts.push(dim, value)
  }
  return parts.join("/")
}

function buildCandidates(options: VariantPluginOptions, normalizedPath: string): Array<{
  layer: LayerName
  dimensions: VariantDimension[]
  candidatePath: string
  file: string
  exists: boolean
  rank: number
}> {
  const { selector } = resolveSelector(options)
  const subsets = enumerateDimensionSubsets(selector)

  const candidates = subsets.map((dimensions, index) => {
    const candidatePath = toCandidatePath(selector, dimensions)
    const base = resolve(options.roots.variantsRoot, candidatePath)
    const file = resolveConcreteFile(base, normalizedPath)

    return {
      layer: (dimensions[0] ?? "default") as LayerName,
      dimensions,
      candidatePath,
      file: file ?? resolve(base, normalizedPath),
      exists: !!file,
      rank: subsets.length - index,
    }
  })

  const defaultResolved = defaultFile(options, normalizedPath)
  if (!defaultResolved) return candidates

  candidates.push({
    layer: "default",
    dimensions: [],
    candidatePath: "default",
    file: defaultResolved,
    exists: true,
    rank: 0,
  })

  return candidates
}

export function validateContracts(options: VariantPluginOptions, normalizedPath: string): CheckResult {
  const errors: ContractError[] = []
  const warnings: ContractError[] = []

  const defaultResolved = defaultFile(options, normalizedPath)
  if (!defaultResolved) {
    return {
      ok: false,
      errors: [
        {
          code: "LM002",
          message: `Default module not found for ${normalizedPath}`,
          file: normalizedPath,
          suggestion: "Create the default module under src/core or src/theme",
        },
      ],
      warnings,
    }
  }

  const defaultExports = getExportsFromFile(defaultResolved, resolve(options.roots.coreRoot, ".."))
  if (defaultExports.hasDefault) {
    errors.push({
      code: "LM001",
      message: `Default export is not allowed in overrideable module: ${defaultResolved}`,
      file: defaultResolved,
      suggestion: "Replace export default with named exports only",
    })
  }

  const candidates = buildCandidates(options, normalizedPath).filter(candidate => candidate.exists && candidate.candidatePath !== "default")
  const winningSymbolPath = new Map<string, string>()

  for (const candidate of candidates) {
    const siteExports = getExportsFromFile(candidate.file, resolve(options.roots.coreRoot, ".."))

    if (siteExports.hasDefault) {
      errors.push({
        code: "LM001",
        message: `Default export is not allowed in override module: ${candidate.file}`,
        file: candidate.file,
        suggestion: "Export symbols by name to enable fallback by symbol",
      })
    }

    for (const symbol of siteExports.names) {
      if (!defaultExports.names.has(symbol)) {
        warnings.push({
          code: "LM002",
          message: `Symbol ${symbol} only exists in override ${candidate.candidatePath} for ${normalizedPath}`,
          file: candidate.file,
          symbol,
          suggestion: "Add this symbol to default module if it should be universally available",
        })
      }

      const currentWinner = winningSymbolPath.get(symbol)
      if (!currentWinner) {
        winningSymbolPath.set(symbol, candidate.candidatePath)
      } else if (currentWinner !== candidate.candidatePath) {
        warnings.push({
          code: "LM004",
          message: `Symbol ${symbol} is overridden in multiple candidates (${currentWinner}, ${candidate.candidatePath}); using highest-priority override`,
          file: candidate.file,
          symbol,
          suggestion: "Keep lower-priority duplicates only when intentional shadowing is desired",
        })
      }

      if (options.contractChecks && defaultExports.signatures.has(symbol) && siteExports.signatures.has(symbol)) {
        const defaultSignature = defaultExports.signatures.get(symbol)
        const overrideSignature = siteExports.signatures.get(symbol)
        if (defaultSignature !== overrideSignature) {
          errors.push({
            code: "LM003",
            message: `Incompatible type for ${symbol} in ${candidate.file}`,
            file: candidate.file,
            symbol,
            suggestion: `Expected signature: ${defaultSignature}; got: ${overrideSignature}`,
          })
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}

export function buildResolutionGraph(options: VariantPluginOptions, importPath: string): ModuleResolutionGraph {
  const normalizedPath = toOverridePath(importPath)
  if (!normalizedPath) {
    throw new Error(`Import path ${importPath} is not overrideable. Expected @/core/* or @/theme/*`)
  }

  const defaultResolved = defaultFile(options, normalizedPath)
  if (!defaultResolved) {
    throw new Error(`Default module not found for ${normalizedPath}`)
  }

  const { selector } = resolveSelector(options)
  const defaultExports = getExportsFromFile(defaultResolved, resolve(options.roots.coreRoot, ".."))
  const symbols = new Map<string, { layer: LayerName; sourceFile: string; candidatePath: string; rank: number }>()

  for (const symbol of defaultExports.names) {
    symbols.set(symbol, {
      layer: "default",
      sourceFile: defaultResolved,
      candidatePath: "default",
      rank: 0,
    })
  }

  const candidates = buildCandidates(options, normalizedPath)

  for (const candidate of candidates) {
    if (!candidate.exists || candidate.candidatePath === "default") continue
    const siteExports = getExportsFromFile(candidate.file, resolve(options.roots.coreRoot, ".."))
    for (const symbol of siteExports.names) {
      const current = symbols.get(symbol)
      if (!current || current.layer === "default") {
        symbols.set(symbol, {
          layer: candidate.layer,
          sourceFile: candidate.file,
          candidatePath: candidate.candidatePath,
          rank: candidate.rank,
        })
      }
    }
  }

  return {
    importPath,
    variant: options.variant ?? selectorToLegacyString(selector),
    selector,
    defaultFile: defaultResolved,
    siteCandidates: candidates,
    symbols: Array.from(symbols.entries()).map(([symbol, source]) => ({
      symbol,
      sourceFile: source.sourceFile,
      layer: source.layer,
      candidatePath: source.candidatePath,
      rank: source.rank,
    })),
  }
}

function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      walk(full, files)
    } else if (/\.(ts|tsx|mts|cts)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

export function checkVariant(options: VariantPluginOptions): CheckResult {
  const baseRoot = resolve(options.roots.coreRoot, "..")
  const files = [...walk(resolve(baseRoot, "core")), ...walk(resolve(baseRoot, "theme"))]

  const allErrors: ContractError[] = []
  const allWarnings: ContractError[] = []

  for (const file of files) {
    const normalizedPath = relative(baseRoot, file).replace(/\\/g, "/").replace(/\.(ts|tsx|mts|cts)$/, "")
    if (!OVERRIDABLE_ROOTS.some(prefix => normalizedPath.startsWith(prefix))) continue
    const result = validateContracts(options, normalizedPath)
    allErrors.push(...result.errors)
    allWarnings.push(...result.warnings)
  }

  return {
    ok: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  }
}

export function diffVariants(fromOptions: VariantPluginOptions, toOptions: VariantPluginOptions, importPaths: string[]): DiffEntry[] {
  const diffs: DiffEntry[] = []

  for (const importPath of importPaths) {
    const fromGraph = buildResolutionGraph(fromOptions, importPath)
    const toGraph = buildResolutionGraph(toOptions, importPath)

    const fromMap = new Map(fromGraph.symbols.map(s => [s.symbol, s]))
    const toMap = new Map(toGraph.symbols.map(s => [s.symbol, s]))

    const symbols = new Set([...fromMap.keys(), ...toMap.keys()])

    for (const symbol of symbols) {
      const from = fromMap.get(symbol)
      const to = toMap.get(symbol)
      if (!from || !to) continue
      if (from.candidatePath !== to.candidatePath || from.sourceFile !== to.sourceFile) {
        diffs.push({
          importPath,
          symbol,
          from: { layer: from.layer, sourceFile: from.sourceFile },
          to: { layer: to.layer, sourceFile: to.sourceFile },
        })
      }
    }
  }

  return diffs
}
