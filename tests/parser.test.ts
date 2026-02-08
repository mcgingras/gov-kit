import { describe, it, expect } from "vitest";
import { encodeAbiParameters } from "viem";
import { matchTransactions } from "../lib/utils/transaction-matcher";
import { encodeTransactions } from "../lib/utils/transaction-encoder";
import { buildActions, transactionsFromActions } from "../lib/utils/action-builder";
import { OneTimePaymentActionConfig } from "../lib/actions/NounsOneTimePayment";
import { RawTransactions, RawTransaction, ParserContext } from "../lib/types";

const ctx: ParserContext = { chainId: 1 };

const allTransactionConfigs =
  OneTimePaymentActionConfig.transactions ??
  OneTimePaymentActionConfig.getTransactions?.() ??
  [];

const SEND_FROG_1_ETH_RAW: RawTransactions = {
  targets: ["0x65A3870F48B5237f27f674Ec42eA1E017E111D63"] as `0x${string}`[],
  signatures: [""] as string[],
  calldatas: ["0x"] as `0x${string}`[],
  values: ["1000000000000000000"],
};

const SEND_FROG_1_USDC_RAW: RawTransactions = {
  targets: ["0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d"] as `0x${string}`[],
  signatures: ["sendOrRegisterDebt(address,uint256)"] as string[],
  calldatas: [
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      ["0x65A3870F48B5237f27f674Ec42eA1E017E111D63", 1000n]
    ),
  ] as `0x${string}`[],
  values: ["0"],
};

function rawTransactionsToArray(raw: RawTransactions): RawTransaction[] {
  return raw.targets.map((target, i) => ({
    target: target.toLowerCase() as `0x${string}`,
    signature: raw.signatures[i],
    calldata: raw.calldatas[i],
    value: BigInt(raw.values[i]),
  }));
}

function toRawTransactions(txs: RawTransaction[]): RawTransactions {
  return txs.reduce(
    (acc: RawTransactions, t: RawTransaction) => ({
      targets: [...acc.targets, t.target],
      values: [...acc.values, t.value?.toString()],
      signatures: [...acc.signatures, t.signature],
      calldatas: [...acc.calldatas, t.calldata],
    }),
    { targets: [], values: [], signatures: [], calldatas: [] }
  );
}

describe("Transaction matching and encoding", () => {
  it("should parse a simple ETH transfer", () => {
    const rawTxs = rawTransactionsToArray(SEND_FROG_1_ETH_RAW);
    const result = matchTransactions(rawTxs, allTransactionConfigs, ctx);

    expect(result[0]).toEqual({
      type: "transfer",
      target: "0x65a3870f48b5237f27f674ec42ea1e017e111d63",
      value: 1000000000000000000n,
    });
  });

  it("should parse a USDC transfer for nouns", () => {
    const rawTxs = rawTransactionsToArray(SEND_FROG_1_USDC_RAW);
    const result = matchTransactions(rawTxs, allTransactionConfigs, ctx);

    expect(result[0]).toEqual(
      expect.objectContaining({
        functionName: "sendOrRegisterDebt",
        receiverAddress: "0x65a3870f48b5237f27f674ec42ea1e017e111d63",
        target: "0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d",
        type: "usdc-transfer-via-payer",
        usdcAmount: 1000n,
      })
    );
  });

  it("should parse multiple transactions", () => {
    const combinedRaw: RawTransactions = {
      targets: [
        ...SEND_FROG_1_ETH_RAW.targets,
        ...SEND_FROG_1_USDC_RAW.targets,
      ],
      signatures: [
        ...SEND_FROG_1_ETH_RAW.signatures,
        ...SEND_FROG_1_USDC_RAW.signatures,
      ],
      calldatas: [
        ...SEND_FROG_1_ETH_RAW.calldatas,
        ...SEND_FROG_1_USDC_RAW.calldatas,
      ],
      values: [...SEND_FROG_1_ETH_RAW.values, ...SEND_FROG_1_USDC_RAW.values],
    };
    const rawTxs = rawTransactionsToArray(combinedRaw);
    const result = matchTransactions(rawTxs, allTransactionConfigs, ctx);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("transfer");
    expect(result[1].type).toBe("usdc-transfer-via-payer");
  });

  it("should encode (unparse) a transfer", () => {
    const decoded = [
      {
        type: "transfer",
        target: "0x65A3870F48B5237f27f674Ec42eA1E017E111D63" as `0x${string}`,
        value: 1000000000000000000n,
      },
    ];
    const rawTxs = encodeTransactions(decoded, allTransactionConfigs, ctx);
    const result = toRawTransactions(rawTxs);

    expect(result).toEqual(SEND_FROG_1_ETH_RAW);
  });

  it("should resolve actions (action to transactions)", () => {
    const actions = [
      {
        type: "one-time-payment" as const,
        target: "0x65A3870F48B5237f27f674Ec42eA1E017E111D63" as `0x${string}`,
        currency: "eth" as const,
        amount: "1000",
      },
    ];
    const result = transactionsFromActions(
      actions,
      [OneTimePaymentActionConfig],
      ctx
    );

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("transfer");
  });

  it("should build actions from transactions", () => {
    const decoded = [
      {
        type: "transfer" as const,
        target: "0x65A3870F48B5237f27f674Ec42eA1E017E111D63" as `0x${string}`,
        value: 1000000000000000000n,
      },
    ];
    const result = buildActions(decoded, [OneTimePaymentActionConfig], ctx);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("one-time-payment");
  });
});
