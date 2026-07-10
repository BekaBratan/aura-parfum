// Default fallback rate if DB is unavailable
export const DEFAULT_KZT_RATE = 460;

export function convertToKzt(priceUsd: number, kztRate: number): number {
  return priceUsd * kztRate;
}

export function formatKzt(amount: number): string {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatUsd(priceUsd: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceUsd);
}

// Format KZT with secondary USD: "1 200 ₸" (primary) + "$2.60" (secondary label)
export function formatKztWithUsd(
  priceUsd: number,
  kztRate: number
): { kzt: string; usd: string } {
  return {
    kzt: formatKzt(convertToKzt(priceUsd, kztRate)),
    usd: formatUsd(priceUsd),
  };
}

export function isRateStale(updatedAt: string, thresholdHours = 24): boolean {
  const diff = Date.now() - new Date(updatedAt).getTime();
  return diff > thresholdHours * 60 * 60 * 1000;
}
