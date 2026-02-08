import { useState } from "react";
import { BaseAction, BaseReadableTransaction } from "../types";
import { useGovKitContext } from "./GovKitProvider";

export const ActionListItem = ({ action }: { action: BaseAction }) => {
  const [expanded, setExpanded] = useState(false);
  const { actions } = useGovKitContext();

  const actionConfig = actions.find((a) => a.type === action.type);
  if (actionConfig == null) {
    throw new Error(`Unknown action type: "${action.type}"`);
  }

  const actionTransactionConfigs =
    actionConfig.transactions ?? actionConfig.getTransactions?.() ?? [];
  const actionTransactions = actionConfig.actionToTransactions(action as any, {
    chainId: 1,
  });
  const ActionSummary = actionConfig.actionSummary(action as any);

  return (
    <>
      <div>{ActionSummary}</div>
      <button onClick={() => setExpanded(!expanded)}>
        {expanded ? "Hide" : "Show"} Transaction
      </button>
      {expanded && (
        <ul className="space-y-4">
          {actionTransactions.map((t: BaseReadableTransaction, i: number) => {
            const transactionConfig = actionTransactionConfigs.find(
              (atc) => atc.type === t.type
            );
            if (transactionConfig == null) {
              throw new Error(`Unknown transaction type: "${t.type}"`);
            }

            // Round-trip through encode/decode to get parsed metadata
            const raw = transactionConfig.encode(t, { chainId: 1 });
            const parsed = transactionConfig.decode(raw, { chainId: 1 });

            const Comment = transactionConfig.transactionComment?.(t);
            const CodeBlock = transactionConfig.transactionCodeBlock?.(parsed);
            return (
              <li key={i}>
                {CodeBlock != null && CodeBlock}
                {Comment != null && Comment}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};

export const ActionList = ({ actions }: { actions: BaseAction[] }) => {
  return (
    <>
      <h1>Actions</h1>
      <ul>
        {actions.map((a, i) => (
          <li key={`${a.type}-${i}`}>
            <ActionListItem action={a} />
          </li>
        ))}
      </ul>
    </>
  );
};
