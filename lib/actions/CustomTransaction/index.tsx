import { ParserContext } from "../../types";
import {
  CustomTransactionAction,
  FunctionCallTransaction,
  PayableFunctionCallTransaction,
} from "./types";
import CustomTransactionForm, { dataToAction } from "./Form";
import {
  AbiParameter,
  encodeAbiParameters,
  formatUnits,
  parseAbiItem,
} from "viem";
import { AbiFunction } from "viem";
import { decodeCalldataWithSignature } from "../../utils/transactions";
import { formatAbiParameter } from "abitype";
import { FunctionCallCodeBlock } from "../../components/FunctionCallCodeBlock";
import { defineTransaction, defineAction } from "../../utils/define-action";

export const FunctionCallTransactionConfig = defineTransaction<FunctionCallTransaction>(
  {
    type: "function-call",
    matches: (rt) => {
      return BigInt(rt.value) === 0n && rt.signature !== "";
    },
    decode: (rt) => {
      const {
        name: functionName,
        inputs: functionInputs,
        inputTypes: functionInputTypes,
      } = decodeCalldataWithSignature({
        signature: rt.signature,
        calldata: rt.calldata,
      });

      return {
        type: "function-call",
        target: rt.target as `0x${string}`,
        functionName,
        functionInputs,
        functionInputTypes,
        value: 0n,
      };
    },
    encode: (t) => {
      const signature = `${t.functionName}(${t.functionInputTypes
        .map((t) => formatAbiParameter(t as unknown as AbiParameter))
        .join(",")})`;
      return {
        target: t.target,
        value: "0",
        signature,
        calldata: encodeAbiParameters(
          t.functionInputTypes,
          t.functionInputs as never
        ),
      };
    },
    transactionCodeBlock: (t) => {
      return (
        <FunctionCallCodeBlock
          target={t.target}
          name={t.functionName!}
          inputs={t.functionInputs!}
          value={t.value}
          inputTypes={t.functionInputTypes!}
        />
      );
    },
    transactionComment: () => {
      return undefined;
    },
  }
);

export const PayableFunctionCallTransactionConfig = defineTransaction<PayableFunctionCallTransaction>(
  {
    type: "payable-function-call",
    matches: (rt) => {
      return BigInt(rt.value) > 0n && rt.signature !== "";
    },
    decode: (rt) => {
      const {
        name: functionName,
        inputs: functionInputs,
        inputTypes: functionInputTypes,
      } = decodeCalldataWithSignature({
        signature: rt.signature,
        calldata: rt.calldata,
      });

      return {
        type: "payable-function-call",
        target: rt.target as `0x${string}`,
        functionName,
        functionInputs,
        functionInputTypes,
        value: BigInt(rt.value),
      };
    },
    encode: (t) => {
      const signature = `${t.functionName}(${t.functionInputTypes
        .map((t) => formatAbiParameter(t as unknown as AbiParameter))
        .join(",")})`;
      return {
        target: t.target,
        value: t.value,
        signature,
        calldata: encodeAbiParameters(
          t.functionInputTypes,
          t.functionInputs as never
        ),
      };
    },
    transactionCodeBlock: (t) => {
      return (
        <FunctionCallCodeBlock
          target={t.target}
          name={t.functionName!}
          inputs={t.functionInputs!}
          value={t.value}
          inputTypes={t.functionInputTypes!}
        />
      );
    },
    transactionComment: () => {
      return undefined;
    },
  }
);

export const CustomTransactionActionConfig = defineAction<
  CustomTransactionAction,
  FunctionCallTransaction | PayableFunctionCallTransaction
>({
  type: "custom-transaction",
  transactions: [
    FunctionCallTransactionConfig,
    PayableFunctionCallTransactionConfig,
  ],
  form: () => <CustomTransactionForm />,
  formdataToAction: dataToAction,
  actionToTransactions: (a) => {
    const { name: functionName, inputs: functionInputTypes } = parseAbiItem(
      `function ${a.contractCallSignature}`
    ) as AbiFunction;

    if (a.contractCallValue > 0)
      return [
        {
          type: "payable-function-call",
          target: a.contractCallTarget,
          functionName,
          functionInputs: a.contractCallArguments,
          functionInputTypes,
          value: BigInt(a.contractCallValue),
        },
      ];

    return [
      {
        type: "function-call",
        target: a.contractCallTarget,
        functionName,
        functionInputs: a.contractCallArguments,
        functionInputTypes,
        value: 0n,
      },
    ];
  },
  transactionsToAction: (r) => {
    const tx = r[0];

    // Match either function-call or payable-function-call
    if (tx.type !== "function-call" && tx.type !== "payable-function-call") {
      return null;
    }

    const signature = `${tx.functionName}(${tx.functionInputTypes
      .map((t) => formatAbiParameter(t))
      .join(",")})`;

    return {
      action: {
        type: "custom-transaction",
        target: tx.target,
        contractCallTarget: tx.target,
        contractCallSignature: signature,
        contractCallArguments: tx.functionInputs,
        contractCallValue: Number(tx.value),
      },
      consumed: 1,
    };
  },
  actionSummary: (a) => (
    <>
      {a.contractCallValue > 0 ? (
        <>
          <em>{formatUnits(BigInt(a.contractCallValue), 18)}</em> payable
          function call
        </>
      ) : (
        "Function call"
      )}{" "}
      to contract
      <em>{a.contractCallTarget}</em>
    </>
  ),
});
