export type LayerName = 'tenant' | 'brand' | 'region' | 'default'
export type VariantDimension = 'region' | 'brand' | 'tenant'

export interface VariantSelector {
  region?: string
  brand?: string
  tenant?: string
}

export interface VariantRoots {
  coreRoot: string
  variantsRoot: string
}

export interface VariantPluginOptions {
  /**
   * @deprecated Prefer selector. Kept for backward compatibility.
   */
  variant?: string
  selector?: VariantSelector
  layers: LayerName[]
  roots: VariantRoots
  mergeStrategy: 'namedExport'
  contractChecks: boolean
}

export interface ContractError {
  code: 'LM001' | 'LM002' | 'LM003' | 'LM004'
  message: string
  file: string
  symbol?: string
  suggestion?: string
}

export interface SymbolResolution {
  symbol: string
  sourceFile: string
  layer: LayerName
  candidatePath: string
  rank: number
}

export interface ModuleResolutionGraph {
  importPath: string
  variant: string
  selector: VariantSelector
  defaultFile: string
  siteCandidates: Array<{
    layer: LayerName
    candidatePath: string
    dimensions: VariantDimension[]
    file: string
    exists: boolean
    rank: number
  }>
  symbols: SymbolResolution[]
}

export interface DiffEntry {
  importPath: string
  symbol: string
  from: {
    layer: LayerName
    sourceFile: string
  }
  to: {
    layer: LayerName
    sourceFile: string
  }
}

export interface CheckResult {
  ok: boolean
  errors: ContractError[]
  warnings: ContractError[]
}
