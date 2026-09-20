import { useState, type FormEvent } from "react";
import { DEPTH_PRESETS, type DepthPreset } from "../lib/traceGraph";
import { isLikelyBtcAddress } from "../lib/format";

export interface SearchSubmit {
  start: string;
  end?: string;
  preset: DepthPreset;
}

interface SearchFormProps {
  onSubmit: (data: SearchSubmit) => void;
  tipHeight: number | null;
  disabled?: boolean;
}

export default function SearchForm({ onSubmit, tipHeight, disabled }: SearchFormProps) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [presetId, setPresetId] = useState<DepthPreset["id"]>("medio");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const s = start.trim();
    const en = end.trim();

    if (!isLikelyBtcAddress(s)) {
      setError("Introduce una dirección de Bitcoin de origen válida.");
      return;
    }
    if (en && !isLikelyBtcAddress(en)) {
      setError("La dirección de destino no parece válida.");
      return;
    }
    if (en && en === s) {
      setError("La dirección de origen y destino no pueden ser iguales.");
      return;
    }
    setError(null);
    const preset = DEPTH_PRESETS.find((p) => p.id === presetId)!;
    onSubmit({ start: s, end: en || undefined, preset });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4">
      <h1 className="mb-2 text-center text-3xl font-semibold tracking-tight text-neutral-100 sm:text-4xl">
        Rastrea el flujo de bitcoins entre direcciones
      </h1>
      <p className="mb-8 text-center text-sm text-neutral-400">
        Introduce una dirección para visualizar sus movimientos, o dos direcciones para trazar el
        camino que siguieron los bitcoins entre ellas. Datos en vivo desde la blockchain.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="Dirección de origen (ej. bc1q… / 1… / 3…)"
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          className="w-full rounded-md border-2 border-neutral-700 bg-neutral-900 px-4 py-3 font-mono text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-emerald-400 disabled:opacity-50"
        />
        <input
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          placeholder="Dirección de destino (opcional — déjalo vacío para explorar solo el origen)"
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          className="w-full rounded-md border-2 border-neutral-700 bg-neutral-900 px-4 py-3 font-mono text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-emerald-400 disabled:opacity-50"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          {DEPTH_PRESETS.map((p) => {
            const active = p.id === presetId;
            return (
              <button
                type="button"
                key={p.id}
                disabled={disabled}
                onClick={() => setPresetId(p.id)}
                className={`rounded-lg border-2 px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                  active
                    ? "border-emerald-400 bg-emerald-400/10"
                    : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"
                }`}
              >
                <div className="font-semibold text-neutral-100">{p.label}</div>
                <div className="text-xs text-neutral-400">{p.description}</div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2 pt-4">
          <button
            type="submit"
            disabled={disabled}
            className="rounded-lg bg-lime-400 px-10 py-3 text-lg font-bold text-neutral-950 transition-transform hover:scale-[1.02] hover:bg-lime-300 active:scale-[0.98] disabled:opacity-50"
          >
            Rastrear
          </button>
          <span className="text-xs text-neutral-500">
            Altura de bloque:{" "}
            {tipHeight !== null ? tipHeight.toLocaleString("es-ES") : "cargando…"}
          </span>
        </div>
      </form>
    </div>
  );
}
