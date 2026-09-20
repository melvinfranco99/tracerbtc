# TracerBTC

Web para rastrear visualmente el flujo de bitcoins entre direcciones, usando datos en vivo
de la blockchain de Bitcoin (vía la API pública de [mempool.space](https://mempool.space)).

## Funcionalidad

- **Dirección única**: introduce una dirección y visualiza sus movimientos salientes (saldo,
  número de transacciones y hacia dónde fluyeron los bitcoins) en un diagrama de flujo tipo
  Sankey.
- **Origen → destino**: introduce dos direcciones y la app rastrea (BFS acotado por saltos)
  posibles caminos on-chain entre ambas, podando el grafo resultante a los movimientos que
  realmente conectan origen y destino.
- Tres profundidades de rastreo (rápido / medio / profundo) que controlan saltos, ramificación
  por dirección y nº máximo de direcciones exploradas, para no saturar la API pública.

## Stack

React + TypeScript + Vite, Tailwind CSS v4, D3 + d3-sankey para la visualización.

## Desarrollo

```bash
npm install
npm run dev
```

## Build / despliegue

```bash
npm run build     # genera dist/
npm run deploy    # publica dist/ en GitHub Pages (rama gh-pages)
```

## Notas

- Los datos provienen de una API pública sin autenticación; el rastreo aplica límites de
  saltos/ramificación tanto por legibilidad del grafo como para respetar los límites de la API.
- Uso educativo / analítico sobre información que ya es pública en la blockchain de Bitcoin.
