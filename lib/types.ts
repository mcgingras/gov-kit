import { AbiParameter } from "viem";

export type RawTransaction = {
  target: `0x${string}`;
  signature: string;
  calldata: `0x${string}`;
  value: bigint | string;
};

export type RawTransactions = {
  targets: `0x${string}`[];
  values: string[];
  signatures: string[];
  calldatas: `0x${string}`[];
};

export type ParserContext = {
  chainId: number;
};

export type ContractInfo = {
  name: string;
  abi: any;
  isProxy: boolean;
  implementationAddress: `0x${string}`;
  implementationAbi: any;
};

export type ParsedFunctionCallTransaction<T> = T & {
  functionName?: string;
  functionInputs?: any[];
  functionInputTypes?: readonly AbiParameter[];
};

export type TransactionConfig<T extends { type: string }> = {
  type: T["type"];
  specificity?: number;
  matches: (t: RawTransaction, ctx: ParserContext) => boolean;
  decode: (t: RawTransaction, ctx: ParserContext) => T;
  encode: (t: T, ctx: ParserContext) => RawTransaction;
  transactionCodeBlock?: (t: ParsedFunctionCallTransaction<T>) => JSX.Element;
  transactionComment?: (t: T) => JSX.Element | undefined;
};

export interface BaseAction {
  type: string;
}

export type ActionConfig<
  A extends BaseAction,
  T extends BaseReadableTransaction
> = {
  type: A["type"];
  specificity?: number;
  form: React.FC;
  formdataToAction: (data: any) => A;
  transactions?: TransactionConfig<any>[];
  getTransactions?: () => TransactionConfig<any>[];
  actionToTransactions: (a: A, ctx: ParserContext) => T[];
  /**
   * Must match the leading transaction(s) of `r`; `consumed` is the number of leading entries consumed.
   */
  transactionsToAction: (r: T[], ctx: ParserContext) => { action: A; consumed: number } | null;
  actionSummary: (a: A) => JSX.Element;
};

export interface BaseReadableTransaction {
  type: string;
}
