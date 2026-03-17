#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { Command } from "commander"
import type { LayerName, VariantPluginOptions, VariantSelector } from "@layermint/shared-types"
import { buildResolutionGraph, checkVariant, diffVariants } from "@layermint/sdk-vite/core"

function parseLayers(value: string): LayerName[] {
  const layers = value.split(",").map(v => v.trim())
  return layers as LayerName[]
}

function parseLegacyVariant(variant?: string): VariantSelector {
  if (!variant) return {}
  const match = variant.match(/^(tenant|brand|region)\/(.+)$/)
  if (!match) return {}
  const dim = match[1] as "tenant" | "brand" | "region"
  return { [dim]: match[2] }
}

function buildSelector(input: {
  variant?: string
  region?: string
  brand?: string
  tenant?: string
}): VariantSelector {
  const legacy = parseLegacyVariant(input.variant)
  const region = input.region ?? legacy.region
  const brand = input.brand ?? legacy.brand
  const tenant = input.tenant ?? legacy.tenant
  return {
    ...(region ? { region } : {}),
    ...(brand ? { brand } : {}),
    ...(tenant ? { tenant } : {}),
  }
}

function createOptions(selector: VariantSelector, layers: LayerName[], root: string, legacyVariant?: string): VariantPluginOptions {
  return {
    ...(legacyVariant ? { variant: legacyVariant } : {}),
    selector,
    layers,
    roots: {
      srcRoot: resolve(root, "src"),
      variantsRoot: resolve(root, "src/variants"),
    },
    mergeStrategy: "namedExport",
    contractChecks: true,
  }
}

function collectImportPaths(root: string): string[] {
  const out: string[] = []
  const srcRoot = resolve(root, "src")
  const variantsRoot = resolve(root, "src/variants")
  const queue = [srcRoot]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    if (!existsSync(current)) continue
    if (current === variantsRoot) continue
    for (const item of readdirSync(current)) {
      const full = resolve(current, item)
      const stats = statSync(full)
      if (stats.isDirectory()) {
        queue.push(full)
      } else if (/\.(ts|tsx|mts|cts)$/.test(item)) {
        const rel = full.replace(srcRoot + "/", "").replace(/\.(ts|tsx|mts|cts)$/, "")
        out.push(`@/${rel}`)
      }
    }
  }

  return out.sort()
}

function printTable(rows: Array<Record<string, string>>): void {
  if (rows.length === 0) {
    console.log("No results")
    return
  }
  const first = rows[0]
  if (!first) return
  const headers = Object.keys(first)
  const widths = headers.map(h => Math.max(h.length, ...rows.map(r => (r[h] ?? "").length)))
  const headerLine = headers.map((h, i) => h.padEnd(widths[i] ?? 0)).join(" | ")
  const divider = widths.map(w => "-".repeat(w)).join("-|-")
  console.log(headerLine)
  console.log(divider)
  for (const row of rows) {
    console.log(headers.map((h, i) => (row[h] ?? "").padEnd(widths[i] ?? 0)).join(" | "))
  }
}

const program = new Command()
program.name("variant").description("LayerMint variant CLI")

program
  .command("check")
  .option("--variant <variant>", "Legacy variant key, e.g. tenant/acme (deprecated)")
  .option("--region <region>", "Region selector key")
  .option("--brand <brand>", "Brand selector key")
  .option("--tenant <tenant>", "Tenant selector key")
  .option("--layers <layers>", "Layer order", "region,brand,tenant,default")
  .option("--root <root>", "Project root", process.cwd())
  .option("--json", "JSON output", false)
  .action(opts => {
    const selector = buildSelector(opts)
    const options = createOptions(selector, parseLayers(opts.layers), opts.root, opts.variant)
    const result = checkVariant(options)

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      printTable(
        result.errors.map(err => ({
          level: "error",
          code: err.code,
          file: err.file,
          symbol: err.symbol ?? "",
          message: err.message,
        }))
      )
      if (result.warnings.length > 0) {
        printTable(
          result.warnings.map(err => ({
            level: "warning",
            code: err.code,
            file: err.file,
            symbol: err.symbol ?? "",
            message: err.message,
          }))
        )
      }
    }

    process.exitCode = result.ok ? 0 : 1
  })

program
  .command("graph")
  .requiredOption("--import <importPath>", "Import path, e.g. @/features/Button")
  .option("--variant <variant>", "Legacy variant key (deprecated)")
  .option("--region <region>", "Region selector key")
  .option("--brand <brand>", "Brand selector key")
  .option("--tenant <tenant>", "Tenant selector key")
  .option("--layers <layers>", "Layer order", "region,brand,tenant,default")
  .option("--root <root>", "Project root", process.cwd())
  .option("--format <format>", "json|mermaid", "json")
  .action(opts => {
    const selector = buildSelector(opts)
    const options = createOptions(selector, parseLayers(opts.layers), opts.root, opts.variant)
    const graph = buildResolutionGraph(options, opts.import)

    if (opts.format === "mermaid") {
      const lines = ["graph LR", `A["${graph.importPath}"]`]
      graph.siteCandidates.forEach((candidate, idx) => {
        const id = `C${idx}`
        lines.push(`${id}["${candidate.candidatePath}: ${candidate.exists ? "hit" : "miss"}"]`)
        lines.push(`A --> ${id}`)
      })
      graph.symbols.forEach((s, idx) => {
        const symId = `S${idx}`
        lines.push(`${symId}["${s.symbol} -> ${s.candidatePath}"]`)
        lines.push(`A --> ${symId}`)
      })
      console.log(lines.join("\n"))
      return
    }

    console.log(JSON.stringify(graph, null, 2))
  })

program
  .command("diff")
  .option("--from <fromVariant>", "From legacy variant key (deprecated)")
  .option("--to <toVariant>", "To legacy variant key (deprecated)")
  .option("--from-region <region>", "From region selector key")
  .option("--from-brand <brand>", "From brand selector key")
  .option("--from-tenant <tenant>", "From tenant selector key")
  .option("--to-region <region>", "To region selector key")
  .option("--to-brand <brand>", "To brand selector key")
  .option("--to-tenant <tenant>", "To tenant selector key")
  .option("--layers <layers>", "Layer order", "region,brand,tenant,default")
  .option("--root <root>", "Project root", process.cwd())
  .option("--json", "JSON output", false)
  .action(opts => {
    const layers = parseLayers(opts.layers)
    const fromSelector = buildSelector({
      variant: opts.from,
      region: opts.fromRegion,
      brand: opts.fromBrand,
      tenant: opts.fromTenant,
    })
    const toSelector = buildSelector({
      variant: opts.to,
      region: opts.toRegion,
      brand: opts.toBrand,
      tenant: opts.toTenant,
    })

    const fromOptions = createOptions(fromSelector, layers, opts.root, opts.from)
    const toOptions = createOptions(toSelector, layers, opts.root, opts.to)
    const imports = collectImportPaths(opts.root)
    const diffs = diffVariants(fromOptions, toOptions, imports)

    if (opts.json) {
      console.log(JSON.stringify(diffs, null, 2))
    } else {
      printTable(
        diffs.map(d => ({
          import: d.importPath,
          symbol: d.symbol,
          from: `${d.from.layer} (${d.from.sourceFile})`,
          to: `${d.to.layer} (${d.to.sourceFile})`,
        }))
      )
    }

    process.exitCode = diffs.length > 0 ? 1 : 0
  })

program.parse()
