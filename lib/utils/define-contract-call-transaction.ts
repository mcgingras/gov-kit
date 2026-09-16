import { AbiFunction, encodeAbiParameters, parseAbiItem } from "viem";
import {
  TransactionConfig,
  RawTransaction,
  ParserContext,
  ParsedFunctionCallTransaction,
} from "../types";
import { decodeCalldataWithSignature, normalizeSignature } from "./transactions";
import { FunctionCallCodeBlock } from "../components/FunctionCallCodeBlock";

type ContractCallTransactionConfig<T extends { type: string }> = {
  type: T["type"];
  target?: `0x${string}` | ((ctx: ParserContext) => `0x${string}`);
  signature: string;
  decode: (target: `0x${string}`, args: readonly any[]) => T;
  encode: (t: T) => { args: readonly any[] };
  transactionCodeBlock?: (t: ParsedFunctionCallTransaction<T>) => JSX.Element;
  transactionComment?: (t: T) => JSX.Element | undefined;
};

/**
 * Helper for the common case: match a function call (optionally to a specific
 * contract), decode args from calldata, encode args back. Auto-generates
 * matches, decode, encode, transactionCodeBlock, and specificity.
 *
 * Specificity: target match (+4) + signature match (+3) = 7 for
 * contract-specific matchers. Signature-only matchers get 3.
 */
export function defineContractCallTransaction<T extends { type: string }>(
  config: ContractCallTransactionConfig<T>
): TransactionConfig<T> {
  const resolveTarget = (ctx: ParserContext): `0x${string}` | undefined => {
    if (config.target === undefined) return undefined;
    if (typeof config.target === "function") return config.target(ctx);
    return config.target;
  };

  // Parse the signature to extract input types for encoding
  const { inputs: paramTypes } = parseAbiItem(
    `function ${config.signature}`
  ) as AbiFunction;

  // Auto-compute specificity: target (+4) + signature (+3)
  const hasTarget = config.target !== undefined;
  const specificity = (hasTarget ? 4 : 0) + 3;

  return {
    type: config.type,
    specificity,

    matches: (rt: RawTransaction, ctx: ParserContext): boolean => {
      const sigMatches =
        normalizeSignature(rt.signature) ===
        normalizeSignature(config.signature);
      if (!sigMatches) return false;

      if (hasTarget) {
        const targetAddress = resolveTarget(ctx);
        return rt.target.toLowerCase() === targetAddress?.toLowerCase();
      }
      return true;
    },

    decode: (rt: RawTransaction, ctx: ParserContext): T => {
      const {
        name: functionName,
        inputs: functionInputs,
        inputTypes: functionInputTypes,
      } = decodeCalldataWithSignature({
        signature: rt.signature,
        calldata: rt.calldata,
      });

      const decoded = config.decode(rt.target, functionInputs);

      // Attach function call metadata for code block rendering
      return {
        ...decoded,
        functionName,
        functionInputs,
        functionInputTypes,
      };
    },

    encode: (t: T, ctx: ParserContext): RawTransaction => {
      const { args } = config.encode(t);
      const targetAddress = resolveTarget(ctx) ?? (t as any).target;

      return {
        target: targetAddress,
        value: "0",
        signature: config.signature,
        calldata:
          paramTypes.length > 0
            ? encodeAbiParameters(paramTypes, args as any)
            : "0x",
      };
    },

    transactionCodeBlock:
      config.transactionCodeBlock ??
      ((t: ParsedFunctionCallTransaction<T>) => {
        return FunctionCallCodeBlock({
          target: (t as any).target,
          name: t.functionName!,
          inputs: t.functionInputs!,
          value: (t as any).value ?? 0n,
          inputTypes: t.functionInputTypes!,
        });
      }),

    transactionComment: config.transactionComment,
  };
}
