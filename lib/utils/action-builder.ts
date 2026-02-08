import { ActionConfig, BaseAction, ParserContext } from "../types";

/**
 * Sorts action configs by specificity (highest first).
 * This ensures more specific actions are tried before generic ones.
 *
 * @param configs - Array of action configurations
 * @returns Sorted array (highest specificity first)
 */
function sortBySpecificity<A extends BaseAction, T extends { type: string }>(
  configs: ActionConfig<A, T>[]
): ActionConfig<A, T>[] {
  return [...configs].sort((a, b) => {
    const aSpec = a.specificity ?? 1;
    const bSpec = b.specificity ?? 1;
    return bSpec - aSpec; // Higher specificity first
  });
}

/**
 * Builds actions from an array of decoded transactions.
 * Uses a greedy algorithm that tries each action config in order (by specificity)
 * and consumes matching transactions.
 *
 * @param transactions - Array of decoded transactions
 * @param configs - Array of action configurations
 * @param ctx - Parser context
 * @returns Array of actions built from the transactions
 * @throws Error if any transactions cannot be matched to an action
 */
export function buildActions<A extends BaseAction, T extends { type: string }>(
  transactions: T[],
  configs: ActionConfig<A, T>[],
  ctx: ParserContext
): A[] {
  // Sort configs by specificity (highest first)
  const sortedConfigs = sortBySpecificity(configs);

  const actions: A[] = [];
  let remaining = [...transactions];

  // Greedy matching: try each action until all transactions are consumed
  while (remaining.length > 0) {
    let matched = false;

    for (const config of sortedConfigs) {
      try {
        const result = config.transactionsToAction(remaining, ctx);

        if (result) {
          actions.push(result.action);
          remaining = remaining.slice(result.consumed);
          matched = true;
          break; // Start over from the top with remaining transactions
        }
      } catch (error) {
        // If a builder throws, continue to next one
        if (
          process.env.NODE_ENV === "development" ||
          process.env.NODE_ENV === "test"
        ) {
          console.warn(
            `Action config "${config.type}" threw error during building:`,
            error
          );
        }
      }
    }

    if (!matched) {
      const unmatched = remaining[0];
      throw new Error(
        `Could not match transaction to any action. ` +
          `Transaction type: ${unmatched.type}. ` +
          `Available actions: ${configs.map((c) => c.type).join(", ")}. ` +
          `Consider adding a fallback action (like CustomTransaction) with low specificity.`
      );
    }
  }

  return actions;
}

/**
 * Converts an array of actions to their corresponding decoded transactions.
 * Each action is resolved to one or more transactions based on its configuration.
 *
 * @param actions - Array of actions to convert
 * @param configs - Array of action configurations
 * @param ctx - Parser context
 * @returns Flattened array of decoded transactions
 * @throws Error if an action's config cannot be found
 */
export function transactionsFromActions<
  A extends BaseAction,
  T extends { type: string }
>(actions: A[], configs: ActionConfig<A, T>[], ctx: ParserContext): T[] {
  const transactions: T[] = [];

  for (const action of actions) {
    // Find the matching config by type
    const config = configs.find((c) => c.type === action.type) as
      | ActionConfig<A, T>
      | undefined;

    if (!config) {
      throw new Error(
        `No action config found for type "${action.type}". ` +
          `Available types: ${configs.map((c) => c.type).join(", ")}`
      );
    }

    try {
      const actionTransactions = config.actionToTransactions(action, ctx);
      transactions.push(...actionTransactions);
    } catch (error) {
      throw new Error(
        `Failed to convert action of type "${action.type}" to transactions: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return transactions;
}
