import {
  RawTransaction,
  TransactionConfig,
  ParserContext,
} from "../types";

/**
 * Sorts transaction configs by specificity (highest first).
 * This ensures more specific matchers are tried before generic ones.
 *
 * @param configs - Array of transaction configurations
 * @returns Sorted array (highest specificity first)
 */
function sortBySpecificity<T extends { type: string }>(
  configs: TransactionConfig<T>[]
): TransactionConfig<T>[] {
  return [...configs].sort((a, b) => {
    const aSpec = a.specificity ?? 1;
    const bSpec = b.specificity ?? 1;
    return bSpec - aSpec; // Higher specificity first
  });
}

/**
 * Detects if multiple transaction configs can match the same raw transaction.
 * This helps identify ambiguous matchers during development.
 *
 * @param rawTx - The raw transaction to test
 * @param configs - Array of transaction configurations
 * @param ctx - Parser context
 * @returns Array of matching transaction types
 */
function detectAmbiguousMatches<T extends { type: string }>(
  rawTx: RawTransaction,
  configs: TransactionConfig<T>[],
  ctx: ParserContext
): string[] {
  const matches: string[] = [];

  for (const config of configs) {
    try {
      if (config.matches(rawTx, ctx)) {
        matches.push(config.type);
      }
    } catch (error) {
      // Ignore errors during ambiguity detection
    }
  }

  return matches;
}

/**
 * Matches a single raw transaction to its decoded form.
 * Tries each transaction config in order (by specificity) until one matches.
 *
 * @param rawTx - The raw transaction to match
 * @param configs - Array of transaction configurations (should be pre-sorted)
 * @param ctx - Parser context
 * @returns The decoded transaction
 * @throws Error if no config matches the transaction
 */
export function matchTransaction<T extends { type: string }>(
  rawTx: RawTransaction,
  configs: TransactionConfig<T>[],
  ctx: ParserContext
): T {
  // In development mode, check for ambiguous matches
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    const matches = detectAmbiguousMatches(rawTx, configs, ctx);
    if (matches.length > 1) {
      console.warn(
        `Ambiguous transaction match detected. Transaction to ${rawTx.target} ` +
        `can be matched by multiple configs: ${matches.join(', ')}. ` +
        `Using first match: ${matches[0]}. Consider increasing specificity ` +
        `or making matchers more specific.`
      );
    }
  }

  // Find the first matching config
  for (const config of configs) {
    try {
      if (config.matches(rawTx, ctx)) {
        return config.decode(rawTx, ctx);
      }
    } catch (error) {
      // If a matcher throws, continue to next one
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        console.warn(
          `Transaction config "${config.type}" threw error during matching:`,
          error
        );
      }
    }
  }

  // No match found
  throw new Error(
    `No transaction config matched transaction to ${rawTx.target}. ` +
    `Signature: ${rawTx.signature || '(empty)'}, ` +
    `Value: ${rawTx.value}. ` +
    `Available types: ${configs.map(c => c.type).join(', ')}`
  );
}

/**
 * Matches an array of raw transactions to their decoded forms.
 * Automatically sorts configs by specificity before matching.
 *
 * @param rawTransactions - Array of raw transactions to match
 * @param configs - Array of transaction configurations
 * @param ctx - Parser context
 * @returns Array of decoded transactions
 */
export function matchTransactions<T extends { type: string }>(
  rawTransactions: RawTransaction[],
  configs: TransactionConfig<T>[],
  ctx: ParserContext
): T[] {
  // Sort configs by specificity (highest first)
  const sortedConfigs = sortBySpecificity(configs);

  // Match each transaction
  return rawTransactions.map(rawTx =>
    matchTransaction(rawTx, sortedConfigs, ctx)
  );
}
