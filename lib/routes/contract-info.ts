import { ContractInfo } from "../types";

const etherscanRequest = (query: Record<any, any>, etherscanApiKey: string) => {
  const searchParams = new URLSearchParams({ chainid: "1", ...query });
  return new Request(
    `https://api.etherscan.io/v2/api?apikey=${etherscanApiKey}&${searchParams}`
  );
};

const contractInfoCache = new Map();

const fetchAbi = async (address: `0x${string}`, etherscanApiKey: string) => {
  const response = await fetch(
    etherscanRequest(
      {
        module: "contract",
        action: "getabi",
        address,
      },
      etherscanApiKey
    )
  );

  const responseBody = await response.json();

  if (responseBody.status !== "1") {
    const error = new Error();
    // @ts-ignore
    error.code = "implementation-abi-not-found";
    return Promise.reject(error);
  }

  return JSON.parse(responseBody.result);
};

const fetchContractInfo = async (
  address_: `0x${string}`,
  etherscanApiKey: string
) => {
  const address = address_.toLowerCase();

  if (contractInfoCache.has(address)) return contractInfoCache.get(address);

  const response = await fetch(
    etherscanRequest(
      {
        module: "contract",
        action: "getsourcecode",
        address,
      },
      etherscanApiKey
    )
  );

  const responseBody = await response.json();
  if (responseBody.status !== "1" || responseBody.result.length === 0)
    throw new Error();

  if (responseBody.result[0]["SourceCode"] === "") {
    const error = new Error();
    // @ts-ignore
    error.code = "contract-address-required";
    return Promise.reject(error);
  }

  if (responseBody.result[0]["ABI"] === "Contract source code not verified") {
    const error = new Error();
    // @ts-ignore
    error.code = "source-code-not-verified";
    return Promise.reject(error);
  }

  const contractInfo = {
    name: responseBody.result[0]["ContractName"],
    abi: JSON.parse(responseBody.result[0]["ABI"]),
    isProxy: responseBody.result[0]["Proxy"] === "1",
  } as ContractInfo;

  if (contractInfo.isProxy) {
    const implementationAddress = responseBody.result[0]["Implementation"];
    contractInfo.implementationAddress = implementationAddress;
    contractInfo.implementationAbi = await fetchAbi(
      implementationAddress,
      etherscanApiKey
    );
  }

  contractInfoCache.set(address, contractInfo);

  return contractInfo;
};

export const getContractInfo = async (
  address: `0x${string}`,
  etherscanApiKey: string
) => {
  try {
    const contractInfo = (await fetchContractInfo(
      address,
      etherscanApiKey
    )) as ContractInfo;
    return contractInfo;
  } catch (e) {
    console.log(e);
    return "Error";
  }
};
