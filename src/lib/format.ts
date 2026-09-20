const SATS_PER_BTC = 100_000_000;

export function satsToBtc(sats: number): number {
  return sats / SATS_PER_BTC;
}

export function formatBtc(sats: number, maxDecimals = 8): string {
  const btc = satsToBtc(sats);
  const abs = Math.abs(btc);
  const decimals = abs === 0 ? 2 : abs < 0.001 ? maxDecimals : abs < 1 ? 6 : 4;
  return `${btc.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  })} BTC`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("es-ES");
}

export function shortenAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

export function shortenTxid(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}

export function isLikelyBtcAddress(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // legacy (1...), P2SH (3...), bech32 (bc1...) — loose check, real validation happens via API 404
  return /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(v) || /^(bc1|tb1)[a-z0-9]{25,60}$/i.test(v);
}

export function formatDate(unixSeconds: number | undefined): string {
  if (!unixSeconds) return "en mempool";
  return new Date(unixSeconds * 1000).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
