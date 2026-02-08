import { describe, it, expect } from "vitest";
import { encodeAbiParameters, parseEther } from "viem";
import { matchTransactions, matchTransaction } from "../lib/utils/transaction-matcher";
import { encodeTransactions } from "../lib/utils/transaction-encoder";
import { buildActions, transactionsFromActions } from "../lib/utils/action-builder";
import { OneTimePaymentActionConfig } from "../lib/actions/NounsOneTimePayment";
import { TransferENSFromTreasuryActionConfig } from "../lib/actions/TransferENSFromTreasury";
import { CustomTransactionActionConfig } from "../lib/actions/CustomTransaction";
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

const ENS_TOKEN_ADDRESS = "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72";
const NOUNS_PAYER_ADDRESS = "0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d";
const RANDOM_EOA = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

// All actions registered together, like a real app would
const allActions = [
  TransferENSFromTreasuryActionConfig,
  OneTimePaymentActionConfig,
  CustomTransactionActionConfig,
];
const allTxConfigs = allActions.flatMap(
  (a) => a.transactions ?? []
);

describe("Specificity and matching order", () => {
  it("should auto-compute higher specificity for contract-specific matchers", () => {
    // TransferENS uses defineContractCallTransaction with a target → specificity 7
    const ensTxConfig = TransferENSFromTreasuryActionConfig.transactions![0];
    expect(ensTxConfig.specificity).toBe(7);

    // USDC payer also has target + signature → specificity 7
    const usdcTxConfig = OneTimePaymentActionConfig.transactions!.find(
      (t) => t.type === "usdc-transfer-via-payer"
    );
    expect(usdcTxConfig!.specificity).toBe(7);

    // Generic function-call has no target, no signature match → specificity 1
    const fnCallConfig = CustomTransactionActionConfig.transactions!.find(
      (t) => t.type === "function-call"
    );
    expect(fnCallConfig!.specificity).toBe(1);
  });

  it("should auto-derive action specificity from child transactions", () => {
    // TransferENS action: max of children (7) = 7
    expect(TransferENSFromTreasuryActionConfig.specificity).toBe(7);

    // OneTimePayment: max(1, 7) = 7
    expect(OneTimePaymentActionConfig.specificity).toBe(7);

    // CustomTransaction: max(1, 1) = 1
    expect(CustomTransactionActionConfig.specificity).toBe(1);
  });

  it("should match transfer(address,uint256) on ENS token as transfer-ens, not generic function-call", () => {
    const raw: RawTransaction = {
      target: ENS_TOKEN_ADDRESS,
      signature: "transfer(address,uint256)",
      calldata: encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [RANDOM_EOA, parseEther("100")]
      ),
      value: "0",
    };

    const result = matchTransaction(raw, allTxConfigs, ctx);
    expect(result.type).toBe("transfer-ens");
  });

  it("should match transfer(address,uint256) on a random address as generic function-call", () => {
    const raw: RawTransaction = {
      target: RANDOM_EOA,
      signature: "transfer(address,uint256)",
      calldata: encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        ["0x1234567890abcdef1234567890abcdef12345678", parseEther("100")]
      ),
      value: "0",
    };

    const result = matchTransaction(raw, allTxConfigs, ctx);
    // Should NOT match transfer-ens since target is wrong
    expect(result.type).toBe("function-call");
  });

  it("should match sendOrRegisterDebt on payer contract as usdc-transfer-via-payer, not generic function-call", () => {
    const raw: RawTransaction = {
      target: NOUNS_PAYER_ADDRESS as `0x${string}`,
      signature: "sendOrRegisterDebt(address,uint256)",
      calldata: encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [RANDOM_EOA, 5000000n]
      ),
      value: "0",
    };

    const result = matchTransaction(raw, allTxConfigs, ctx);
    expect(result.type).toBe("usdc-transfer-via-payer");
  });

  it("should match sendOrRegisterDebt on a random address as generic function-call", () => {
    const raw: RawTransaction = {
      target: RANDOM_EOA,
      signature: "sendOrRegisterDebt(address,uint256)",
      calldata: encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        ["0x1234567890abcdef1234567890abcdef12345678", 5000000n]
      ),
      value: "0",
    };

    const result = matchTransaction(raw, allTxConfigs, ctx);
    // Wrong target, so should fall through to generic
    expect(result.type).toBe("function-call");
  });

  it("should round-trip ENS transfer: encode then decode back", () => {
    const raw: RawTransaction = {
      target: ENS_TOKEN_ADDRESS,
      signature: "transfer(address,uint256)",
      calldata: encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [RANDOM_EOA, parseEther("100")]
      ),
      value: "0",
    };

    const decoded = matchTransaction(raw, allTxConfigs, ctx);
    expect(decoded.type).toBe("transfer-ens");

    const ensTxConfig = allTxConfigs.find((t) => t.type === "transfer-ens")!;
    const reEncoded = ensTxConfig.encode(decoded, ctx);

    expect(reEncoded.target).toBe(ENS_TOKEN_ADDRESS);
    expect(reEncoded.signature).toBe("transfer(address,uint256)");

    // Decode again and verify it matches
    const reDecoded = matchTransaction(reEncoded, allTxConfigs, ctx);
    expect(reDecoded.type).toBe("transfer-ens");
  });

  it("should build correct actions from mixed raw transactions", () => {
    const rawTxs: RawTransaction[] = [
      {
        target: ENS_TOKEN_ADDRESS,
        signature: "transfer(address,uint256)",
        calldata: encodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          [RANDOM_EOA, parseEther("100")]
        ),
        value: "0",
      },
      {
        target: NOUNS_PAYER_ADDRESS as `0x${string}`,
        signature: "sendOrRegisterDebt(address,uint256)",
        calldata: encodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          [RANDOM_EOA, 5000000n]
        ),
        value: "0",
      },
      {
        target: RANDOM_EOA,
        signature: "",
        calldata: "0x",
        value: parseEther("1"),
      },
    ];

    const decoded = matchTransactions(rawTxs, allTxConfigs, ctx);
    expect(decoded[0].type).toBe("transfer-ens");
    expect(decoded[1].type).toBe("usdc-transfer-via-payer");
    expect(decoded[2].type).toBe("transfer");

    const actions = buildActions(decoded, allActions as any, ctx);
    expect(actions).toHaveLength(3);
    expect(actions[0].type).toBe("transfer-ens-from-treasury");
    expect(actions[1].type).toBe("one-time-payment");
    expect(actions[2].type).toBe("one-time-payment");
  });
});
