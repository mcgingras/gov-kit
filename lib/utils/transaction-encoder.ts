import {
  RawTransaction,
  TransactionConfig,
  ParserContext,
} from "../types";

/**
 * Encodes a single decoded transaction back to its raw form.
 * Finds the matching config by type and calls its encode method.
 *
 * @param transaction - The decoded transaction to encode
 * @param configs - Array of transaction configurations
 * @param ctx - Parser context
 * @returns The raw transaction
 * @throws Error if no config matches the transaction type
 */
export function encodeTransaction<T extends { type: string }>(
  transaction: T,
  configs: TransactionConfig<any>[],
  ctx: ParserContext
): RawTransaction {
  // Find the matching config by type
  const config = configs.find(c => c.type === transaction.type);

  if (!config) {
    throw new Error(
      `No transaction config found for type "${transaction.type}". ` +
      `Available types: ${configs.map(c => c.type).join(', ')}`
    );
  }

  try {
    return config.encode(transaction, ctx);
  } catch (error) {
    throw new Error(
      `Failed to encode transaction of type "${transaction.type}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Encodes an array of decoded transactions back to their raw forms.
 *
 * @param transactions - Array of decoded transactions to encode
 * @param configs - Array of transaction configurations
 * @param ctx - Parser context
 * @returns Array of raw transactions
 */
export function encodeTransactions<T extends { type: string }>(
  transactions: T[],
  configs: TransactionConfig<any>[],
  ctx: ParserContext
): RawTransaction[] {
  return transactions.map(tx => encodeTransaction(tx, configs, ctx));
}
