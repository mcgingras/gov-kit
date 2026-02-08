import { useState, Fragment } from "react";
import {
  isAddress,
  parseUnits,
  decodeAbiParameters,
  encodeAbiParameters,
  parseEther,
} from "viem";
import { useFormContext, Controller } from "react-hook-form";
import { getContractInfo } from "../../routes/contract-info";
import { ContractInfo } from "../../types";
import { useGovKitContext } from "../../components/GovKitProvider";

export const dataToAction = (data: any) => {
  const parsedAbi = JSON.parse(data.abi);
  const selectedSignatureAbiItem = parsedAbi?.find(
    (i: any) => createSignature(i) === data.signature
  );
  const { inputs: inputTypes } = selectedSignatureAbiItem;
  return {
    type: "custom-transaction" as const,
    target: data.target,
    contractCallTarget: data.target,
    contractCallSignature: data.signature,
    contractCallArguments: JSON.parse(
      JSON.stringify(
        // Encoding and decoding gives us valid defaults for empty
        // arguments, e.g. empty numbers turn into zeroes
        decodeAbiParameters(
          inputTypes,
          encodeAbiParameters(inputTypes, data.args)
        ),
        (_, value) => (typeof value === "bigint" ? value.toString() : value)
      )
    ),
    contractCallValue: data.ethValue ? Number(parseEther(data.ethValue)) : 0,
  };
};

const ArgumentInputs = ({
  inputs,
  inputState,
  setInputState,
}: {
  inputs: any[];
  inputState: any[];
  setInputState: any;
}) => {
  return (
    <div>
      {inputs.map((input: any, i: number) => {
        const value = inputState[i];
        const setValue = (getInputValue: any) => {
          // probably something like setValue on args for the given function
          setInputState((currentState: any) => {
            const currentInputValue = currentState[i];
            const nextState = [...currentState];
            nextState[i] =
              typeof getInputValue === "function"
                ? getInputValue(currentInputValue)
                : getInputValue;
            return nextState;
          });
        };

        return (
          <Fragment key={input.name}>
            {renderInput(input, value, setValue)}
          </Fragment>
        );
      })}
    </div>
  );
};

const renderInput = (input: any, inputValue: any, setInputValue: any) => {
  const labelContent =
    input.name == null ? null : (
      <span>
        <span>{input.internalType ?? input.type}</span> {input.name}
      </span>
    );

  const isArray = input.type.slice(-2) === "[]";

  if (isArray) {
    const elementType = input.type.slice(0, -2);
    const defaultValue = input.components != null ? {} : "";
    return (
      <div key={input.name} data-input>
        {labelContent != null && <label>{labelContent}</label>}
        <div>
          {(inputValue ?? []).map((elementValue: any, elementIndex: number) => {
            const setElementValue = (getElementValue: any) => {
              setInputValue((currentInputValue: any) => {
                const nextElementValue =
                  typeof getElementValue === "function"
                    ? getElementValue(elementValue)
                    : getElementValue;
                const nextInputValue = [...currentInputValue];
                nextInputValue[elementIndex] = nextElementValue;
                return nextInputValue;
              });
            };

            return (
              <Fragment key={elementIndex}>
                {renderInput(
                  {
                    components: input.components,
                    type: elementType,
                    remove: () =>
                      setInputValue((els: any) =>
                        els.filter((_: any, i: number) => i !== elementIndex)
                      ),
                  },
                  elementValue,
                  setElementValue
                )}
              </Fragment>
            );
          })}

          <div>
            <button
              type="button"
              onClick={() => {
                setInputValue((els = []) => [...els, defaultValue]);
              }}
            >
              Add element
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (input.components != null)
    return (
      <div key={input.name} data-input>
        {labelContent != null && <label>{labelContent}</label>}
        {/* <div>
          <div>
            {input.components.map((c) => {
              const componentValue = inputValue?.[c.name] ?? "";
              const setComponentValue = (getComponentValue) => {
                setInputValue((currentInputValue) => {
                  const currentComponentValue = currentInputValue?.[c.name];
                  const nextComponentValue =
                    typeof getComponentValue === "function"
                      ? getComponentValue(currentComponentValue)
                      : getComponentValue;
                  return {
                    ...currentInputValue,
                    [c.name]: nextComponentValue,
                  };
                });
              };

              return (
                <Fragment key={c.name}>
                  {renderInput(c, componentValue, setComponentValue)}
                </Fragment>
              );
            })}
          </div>
          {input.remove != null && (
            <button type="button" onClick={input.remove}>
              Remove
            </button>
          )}
        </div> */}
      </div>
    );

  const renderIndividualInput = () => {
    const simplifiedType = simplifyType(input.type);

    switch (simplifiedType) {
      case "bool":
        return (
          <div>
            <label>{labelContent}</label>
            <select
              value={inputValue}
              onChange={(value) => {
                setInputValue(value);
              }}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
        );

      case "number": {
        const isUnsigned = input.type.startsWith("u");
        const max = getNumberTypeMax(input.type);
        const min = isUnsigned ? 0n : max * -1n;

        return (
          <div className="flex flex-col">
            <label>{labelContent}</label>
            <input
              className="p-1 border"
              type="number"
              min={min.toString()}
              max={max.toString()}
              value={inputValue.toString?.() ?? inputValue}
              onChange={(e) => {
                try {
                  const n = BigInt(e.target.value);
                  const truncatedN = n > max ? max : n < min ? min : n;
                  setInputValue(truncatedN.toString());
                } catch (e) {
                  // Ignore
                }
              }}
              //   placeholder={getArgumentInputPlaceholder(input.type)}
            />
          </div>
        );
      }

      case "address":
        return (
          <div className="flex flex-col">
            <label>{labelContent}</label>
            <input
              type="text"
              value={inputValue}
              onChange={(maybeAddress) => {
                setInputValue(maybeAddress);
              }}
              //   placeholder={getArgumentInputPlaceholder(input.type)}
            />
          </div>
        );

      default:
        return (
          <div className="flex flex-col">
            <label>{labelContent}</label>
            <input
              className="border p-1"
              value={inputValue}
              // placeholder={getArgumentInputPlaceholder(input.type)}
              onChange={(e) => {
                setInputValue(e.target.value);
              }}
            />
          </div>
        );
    }
  };

  return input.remove == null ? (
    renderIndividualInput()
  ) : (
    <div>
      <div>{renderIndividualInput()}</div>
      {input.remove != null && (
        <button type="button" onClick={input.remove}>
          Remove
        </button>
      )}
    </div>
  );
};

const simplifyType = (type: string) =>
  type.startsWith("int") || type.startsWith("uint") ? "number" : type;

const buildInitialInputState = (inputs = []) => {
  const buildInputState = (input: any) => {
    const isArray = input.type.slice(-2) === "[]";

    if (isArray) return [];

    if (input.components != null) {
      return input.components.reduce(
        (obj: any, c: any) => ({
          ...obj,
          [c.name]: buildInputState(c),
        }),
        {}
      );
    }

    switch (simplifyType(input.type)) {
      case "bool":
        return null;
      default:
        return "";
    }
  };

  return inputs.map(buildInputState);
};

const getNumberTypeMax = (type: string) => {
  const isUnsigned = type.startsWith("u");
  const numberOfBits = BigInt(type.split("int").slice(-1)[0]);
  const signedMax = 2n ** (numberOfBits - 1n) - 1n;
  return isUnsigned ? signedMax + 1n : signedMax;
};

const isFunctionAbiItem = (item: any) => {
  if (item.type !== "function") return false;
  if (item.stateMutability != null)
    return ["payable", "nonpayable"].includes(item.stateMutability);
  if (item.constant != null) return !item.constant;
  return !item.pure || !item.view;
};

const createSignature = (functionAbiItem: any) =>
  `${functionAbiItem.name}(${
    functionAbiItem.inputs?.map((i: any) => i.type).join(",") ?? ""
  })`;

const CustomTransactionForm = () => {
  const { etherscanApiKey } = useGovKitContext();
  const [contractData, setContractData] = useState<ContractInfo>();

  const methods = useFormContext();

  //   const { fields, append, remove } = useFieldArray({
  //     control: methods.control,
  //     name: "args",
  //   });

  const watch = methods.watch;
  const signature = watch("signature");
  const ethValue = watch("ethValue");
  const args = watch("args");

  const fetchContractData = async (contractAddress: string) => {
    if (!isAddress(contractAddress)) return;

    const contractInfo = await getContractInfo(
      contractAddress,
      etherscanApiKey
    );
    if (contractInfo === "Error") return;

    setContractData(contractInfo);
  };

  const saveAbi = (abi: any) => {
    const formattedAbi = JSON.stringify(abi, null, 2);
    methods.setValue("abi", formattedAbi);
  };

  const fetchedAbi =
    contractData?.abi == null
      ? null
      : [...contractData.abi, ...(contractData.implementationAbi ?? [])];

  saveAbi(fetchedAbi);

  const contractName = contractData?.name;

  const contractCallAbiItemOptions =
    fetchedAbi?.filter(isFunctionAbiItem).map((item) => {
      const signature = createSignature(item);

      const label = (
        <span>
          {item.name}(
          <span>
            {item.inputs.map((input: any, i: number) => (
              <Fragment key={i}>
                {i !== 0 && <>, </>}
                {input.internalType ?? input.type}
                {input.name != null && (
                  <>
                    {" "}
                    <span>{input.name}</span>
                  </>
                )}
              </Fragment>
            ))}
          </span>
          )
        </span>
      );

      return {
        value: signature,
        label,
        textValue: item.name,
        abiItem: item,
        signature,
      };
    }) || [];

  const selectedContractCallAbiItem = contractCallAbiItemOptions?.find(
    (o) => o.signature === signature
  )?.abiItem;

  const isPayableContractCall =
    selectedContractCallAbiItem?.payable ??
    selectedContractCallAbiItem?.stateMutability === "payable";

  return (
    <div className="flex flex-col space-y-4">
      <div>
        <p>
          Helpful contract info for copy pasting...
          0x6f3E6272A167e8AcCb32072d08E0957F9c79223d
        </p>
      </div>
      <div className="flex flex-col">
        <label className="text-sm font-bold text-neutral-500 mb-1 ml-1">
          Contract address
        </label>
        <Controller
          control={methods.control}
          name="target"
          render={({ field: { onChange } }) => (
            <input
              onChange={(e: any) => {
                onChange(e);
                fetchContractData(e.target.value);
              }}
              className="border p-1"
            />
          )}
        />
        {contractCallAbiItemOptions?.length > 0 ? (
          <div className="mt-4">
            <label className="text-sm font-bold text-neutral-500 mb-1 ml-1">
              Function to call
            </label>
            <Controller
              control={methods.control}
              name="signature"
              render={({ field: { onChange } }) => (
                <select
                  className="border p-1 w-full"
                  onChange={(e: any) => {
                    onChange(e);
                    const targetOption = contractCallAbiItemOptions?.find(
                      (o) => o.signature === e.target.value
                    );
                    const args = buildInitialInputState(
                      targetOption?.abiItem.inputs
                    );
                    methods.setValue("args", args);
                  }}
                >
                  {contractCallAbiItemOptions.map((option, i) => (
                    <option value={option.value} key={`option-${i}`}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
        ) : null}

        <>
          {selectedContractCallAbiItem != null &&
            selectedContractCallAbiItem.inputs.length > 0 && (
              <div className="mt-4">
                <label className="text-sm font-bold text-neutral-500 mb-1 ml-1">
                  Arguments
                </label>
                <ArgumentInputs
                  inputs={selectedContractCallAbiItem.inputs}
                  inputState={args}
                  setInputState={(as: any) => {
                    const newValue = typeof as === "function" ? as(args) : as;
                    methods.setValue("args", newValue);
                  }}
                />
              </div>
            )}
        </>
        {isPayableContractCall && (
          <div>
            <label className="text-sm font-bold text-neutral-500 mb-1 ml-1">
              Value
            </label>
            <input type="number" {...methods.register("ethValue")} />
            hint=
            {["", "0"].includes(ethValue) ? (
              <>&nbsp;</>
            ) : (
              <>{parseUnits(ethValue, 18).toString()} WEI</>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomTransactionForm;
