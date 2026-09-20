import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { sankey, sankeyLinkHorizontal, sankeyJustify } from "d3-sankey";
import type { GraphEdge, GraphNode } from "../lib/traceGraph";
import { formatBtc, shortenAddress, shortenTxid } from "../lib/format";

interface SankeyGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

type NodeExtra = GraphNode;
type LinkExtra = { txid: string; valueSats: number };

const NODE_WIDTH = 14;
const NODE_PADDING = 28;

export default function SankeyGraph({ nodes, edges }: SankeyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 520 });
  const [hovered, setHovered] = useState<{ x: number; y: number; content: React.ReactNode } | null>(
    null,
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const nodeCount = nodes.length || 1;
      const height = Math.max(520, Math.min(1400, nodeCount * 34));
      setSize({ width: Math.max(box.width, 640), height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [nodes.length]);

  const layout = useMemo(() => {
    if (nodes.length === 0) return null;

    const sankeyGen = sankey<NodeExtra, LinkExtra>()
      .nodeId((d) => d.address)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(NODE_PADDING)
      .nodeAlign(sankeyJustify)
      .extent([
        [1, 10],
        [size.width - 1, size.height - 10],
      ]);

    const graph = sankeyGen({
      nodes: nodes.map((n) => ({ ...n })),
      links: edges.map((e) => ({
        source: e.source,
        target: e.target,
        value: Math.max(satsToWeight(e.valueSats), 0.0001),
        txid: e.txid,
        valueSats: e.valueSats,
      })),
    });

    return graph;
  }, [nodes, edges, size.width, size.height]);

  const linkPath = useMemo(() => sankeyLinkHorizontal<NodeExtra, LinkExtra>(), []);

  if (!layout) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
        Sin datos para mostrar.
      </div>
    );
  }

  const { nodes: graphNodes, links: graphLinks } = layout;

  return (
    <div ref={containerRef} className="relative w-full overflow-x-auto">
      <svg
        width={size.width}
        height={size.height}
        className="block min-w-full"
        style={{ background: "#000" }}
      >
        <defs>
          {/* userSpaceOnUse: con objectBoundingBox (por defecto) un enlace perfectamente
              horizontal tiene un bounding box de altura 0 y el SVG deja de pintarlo. */}
          <linearGradient
            id="link-gradient"
            gradientUnits="userSpaceOnUse"
            x1={0}
            x2={size.width}
            y1={0}
            y2={0}
          >
            <stop offset="0%" stopColor="#0ea5a0" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#5eead4" stopOpacity={0.65} />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={size.width} height={size.height} fill="#000000" stroke="#3a3d45" />

        <g>
          {graphLinks.map((link, i) => {
            const path = linkPath(link);
            if (!path) return null;
            return (
              <path
                key={i}
                d={path}
                fill="none"
                stroke="url(#link-gradient)"
                strokeWidth={Math.max(link.width ?? 1, 1.2)}
                strokeOpacity={0.9}
                className="transition-[stroke-opacity] duration-150 hover:stroke-opacity-100"
                onMouseEnter={(evt) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  setHovered({
                    x: evt.clientX - (rect?.left ?? 0),
                    y: evt.clientY - (rect?.top ?? 0),
                    content: (
                      <>
                        <div className="text-emerald-300">{formatBtc(link.valueSats)}</div>
                        <div className="text-neutral-400">tx {shortenTxid(link.txid)}</div>
                      </>
                    ),
                  });
                }}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </g>

        <g>
          {graphNodes.map((node, i) => {
            const x0 = node.x0 ?? 0;
            const x1 = node.x1 ?? 0;
            const y0 = node.y0 ?? 0;
            const y1 = node.y1 ?? 0;
            const isEdgeRole = node.role !== "intermediate";
            const color =
              node.role === "start" ? "#facc15" : node.role === "end" ? "#f87171" : "#4ade80";
            const labelLeft = x0 < size.width / 2;
            return (
              <g
                key={i}
                onMouseEnter={(evt) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  setHovered({
                    x: evt.clientX - (rect?.left ?? 0),
                    y: evt.clientY - (rect?.top ?? 0),
                    content: (
                      <>
                        <div className="font-semibold text-neutral-100">{node.address}</div>
                        <div className="text-emerald-300">saldo: {formatBtc(node.balanceSats)}</div>
                        <div className="text-neutral-400">{node.txCount} tx totales</div>
                      </>
                    ),
                  });
                }}
                onMouseLeave={() => setHovered(null)}
                className="cursor-default"
              >
                <rect
                  x={x0}
                  y={y0}
                  width={Math.max(x1 - x0, 2)}
                  height={Math.max(y1 - y0, 3)}
                  fill={color}
                  stroke={isEdgeRole ? "#fff7d6" : "#0a0b0d"}
                  strokeWidth={isEdgeRole ? 1.5 : 0.5}
                  rx={2}
                />
                <text
                  x={labelLeft ? x0 - 8 : x1 + 8}
                  y={(y0 + y1) / 2}
                  textAnchor={labelLeft ? "end" : "start"}
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="#e6e8eb"
                  className="pointer-events-none select-none"
                >
                  {shortenAddress(node.address, 6)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-xs shadow-xl"
          style={{ left: hovered.x + 14, top: hovered.y + 14 }}
        >
          {hovered.content}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4 px-1 text-xs text-neutral-400">
        <LegendDot color="#facc15" label="Dirección de origen" />
        <LegendDot color="#4ade80" label="Dirección intermedia" />
        <LegendDot color="#f87171" label="Dirección de destino" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

// Convierte sats a un peso de enlace legible: escala logarítmica suavizada para que
// transacciones muy pequeñas o muy grandes convivan sin que unas eclipsen a las otras.
function satsToWeight(sats: number): number {
  const btc = sats / 1e8;
  return Math.log10(1 + btc * 1000);
}
