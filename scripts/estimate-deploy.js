const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const Lib = await hre.ethers.getContractFactory("StarForgeBattleLibrary");
  const libTx = await Lib.getDeployTransaction();
  const libGas = await hre.ethers.provider.estimateGas({ from: signer.address, data: libTx.data });

  const Factory = await hre.ethers.getContractFactory("StarForgeGame", {
    libraries: {
      StarForgeBattleLibrary: "0x0000000000000000000000000000000000000001"
    }
  });
  const nft = "0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1";
  const relic = "0x619e19df1975A8D289545834aAff3FEEf1b84909";
  const profile = "0x2C8976ECc9e9bDf939745ee61b1aD858607563d9";

  const tx = await Factory.getDeployTransaction(nft, relic, profile);
  const gas = await hre.ethers.provider.estimateGas({
    from: signer.address,
    data: tx.data
  });
  const fee = await hre.ethers.provider.getFeeData();
  const price = fee.gasPrice || fee.maxFeePerGas || 1n;
  const cost = (libGas + gas) * price;
  console.log(`Library estimate gas: ${libGas}`);
  const balance = await hre.ethers.provider.getBalance(signer.address);

  console.log(`Deployer: ${signer.address}`);
  console.log(`Estimate gas: ${gas}`);
  console.log(`Gas price: ${price}`);
  console.log(`Estimate cost: ${hre.ethers.formatEther(cost)}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)}`);
  console.log(`Shortfall: ${cost > balance ? hre.ethers.formatEther(cost - balance) : "0"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
