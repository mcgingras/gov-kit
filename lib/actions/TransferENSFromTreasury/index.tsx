import { parseEther, formatUnits } from "viem";
import { TransferENSFromTreasuryAction, TransferENSTransaction } from "./types";
import { defineContractCallTransaction } from "../../utils/define-contract-call-transaction";
import TransferENSFromTreasuryForm, { dataToAction } from "./Form";
import { defineAction } from "../../utils/define-action";

const ENS_TOKEN_ADDRESS = "0x65A3870F48B5237f27f674Ec42eA1E017E111D63";

export const transferENSTransactionConfig = defineContractCallTransaction<TransferENSTransaction>({
  type: "transfer-ens",
  target: ENS_TOKEN_ADDRESS,
  signature: "transfer(address,uint256)",
  decode: (target, args) => ({
    type: "transfer-ens",
    target,
    receiver: (args[0] as string).toLowerCase() as `0x${string}`,
    value: BigInt(args[1]),
  }),
  encode: (t) => ({ args: [t.receiver, t.value] }),
});

export const TransferENSFromTreasuryActionConfig = defineAction<
  TransferENSFromTreasuryAction,
  TransferENSTransaction
>({
  type: "transfer-ens-from-treasury",
  transactions: [transferENSTransactionConfig],
  form: () => <TransferENSFromTreasuryForm />,
  formdataToAction: dataToAction,
  actionToTransactions: (a) => [
    {
      type: "transfer-ens",
      target: ENS_TOKEN_ADDRESS as `0x${string}`,
      value: parseEther(a.amount),
      receiver: a.receiver,
    },
  ],
  transactionsToAction: (r) => {
    const transferEnsTx = r.find(
      (t) => t.type === "transfer-ens"
    ) as TransferENSTransaction | null;

    if (transferEnsTx != null) {
      const action: TransferENSFromTreasuryAction = {
        type: "transfer-ens-from-treasury",
        receiver: transferEnsTx.receiver,
        amount: formatUnits(transferEnsTx.value, 18),
      };
      return { action, consumed: 1 };
    }

    return null;
  },
  actionSummary: (a) => (
    <>
      Transfer <em>{a.amount} ENS</em> to <em>{a.receiver}</em>
    </>
  ),
});
