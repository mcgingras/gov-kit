import {
  parseUnits,
  parseEther,
  formatEther,
  formatUnits,
  encodeAbiParameters,
} from "viem";
import { TransactionConfig, ActionConfig } from "../../types";
import {
  TransferTransaction,
  UsdcTransferViaPayerTransaction,
  OneTimePaymentAction,
} from "./types";
import { resolveIdentifier } from "../../utils/contracts";
import { FunctionCallCodeBlock } from "../../components/FunctionCallCodeBlock";
import { UnparsedFunctionCallCodeBlock } from "../../components/UnparsedFunctionCallCodeBlock";
import OneTimePaymentForm, { dataToAction } from "./Form";
import {
  normalizeSignature,
  decodeCalldataWithSignature,
} from "../../utils/ethereum";

export const decimalsByCurrency = {
  eth: 18,
  weth: 18,
  usdc: 6,
};

const transferTransactionConfig: TransactionConfig<TransferTransaction> = {
  type: "transfer",
  parse: (data) => {
    const isEthTransfer = data.signature == "" && data.calldata === "0x";

    if (isEthTransfer)
      return {
        type: "transfer",
        target: data.target,
        value: BigInt(data.value),
      };

    return false;
  },
  unparse: (t) => {
    return {
      target: t.target,
      value: t.value,
      signature: "",
      calldata: "0x",
    };
  },
  transactionCodeBlock: (t) => {
    return <UnparsedFunctionCallCodeBlock transaction={t} />;
  },
  transactionComment: () => {
    return <p>No comment</p>;
  },
};

export const usdcTransferViaPayerTransactionConfig: TransactionConfig<UsdcTransferViaPayerTransaction> =
  {
    type: "usdc-transfer-via-payer",
    parse: (rt, { chainId }: { chainId: number }) => {
      const nounsPayerContract = resolveIdentifier(chainId, "payer");

      const {
        name: functionName,
        inputs: functionInputs,
        inputTypes: functionInputTypes,
      } = decodeCalldataWithSignature({
        signature: rt.signature,
        calldata: rt.calldata,
      });

      if (
        rt.target === nounsPayerContract.address &&
        normalizeSignature(rt.signature) ===
          normalizeSignature("sendOrRegisterDebt(address,uint256)")
      ) {
        const receiverAddress = functionInputs[0].toLowerCase();

        return {
          type: "usdc-transfer-via-payer",
          target: rt.target as `0x${string}`,
          functionName,
          functionInputs,
          functionInputTypes,
          receiverAddress: receiverAddress,
          usdcAmount: BigInt(functionInputs[1]),
        };
      }

      return false;
    },
    unparse: (t, { chainId }: { chainId: number }) => {
      const nounsPayerContract = resolveIdentifier(chainId, "payer");
      return {
        target: nounsPayerContract.address,
        value: "0",
        signature: "sendOrRegisterDebt(address,uint256)",
        calldata: encodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          [t.receiverAddress, t.usdcAmount]
        ),
      };
    },
    transactionCodeBlock: (t) => {
      return (
        <FunctionCallCodeBlock
          target={t.target}
          name={t.functionName!}
          inputs={t.functionInputs!}
          value={t.usdcAmount}
          inputTypes={t.functionInputTypes!}
        />
      );
    },
    transactionComment: () => {
      return undefined;
    },
  };

export const OneTimePaymentActionConfig: ActionConfig<
  OneTimePaymentAction,
  TransferTransaction | UsdcTransferViaPayerTransaction
> = {
  type: "one-time-payment",
  form: () => <OneTimePaymentForm />,
  formdataToAction: dataToAction,
  getTransactions: () => {
    return [transferTransactionConfig, usdcTransferViaPayerTransactionConfig];
  },
  resolveAction: (a) => {
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
        throw new Error();
    }
  },
  buildAction: (r) => {
    let remainingTransactions = r;

    const transferTx = remainingTransactions.find(
      (t) => t.type === "transfer"
    ) as TransferTransaction | null;

    if (transferTx != null) {
      remainingTransactions = remainingTransactions.filter(
        (t) => t !== transferTx
      );
      const action: OneTimePaymentAction = {
        type: "one-time-payment",
        target: transferTx.target,
        currency: "eth",
        amount: formatEther(transferTx.value),
        // firstTransactionIndex: getTransactionIndex(transferTx),
      };
      return { action, remainingTransactions };
    }

    const usdcTransferTx = remainingTransactions.find(
      (t) => t.type === "usdc-transfer-via-payer"
    ) as UsdcTransferViaPayerTransaction | null;

    if (usdcTransferTx != null) {
      remainingTransactions = remainingTransactions.filter(
        (t) => t !== usdcTransferTx
      );
      const action: OneTimePaymentAction = {
        type: "one-time-payment",
        target: usdcTransferTx.receiverAddress,
        currency: "usdc",
        amount: formatUnits(
          usdcTransferTx.usdcAmount,
          decimalsByCurrency["usdc"]
        ),
        // firstTransactionIndex: getTransactionIndex(usdcTransferTx),
      };
      return { action, remainingTransactions };
    }

    return null;
  },
  actionSummary: (a) => {
    return (
      <>
        Transfer{" "}
        <em>
          {a.amount} {a.currency.toUpperCase()}
        </em>{" "}
        to <em>{a.target}</em>
      </>
    );
  },
};
