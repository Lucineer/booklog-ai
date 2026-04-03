export async function softActualize<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.log(`[soft-actualize] ${label} simulated: ${(e as Error).message || e}`);
    return fallback;
  }
}

export function confidenceScore(context: string, hasData: boolean, hasModel: boolean): number {
  let score = 0.5;
  if (context && context.length > 50) score += 0.2;
  if (hasData) score += 0.2;
  if (hasModel) score += 0.1;
  return Math.min(score, 1.0);
}
