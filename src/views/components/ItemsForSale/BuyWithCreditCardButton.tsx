import { encodeFunctionData, SendTransactionErrorType, toHex } from "viem";
import {
  usePublicClient,
  useWalletClient,
  useAccount,
  // useReadContract,
  useSendTransaction,
  // useSwitchChain,
} from "wagmi";
import { ERC20 } from "../../../ERC20/ERC20";

import { SALES_CONTRACT_ABI } from "../../constants/abi";
import { useSalesCurrency } from "../../hooks/useSalesCurrency";
import { useEffect, useState } from "react";
import { getChain } from "../../../ERC20/getChain";
import { getSalesContractAddress } from "../../../utils/primarySellHelpers";
import { toast } from "react-toastify";
import {
  erc20TokenDecimals,
  nativeTokenDecimals,
  nftPrice,
} from "../../constants";
interface BuyWithCryptoCardButtonProps {
  tokenId: string;
  collectionAddress: string;
  chainId: number;
  amount: number;
  resetAmount: () => void;
  setTxExplorerUrl: (url: string) => void;
  setTxError: (error: SendTransactionErrorType | null) => void;
}

export const BuyWithCryptoCardButton = ({
  tokenId,
  // collectionAddress,
  chainId,
  amount,
  resetAmount,
  setTxExplorerUrl,
  setTxError,
}: BuyWithCryptoCardButtonProps) => {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const {
    address: userAddress,
    // chainId: chainIdUser
  } = useAccount();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const [chainInfo, setChainInfo] = useState<{ [key: string]: any }>({});
  const {
    data: txnData,
    sendTransaction,
    isPending: isPendingSendTxn,
    error,
    reset,
  } = useSendTransaction();
  const {
    data: currencyData,
    // isLoading: currencyIsLoading
  } = useSalesCurrency(chainId);

  const onClickBuy = async () => {
    if (
      !publicClient ||
      !walletClient ||
      !userAddress ||
      !currencyData ||
      isPendingSendTxn ||
      amount <= 0
    ) {
      return;
    }

    /**
     * Mint tokens.
     * @param to Address to mint tokens to.
     * @param tokenIds Token IDs to mint.
     * @param amounts Amounts of tokens to mint.
     * @param data Data to pass if receiver is contract.
     * @param expectedPaymentToken ERC20 token address to accept payment in. address(0) indicates ETH.
     * @param maxTotal Maximum amount of payment tokens.
     * @param proof Merkle proof for allowlist minting.
     * @notice Sale must be active for all tokens.
     * @dev tokenIds must be sorted ascending without duplicates.
     * @dev An empty proof is supplied when no proof is required.
     */

    const tokenDecimals: number =
      currencyData.address == "0x0000000000000000000000000000000000000000"
        ? nativeTokenDecimals
        : erc20TokenDecimals;
    const nftPriceBigInt = BigInt(nftPrice * 10 ** tokenDecimals);
    const amountBigInt = BigInt(amount);
    const totalPrice = nftPriceBigInt * amountBigInt;
    setTxError(null);
    setTxExplorerUrl("");
    const allowance = await ERC20.getAllowance(
      currencyData.address,
      userAddress,
      getSalesContractAddress(chainId),
      chainId,
    );

    if (!allowance || allowance === 0n) {
      await ERC20.approveInfinite(
        currencyData.address,
        getSalesContractAddress(chainId),
        walletClient,
      );
    }

    const calldata = encodeFunctionData({
      abi: SALES_CONTRACT_ABI,
      functionName: "mint",
      args: [
        userAddress,
        [BigInt(tokenId)],
        // Amount of nfts that are going to be purchased
        [BigInt(amount)],
        toHex(0),
        currencyData.address,
        // Here the exact price of the NFTs must be established (USDC = 6 decimals) (Native currency = 18 decimals)
        totalPrice,
        [toHex(0, { size: 32 })],
      ],
    });

    const transactionParameters = {
      to: getSalesContractAddress(chainId),
      data: calldata,
      value: BigInt(0),
    };

    sendTransaction(transactionParameters);
  };

  useEffect(() => {
    if (!chainId) return;
    reset();
    const chainInfoResponse = getChain(chainId);
    if (chainInfoResponse) {
      setChainInfo(chainInfoResponse);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [chainId]);

  useEffect(() => {
    if (!error) return;
    setTxError(error as SendTransactionErrorType);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [error]);

  useEffect(() => {
    if (!txnData) return;
    resetAmount();
    toast(
      <div>
        Purchase Completed Successfully.{" "}
        <a
          href={`${chainInfo.explorerUrl}/tx/${txnData}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "rgba(32, 129, 226, 1)",
            textDecoration: "underline",
          }}
        >
          View transaction in explorer
        </a>
      </div>,
    );
    setTxExplorerUrl(`${chainInfo.explorerUrl}/tx/${txnData}`);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [txnData]);

  return (
    <>
      <button
        style={{
          backgroundColor: "rgba(32, 129, 226, 1)",
          padding: "12px 6px",
          borderRadius: "0.75rem",
          width: "100%",
          transition: "background-color 0.3s ease",
          border: "none",
          outline: "none",
        }}
        onMouseOver={(e) =>
          (e.currentTarget.style.backgroundColor = "rgba(25, 100, 176, 1)")
        }
        onMouseOut={(e) =>
          (e.currentTarget.style.backgroundColor = "rgba(32, 129, 226, 1)")
        }
        onClick={onClickBuy}
      >
        {!isPendingSendTxn ? "Purchase" : "Purchasing..."}
      </button>
    </>
  );
};
