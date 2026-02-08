import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { encodeAbiParameters, parseEther } from "viem";

import { GovKitProvider } from "../lib/components/GovKitProvider";
import { GovKitForm } from "../lib/components/GovKitForm";
import { ActionList } from "../lib/components/ActionList";
import { matchTransactions } from "../lib/utils/transaction-matcher";
import { encodeTransactions } from "../lib/utils/transaction-encoder";
import { buildActions } from "../lib/utils/action-builder";

import { OneTimePaymentActionConfig } from "../lib/actions/NounsOneTimePayment";
import { CustomTransactionActionConfig } from "../lib/actions/CustomTransaction";
import { TransferENSFromTreasuryActionConfig } from "../lib/actions/TransferENSFromTreasury";

import type { BaseAction, RawTransaction } from "../lib/types";

const allActions = [
  TransferENSFromTreasuryActionConfig,
  OneTimePaymentActionConfig,
  CustomTransactionActionConfig,
];

// Collect all transaction configs from all actions
const allTransactionConfigs = allActions.flatMap(
  (a) => a.transactions ?? a.getTransactions?.() ?? []
);

const ctx = { chainId: 1 };

// Some sample raw transactions for the decode demo
// 1. ENS token transfer (transfer-ens action)
// 2. USDC via Nouns payer (one-time-payment usdc action)
// 3. Plain ETH transfer (one-time-payment eth action)
const SAMPLE_RAW_TRANSACTIONS: RawTransaction[] = [
  {
    target: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
    signature: "transfer(address,uint256)",
    calldata: encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", parseEther("100")]
    ),
    value: "0",
  },
  {
    target: "0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d",
    signature: "sendOrRegisterDebt(address,uint256)",
    calldata: encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }],
      ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", 5000000n]
    ),
    value: "0",
  },
  {
    target: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    signature: "",
    calldata: "0x",
    value: parseEther("1"),
  },
];

function App() {
  const [actions, setActions] = useState<BaseAction[]>([]);
  const [decodedTxs, setDecodedTxs] = useState<any[] | null>(null);
  const [builtActions, setBuiltActions] = useState<BaseAction[] | null>(null);
  const [roundTripRaw, setRoundTripRaw] = useState<RawTransaction[] | null>(null);

  const handleSubmit = (action: BaseAction) => {
    setActions((prev) => [...prev, action]);
  };

  const handleDecode = () => {
    try {
      const decoded = matchTransactions(
        SAMPLE_RAW_TRANSACTIONS,
        allTransactionConfigs,
        ctx
      );
      setDecodedTxs(decoded);

      // Build actions from decoded transactions
      const built = buildActions(decoded, allActions as any, ctx);
      setBuiltActions(built);

      // Round-trip: encode back to raw
      const reEncoded = encodeTransactions(decoded, allTransactionConfigs, ctx);
      setRoundTripRaw(reEncoded);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-1">gov-kit-react demo</h1>
        <p className="text-neutral-500 text-sm mb-6">
          A library for converting Ethereum transaction calldata to UI and back.
        </p>
      </div>

      {/* Section 1: Create actions via form */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">
          Create an Action
        </h2>
        <GovKitForm onSubmit={handleSubmit}>
          <div className="space-y-4">
            <GovKitForm.TypeSelect className="border p-2 rounded-lg w-full" />
            <GovKitForm.FormBody className="mt-4" />
            <GovKitForm.Button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Add Action
            </GovKitForm.Button>
          </div>
        </GovKitForm>
      </section>

      {/* Section 2: Display submitted actions */}
      {actions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">
            Submitted Actions ({actions.length})
          </h2>
          <ActionList actions={actions} />
        </section>
      )}

      {/* Section 3: Decode raw transactions */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">
          Decode Raw Transactions
        </h2>
        <p className="text-sm text-neutral-500">
          Demonstrates the full pipeline: raw transactions → decoded
          transactions → actions → re-encoded raw transactions.
        </p>

        <div>
          <h3 className="text-sm font-semibold text-neutral-600 mb-2">
            Sample raw transactions:
          </h3>
          <ul className="space-y-2 text-xs">
            {SAMPLE_RAW_TRANSACTIONS.map((tx, i) => (
              <li key={i} className="bg-neutral-50 border rounded p-2 font-mono">
                <div>
                  <span className="text-neutral-400">target:</span>{" "}
                  {tx.target}
                </div>
                <div>
                  <span className="text-neutral-400">signature:</span>{" "}
                  {tx.signature || "(empty)"}
                </div>
                <div>
                  <span className="text-neutral-400">value:</span>{" "}
                  {tx.value.toString()}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={handleDecode}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
        >
          Decode & Build Actions
        </button>

        {decodedTxs && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-600 mb-2">
                1. Decoded transactions (matchTransactions):
              </h3>
              <pre className="bg-neutral-50 border rounded p-3 text-xs overflow-x-auto">
                {JSON.stringify(
                  decodedTxs,
                  (_, v) => (typeof v === "bigint" ? v.toString() + "n" : v),
                  2
                )}
              </pre>
            </div>

            {builtActions && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-600 mb-2">
                  2. Built actions (buildActions):
                </h3>
                <pre className="bg-neutral-50 border rounded p-3 text-xs overflow-x-auto">
                  {JSON.stringify(builtActions, null, 2)}
                </pre>
              </div>
            )}

            {roundTripRaw && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-600 mb-2">
                  3. Re-encoded raw transactions (encodeTransactions):
                </h3>
                <pre className="bg-neutral-50 border rounded p-3 text-xs overflow-x-auto">
                  {JSON.stringify(
                    roundTripRaw,
                    (_, v) =>
                      typeof v === "bigint" ? v.toString() + "n" : v,
                    2
                  )}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 4: Specificity info */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">
          Auto-computed Specificity
        </h2>
        <p className="text-sm text-neutral-500">
          Specificity determines matching order. Higher specificity matchers are
          tried first (contract-specific before generic).
        </p>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-neutral-100">
              <th className="text-left p-2 border-b">Action / Transaction</th>
              <th className="text-left p-2 border-b">Specificity</th>
            </tr>
          </thead>
          <tbody>
            {allActions.map((action) => (
              <React.Fragment key={action.type}>
                <tr className="bg-white">
                  <td className="p-2 border-b font-medium">{action.type}</td>
                  <td className="p-2 border-b">{action.specificity}</td>
                </tr>
                {(action.transactions ?? []).map((tx) => (
                  <tr key={tx.type} className="bg-neutral-50">
                    <td className="p-2 border-b pl-6 text-neutral-500">
                      {tx.type}
                    </td>
                    <td className="p-2 border-b text-neutral-500">
                      {tx.specificity}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GovKitProvider
      config={{
        etherscanApiKey: import.meta.env.VITE_ETHERSCAN_API_KEY ?? "",
        actions: allActions,
      }}
    >
      <App />
    </GovKitProvider>
  </React.StrictMode>
);
