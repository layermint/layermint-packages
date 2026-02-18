import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

export function resolveConcreteFile(baseDir: string, importPath: string): string | null {
  const sanitized = importPath.replace(/\.(ts|tsx|mts|cts)$/, '')
  const base = resolve(baseDir, sanitized)

  for (const ext of EXTENSIONS) {
    const candidate = `${base}${ext}`
    if (existsSync(candidate) && !statSync(candidate).isDirectory()) {
      return candidate
    }
  }

  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const ext of EXTENSIONS) {
      const indexFile = resolve(base, `index${ext}`)
      if (existsSync(indexFile) && !statSync(indexFile).isDirectory()) {
        return indexFile
      }
    }
  }

  return null
}

export function resolveSpecToFile(specifier: string, fromFile: string, srcRoot: string): string | null {
  if (specifier.startsWith('.')) {
    return resolveConcreteFile(dirname(fromFile), specifier)
  }

  if (specifier.startsWith('@/')) {
    return resolveConcreteFile(srcRoot, specifier.slice(2))
  }

  return null
}
