import { useEffect, useState } from "react";
import SearchForm, { type SearchSubmit } from "./components/SearchForm";
import SankeyGraph from "./components/SankeyGraph";
import { getTipHeight, AddressNotFoundError, RateLimitError } from "./api/mempool";
import { traceGraph, type TraceResult } from "./lib/traceGraph";
import { formatBtc, formatNumber, shortenAddress } from "./lib/format";

type View = "landing" | "loading" | "result" | "error";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [tipHeight, setTipHeight] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ exploredAddress: string; nodeCount: number } | null>(
    null,
  );
  const [result, setResult] = useState<TraceResult | null>(null);
  const [query, setQuery] = useState<SearchSubmit | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    getTipHeight()
      .then(setTipHeight)
      .catch(() => setTipHeight(null));
  }, []);

  async function handleSubmit(data: SearchSubmit) {
    setQuery(data);
    setView("loading");
    setProgress(null);
    setErrorMsg(null);
    try {
      const res = await traceGraph({
        start: data.start,
        end: data.end,
        maxHops: data.preset.maxHops,
        maxBranchPerNode: data.preset.maxBranchPerNode,
        maxOutputsPerTx: data.preset.maxOutputsPerTx,
        maxNodes: data.preset.maxNodes,
        onProgress: (p) => setProgress(p),
      });
      setResult(res);
      setView("result");
    } catch (err) {
      if (err instanceof AddressNotFoundError) {
        setErrorMsg("No se encontró la dirección indicada en la blockchain.");
      } else if (err instanceof RateLimitError) {
        setErrorMsg("Se alcanzó el límite de peticiones a la API pública. Espera unos segundos e inténtalo de nuevo.");
      } else {
        setErrorMsg("Ocurrió un error inesperado consultando la blockchain.");
      }
      setView("error");
    }
  }

  function reset() {
    setView("landing");
    setResult(null);
    setQuery(null);
    setErrorMsg(null);
  }

  return (
    <div className="flex min-h-full flex-col bg-[#0a0b0d]">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <button
          onClick={reset}
          className="font-mono text-lg font-bold tracking-tight text-neutral-100"
        >
          <span className="text-emerald-400">Tracer</span>BTC
        </button>
        <span className="hidden text-xs text-neutral-500 sm:inline">
          {tipHeight !== null ? `Altura de bloque: ${formatNumber(tipHeight)}` : ""}
        </span>
      </header>

      <main className="flex flex-1 flex-col justify-center py-10">
        {view === "landing" && (
          <SearchForm onSubmit={handleSubmit} tipHeight={tipHeight} />
        )}

        {view === "loading" && (
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-400" />
            <p className="text-sm text-neutral-300">Rastreando movimientos en la blockchain…</p>
            {progress && (
              <p className="font-mono text-xs text-neutral-500">
                explorando {shortenAddress(progress.exploredAddress)} · {progress.nodeCount}{" "}
                direcciones encontradas
              </p>
            )}
          </div>
        )}

        {view === "error" && (
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 text-center">
            <p className="text-sm text-red-400">{errorMsg}</p>
            <button
              onClick={reset}
              className="rounded-md border border-neutral-700 px-5 py-2 text-sm text-neutral-200 hover:border-neutral-500"
            >
              Volver a intentar
            </button>
          </div>
        )}

        {view === "result" && result && query && (
          <ResultView result={result} query={query} onReset={reset} />
        )}
      </main>

      <footer className="border-t border-neutral-800 px-6 py-4 text-center text-xs text-neutral-600">
        Datos en vivo vía mempool.space · uso educativo / analítico sobre información pública de la
        blockchain de Bitcoin
      </footer>
    </div>
  );
}

function ResultView({
  result,
  query,
  onReset,
}: {
  result: TraceResult;
  query: SearchSubmit;
  onReset: () => void;
}) {
  const startNode = result.nodes.find((n) => n.role === "start");
  const endNode = result.nodes.find((n) => n.role === "end");

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm text-neutral-400">
            {shortenAddress(query.start, 8)}
            {query.end && <> → {shortenAddress(query.end, 8)}</>}
          </h2>
          <p className="text-xs text-neutral-600">
            {result.nodes.length} direcciones · {result.edges.length} conexiones · preset{" "}
            {query.preset.label.toLowerCase()}
          </p>
        </div>
        <button
          onClick={onReset}
          className="rounded-md border border-neutral-700 px-4 py-2 text-xs text-neutral-200 hover:border-neutral-500"
        >
          Nueva búsqueda
        </button>
      </div>

      {query.end && !result.reachedEnd && (
        <div className="mb-4 rounded-md border border-amber-700/50 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          No se encontró un camino hasta la dirección de destino dentro del límite de saltos
          seleccionado. Se muestra el flujo explorado desde el origen; prueba con el preset
          "Profundo" para buscar más lejos.
        </div>
      )}
      {result.truncated && (
        <div className="mb-4 rounded-md border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs text-neutral-400">
          El rastreo se detuvo al alcanzar el límite de direcciones/saltos del preset elegido — es
          posible que existan más movimientos no mostrados.
        </div>
      )}

      {startNode && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Dirección de origen" value={shortenAddress(startNode.address, 8)} mono />
          <StatCard label="Saldo actual" value={formatBtc(startNode.balanceSats)} />
          <StatCard label="Transacciones" value={formatNumber(startNode.txCount)} />
          {endNode && (
            <StatCard label="Saldo en destino" value={formatBtc(endNode.balanceSats)} />
          )}
        </div>
      )}

      <div className="rounded-lg border border-neutral-800 p-2">
        <SankeyGraph nodes={result.nodes} edges={result.edges} />
      </div>
    </div>
  );
}

function StatCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-sm text-neutral-100 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
