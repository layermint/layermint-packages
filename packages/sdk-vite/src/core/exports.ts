import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { resolveSpecToFile } from './files.js'

export interface ExportInfo {
  names: Set<string>
  hasDefault: boolean
  signatures: Map<string, string>
}

function nodeModifiers(node: ts.Node): readonly ts.Modifier[] {
  if (!ts.canHaveModifiers(node)) return []
  return ts.getModifiers(node) ?? []
}

function getTypeChecker(program: ts.Program, source: ts.SourceFile): ts.TypeChecker {
  const checker = program.getTypeChecker()
  return checker
}

function addSignature(
  signatures: Map<string, string>,
  checker: ts.TypeChecker,
  declaration: ts.Node,
  symbolName: string
): void {
  const symbol = checker.getSymbolAtLocation((declaration as ts.NamedDeclaration).name!)
  if (!symbol) return
  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration)
  const typeText = checker.typeToString(type)
  signatures.set(symbolName, typeText)
}

export function getExportsFromFile(
  filePath: string,
  srcRoot: string,
  seen = new Set<string>()
): ExportInfo {
  const out: ExportInfo = { names: new Set<string>(), hasDefault: false, signatures: new Map() }

  const absFile = resolve(filePath)
  if (seen.has(absFile)) return out
  seen.add(absFile)

  let content = ''
  try {
    content = readFileSync(absFile, 'utf8')
  } catch {
    return out
  }

  const scriptKind = absFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(absFile, content, ts.ScriptTarget.ESNext, true, scriptKind)
  const program = ts.createProgram({ rootNames: [absFile], options: { skipLibCheck: true } })
  const checker = getTypeChecker(program, source)

  for (const stmt of source.statements) {
    if (ts.isExportAssignment(stmt)) {
      out.hasDefault = true
      continue
    }

    if (ts.isExportDeclaration(stmt)) {
      if (stmt.isTypeOnly) continue

      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          if (el.isTypeOnly) continue
          out.names.add(el.name.text)
        }
      } else if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const nested = resolveSpecToFile(stmt.moduleSpecifier.text, absFile, srcRoot)
        if (nested) {
          const nestedExports = getExportsFromFile(nested, srcRoot, seen)
          for (const name of nestedExports.names) {
            out.names.add(name)
          }
          out.hasDefault = out.hasDefault || nestedExports.hasDefault
          for (const [name, signature] of nestedExports.signatures) {
            if (!out.signatures.has(name)) {
              out.signatures.set(name, signature)
            }
          }
        }
      }
      continue
    }

    const modifiers = nodeModifiers(stmt)
    const hasExport = modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    const hasDefault = modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)

    if (!hasExport) continue

    if (hasDefault) {
      out.hasDefault = true
    }

    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text
      out.names.add(name)
      addSignature(out.signatures, checker, stmt, name)
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      const name = stmt.name.text
      out.names.add(name)
      addSignature(out.signatures, checker, stmt, name)
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.text
          out.names.add(name)
          addSignature(out.signatures, checker, decl, name)
        }
      }
    } else if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) {
      out.names.add(stmt.name.text)
    } else if (ts.isEnumDeclaration(stmt)) {
      out.names.add(stmt.name.text)
    }
  }

  return out
}
