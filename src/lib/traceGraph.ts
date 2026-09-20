import { getAddressInfo, getAddressTxs, type Tx } from "../api/mempool";

export interface GraphNode {
  address: string;
  balanceSats: number;
  txCount: number;
  role: "start" | "end" | "intermediate";
}

export interface GraphEdge {
  source: string;
  target: string;
  valueSats: number;
  txid: string;
}

export interface TraceResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  reachedEnd: boolean;
  truncated: boolean;
  exploredCount: number;
}

export interface TraceParams {
  start: string;
  end?: string;
  maxHops: number;
  maxBranchPerNode: number;
  maxOutputsPerTx: number;
  maxNodes: number;
  onProgress?: (info: { exploredAddress: string; nodeCount: number }) => void;
}

export interface DepthPreset {
  id: "rapido" | "medio" | "profundo";
  label: string;
  maxHops: number;
  maxBranchPerNode: number;
  maxOutputsPerTx: number;
  maxNodes: number;
  description: string;
}

export const DEPTH_PRESETS: DepthPreset[] = [
  {
    id: "rapido",
    label: "Rápido",
    maxHops: 2,
    maxBranchPerNode: 3,
    maxOutputsPerTx: 3,
    maxNodes: 18,
    description: "2 saltos · vista rápida",
  },
  {
    id: "medio",
    label: "Medio",
    maxHops: 4,
    maxBranchPerNode: 3,
    maxOutputsPerTx: 4,
    maxNodes: 40,
    description: "4 saltos · equilibrado",
  },
  {
    id: "profundo",
    label: "Profundo",
    maxHops: 6,
    maxBranchPerNode: 4,
    maxOutputsPerTx: 4,
    maxNodes: 70,
    description: "6 saltos · más lento",
  },
];

function outgoingFlowsForAddress(address: string, txs: Tx[]) {
  return txs
    .filter((tx) => tx.vin.some((v) => v.prevout?.scriptpubkey_address === address))
    .map((tx) => {
      const outs = tx.vout.filter(
        (o) => o.scriptpubkey_address && o.scriptpubkey_address !== address,
      );
      const total = outs.reduce((s, o) => s + o.value, 0);
      return { tx, outs, total };
    })
    .filter((x) => x.outs.length > 0)
    .sort((a, b) => b.total - a.total);
}

export async function traceGraph(params: TraceParams): Promise<TraceResult> {
  const { start, end, maxHops, maxBranchPerNode, maxOutputsPerTx, maxNodes, onProgress } = params;

  const nodeIds = new Set<string>([start]);
  const nodeHop = new Map<string, number>([[start, 0]]);
  const edges: GraphEdge[] = [];
  const queue: { address: string; hop: number }[] = [{ address: start, hop: 0 }];
  let qi = 0;
  let exploredCount = 0;

  while (qi < queue.length && nodeIds.size < maxNodes) {
    const { address, hop } = queue[qi++];
    if (hop >= maxHops) continue;
    if (end && address === end) continue; // no need to keep expanding past the target

    let txs: Tx[];
    try {
      txs = await getAddressTxs(address);
    } catch {
      continue; // dirección inválida / rate limit puntual: se omite y se continúa el resto del rastreo
    }
    exploredCount++;
    onProgress?.({ exploredAddress: address, nodeCount: nodeIds.size });

    const flows = outgoingFlowsForAddress(address, txs).slice(0, maxBranchPerNode);
    for (const { tx, outs } of flows) {
      const sortedOuts = [...outs].sort((a, b) => b.value - a.value).slice(0, maxOutputsPerTx);
      for (const o of sortedOuts) {
        const target = o.scriptpubkey_address!;
        edges.push({ source: address, target, valueSats: o.value, txid: tx.txid });
        if (!nodeIds.has(target) && nodeIds.size < maxNodes) {
          nodeIds.add(target);
          nodeHop.set(target, hop + 1);
          queue.push({ address: target, hop: hop + 1 });
        }
      }
    }
  }

  const truncated = qi < queue.length || nodeIds.size >= maxNodes;

  // d3-sankey exige un grafo acíclico: descartamos aristas que apunten hacia atrás o al
  // mismo nivel (convergencias tardías a un nodo ya visitado) y fusionamos aristas paralelas
  // entre el mismo par de direcciones (varias tx entre A y B) sumando su valor.
  const merged = new Map<string, GraphEdge>();
  for (const e of edges) {
    if (e.source === e.target) continue;
    const sourceHop = nodeHop.get(e.source) ?? -Infinity;
    const targetHop = nodeHop.get(e.target) ?? Infinity;
    if (targetHop <= sourceHop) continue;
    const key = `${e.source}=>${e.target}`;
    const existing = merged.get(key);
    if (existing) {
      existing.valueSats += e.valueSats;
    } else {
      merged.set(key, { ...e });
    }
  }
  const cleanEdges = [...merged.values()];

  const reachedEnd = end ? nodeIds.has(end) && cleanEdges.some((e) => e.target === end) : true;

  let finalEdges = cleanEdges;
  let finalNodeIds = nodeIds;

  if (end && reachedEnd) {
    // Podamos el grafo a solo los nodos/enlaces que forman parte de algún camino hacia `end`.
    const predecessors = new Map<string, string[]>();
    for (const e of cleanEdges) {
      if (!predecessors.has(e.target)) predecessors.set(e.target, []);
      predecessors.get(e.target)!.push(e.source);
    }
    const reachable = new Set<string>([end]);
    const stack = [end];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const p of predecessors.get(cur) ?? []) {
        if (!reachable.has(p)) {
          reachable.add(p);
          stack.push(p);
        }
      }
    }
    finalEdges = cleanEdges.filter((e) => reachable.has(e.target));
    reachable.add(start);
    finalNodeIds = reachable;
  }

  const infos = await Promise.all(
    [...finalNodeIds].map(async (address) => {
      try {
        const info = await getAddressInfo(address);
        const balanceSats =
          info.chain_stats.funded_txo_sum -
          info.chain_stats.spent_txo_sum +
          info.mempool_stats.funded_txo_sum -
          info.mempool_stats.spent_txo_sum;
        return {
          address,
          balanceSats,
          txCount: info.chain_stats.tx_count + info.mempool_stats.tx_count,
        };
      } catch {
        return { address, balanceSats: 0, txCount: 0 };
      }
    }),
  );

  const nodes: GraphNode[] = infos.map((n) => ({
    ...n,
    role: n.address === start ? "start" : n.address === end ? "end" : "intermediate",
  }));

  return { nodes, edges: finalEdges, reachedEnd, truncated, exploredCount };
}
