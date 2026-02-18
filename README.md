# LayerMint Packages

Monorepo de paquetes publicables de LayerMint.

Este repo contiene el runtime para variantes en frontends, un CLI para validaciones y tipos compartidos, todo como paquetes independientes bajo el scope `@layermint/*`.

## Paquetes

- `@layermint/sdk-vite`: plugin Vite para resolución de overrides por capas/variantes.
- `@layermint/cli`: CLI `variant` para `check`, `graph`, `diff`.
- `@layermint/shared-types`: contratos y tipos reutilizables entre SDK/CLI.

## ¿Para qué sirve?

LayerMint evita forks por tenant/brand/region usando resolución con fallback por símbolo:

- sobrescribís solo lo necesario,
- mantenés una base común,
- reducís mantenimiento y regresiones.

## Estructura

```txt
.
├── packages/
│   ├── sdk-vite/
│   ├── cli/
│   └── shared-types/
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Requisitos

- Node.js 20+
- pnpm 9+

## Desarrollo local

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Probar en 2 minutos

1. Cloná e instalá:

```bash
git clone https://github.com/layermint/layermint-packages.git
cd layermint-packages
pnpm install
```

2. Build + tests rápidos:

```bash
pnpm build
pnpm test
```

3. Probar CLI localmente:

```bash
pnpm --filter @layermint/cli exec variant --help
```

4. (Opcional) Empaquetar y validar tarballs:

```bash
pnpm --filter @layermint/shared-types pack
pnpm --filter @layermint/sdk-vite pack
pnpm --filter @layermint/cli pack
```

Con eso ya verificaste que SDK/CLI/tipos están compilando y ejecutando correctamente.

## Instalación desde registry

### npmjs

```bash
npm i @layermint/sdk-vite @layermint/cli @layermint/shared-types
```

### GitHub Packages

```bash
npm i @layermint/sdk-vite @layermint/cli @layermint/shared-types --registry=https://npm.pkg.github.com
```

> Para GitHub Packages, configurar `.npmrc` con token de lectura.

## Publicación

Este repo publica por workflow de release en tag `v*`.

- CI: lint + typecheck + test + build
- Release: publish a GitHub Packages y npmjs

### Variables/secrets requeridos

- `NPM_TOKEN`: token npm con permisos de publish para `@layermint`.

### Flujo recomendado

1. Actualizar versiones (`package.json` de cada paquete).
2. Commit + push a `main`.
3. Crear tag:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

## Licencia

MIT — ver [`LICENSE`](./LICENSE).

## Contributors

- andrico
