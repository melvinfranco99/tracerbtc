// Cliente para la API pública de mempool.space (sin API key, CORS habilitado).
// Docs: https://mempool.space/docs/api/rest

const BASE_URL = "https://mempool.space/api";

export class AddressNotFoundError extends Error {
  address: string;
  constructor(address: string) {
    super(`Dirección no encontrada: ${address}`);
    this.name = "AddressNotFoundError";
    this.address = address;
  }
}

export class RateLimitError extends Error {
  constructor() {
    super("Límite de peticiones alcanzado, reintenta en unos segundos.");
    this.name = "RateLimitError";
  }
}

export interface AddressStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface AddressInfo {
  address: string;
  chain_stats: AddressStats;
  mempool_stats: AddressStats;
}

export interface Vin {
  txid: string;
  vout: number;
  prevout: { scriptpubkey_address?: string; value: number } | null;
}

export interface Vout {
  scriptpubkey_address?: string;
  value: number;
}

export interface TxStatus {
  confirmed: boolean;
  block_time?: number;
  block_height?: number;
}

export interface Tx {
  txid: string;
  vin: Vin[];
  vout: Vout[];
  status: TxStatus;
  fee: number;
}

// --- caché en memoria + límite de concurrencia para no saturar la API pública ---

const cache = new Map<string, unknown>();
const MAX_CONCURRENT = 4;
let active = 0;
const queue: (() => void)[] = [];

function runNext() {
  if (active >= MAX_CONCURRENT || queue.length === 0) return;
  active++;
  const job = queue.shift()!;
  job();
}

function schedule<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(() => {
      fn()
        .then(resolve, reject)
        .finally(() => {
          active--;
          runNext();
        });
    });
    runNext();
  });
}

async function getJSON<T>(path: string): Promise<T> {
  const cacheKey = path;
  if (cache.has(cacheKey)) return cache.get(cacheKey) as T;

  return schedule(async () => {
    if (cache.has(cacheKey)) return cache.get(cacheKey) as T;
    const res = await fetch(`${BASE_URL}${path}`);
    if (res.status === 404) {
      throw new AddressNotFoundError(path);
    }
    if (res.status === 429) {
      throw new RateLimitError();
    }
    if (!res.ok) {
      throw new Error(`Error de red (${res.status}) consultando ${path}`);
    }
    const data = (await res.json()) as T;
    cache.set(cacheKey, data);
    return data;
  });
}

export function getAddressInfo(address: string): Promise<AddressInfo> {
  return getJSON<AddressInfo>(`/address/${encodeURIComponent(address)}`);
}

export function getAddressTxs(address: string): Promise<Tx[]> {
  return getJSON<Tx[]>(`/address/${encodeURIComponent(address)}/txs`);
}

export function getTx(txid: string): Promise<Tx> {
  return getJSON<Tx>(`/tx/${encodeURIComponent(txid)}`);
}

export async function getTipHeight(): Promise<number> {
  const res = await fetch(`${BASE_URL}/blocks/tip/height`);
  if (!res.ok) throw new Error("No se pudo obtener la altura de la blockchain");
  const text = await res.text();
  return Number(text);
}
