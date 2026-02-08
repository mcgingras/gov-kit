import {
  parseUnits,
  parseEther,
  formatEther,
  formatUnits,
} from "viem";
import { ParserContext } from "../../types";
import {
  TransferTransaction,
  UsdcTransferViaPayerTransaction,
  OneTimePaymentAction,
} from "./types";
import { resolveIdentifier } from "../../utils/contracts";
import { decimalsByCurrency } from "../../utils/transactions";
import { UnparsedFunctionCallCodeBlock } from "../../components/UnparsedFunctionCallCodeBlock";
import { defineContractCallTransaction } from "../../utils/define-contract-call-transaction";
import OneTimePaymentForm, { dataToAction } from "./Form";
import { defineTransaction, defineAction } from "../../utils/define-action";

const transferTransactionConfig = defineTransaction<TransferTransaction>({
  type: "transfer",
  specificity: 1,
  matches: (data) => {
    return data.signature === "" && data.calldata === "0x";
  },
  decode: (data) => ({
    type: "transfer",
    target: data.target,
    value: BigInt(data.value),
  }),
  encode: (t) => ({
    target: t.target,
    value: t.value,
    signature: "",
    calldata: "0x",
  }),
  transactionCodeBlock: (t) => {
    return <UnparsedFunctionCallCodeBlock transaction={t} />;
  },
  transactionComment: () => {
    return <p>No comment</p>;
  },
});

export const usdcTransferViaPayerTransactionConfig = defineContractCallTransaction<UsdcTransferViaPayerTransaction>(
  {
    type: "usdc-transfer-via-payer",
    target: (ctx: ParserContext) => {
      const nounsPayerContract = resolveIdentifier(ctx.chainId, "payer");
      return nounsPayerContract.address;
    },
    signature: "sendOrRegisterDebt(address,uint256)",
    decode: (target, args) => ({
      type: "usdc-transfer-via-payer",
      target: target as `0x${string}`,
      receiverAddress: (args[0] as string).toLowerCase() as `0x${string}`,
      usdcAmount: BigInt(args[1]),
    }),
    encode: (t) => ({ args: [t.receiverAddress, t.usdcAmount] }),
  }
);

export const OneTimePaymentActionConfig = defineAction<
  OneTimePaymentAction,
  TransferTransaction | UsdcTransferViaPayerTransaction
>({
  type: "one-time-payment",
  transactions: [transferTransactionConfig, usdcTransferViaPayerTransactionConfig],
  form: () => <OneTimePaymentForm />,
  formdataToAction: dataToAction,
  actionToTransactions: (a) => {
    switch (a.currency) {
      case "eth":
        return [
          {
            type: "transfer",
            target: a.target,
            value: parseEther(a.amount),
          },
        ];
      case "usdc":
        return [
          {
            type: "usdc-transfer-via-payer",
            receiverAddress: a.target,
            target: a.target,
            usdcAmount: parseUnits(a.amount, 6),
          },
        ];
      default:
        throw new Error("Unknown currency: " + a.currency);
    }
  },
  transactionsToAction: (r) => {
    const transferTx = r.find(
      (t) => t.type === "transfer"
    ) as TransferTransaction | null;

    if (transferTx != null) {
      const action: OneTimePaymentAction = {
        type: "one-time-payment",
        target: transferTx.target,
        currency: "eth",
        amount: formatEther(transferTx.value),
      };
      return { action, consumed: 1 };
    }

    const usdcTransferTx = r.find(
      (t) => t.type === "usdc-transfer-via-payer"
    ) as UsdcTransferViaPayerTransaction | null;

    if (usdcTransferTx != null) {
      const action: OneTimePaymentAction = {
        type: "one-time-payment",
        target: usdcTransferTx.receiverAddress,
        currency: "usdc",
        amount: formatUnits(
          usdcTransferTx.usdcAmount,
          decimalsByCurrency["usdc"]
        ),
      };
      return { action, consumed: 1 };
    }

    return null;
  },
  actionSummary: (a) => (
    <>
      Transfer{" "}
      <em>
        {a.amount} {a.currency.toUpperCase()}
      </em>{" "}
      to <em>{a.target}</em>
    </>
  ),
});
