import { TransactionConfig, ActionConfig, BaseAction } from "../types";

/**
 * Helper function to define a transaction configuration with type inference.
 * Applies default specificity of 1 if not specified.
 */
export function defineTransaction<T extends { type: string }>(
  config: TransactionConfig<T>
): TransactionConfig<T> {
  return {
    ...config,
    specificity: config.specificity ?? 1,
  };
}

/**
 * Helper function to define an action configuration with type inference.
 * If specificity is not set, auto-derives it from the max specificity
 * of its child transaction configs.
 */
export function defineAction<
  A extends BaseAction,
  T extends { type: string }
>(
  config: ActionConfig<A, T>
): ActionConfig<A, T> {
  const transactions = config.transactions ?? config.getTransactions?.() ?? [];

  // Auto-derive specificity from child transactions if not explicitly set
  let specificity = config.specificity;
  if (specificity === undefined && transactions.length > 0) {
    specificity = Math.max(...transactions.map(c => c.specificity ?? 1));
  }
  specificity = specificity ?? 1;

  return {
    ...config,
    specificity,
    // Normalize: always populate transactions from whichever source was provided
    transactions: config.transactions ?? config.getTransactions?.() ?? [],
  };
}
