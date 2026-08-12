const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const game = await hre.ethers.getContractAt(
    "StarForgeGame",
    "0x4628FC45cb2f28A198A4ebF1491791b2E12D92DA",
    signer
  );
  const units = [...await game.getPlayerUnits(signer.address)];
  const fee = await hre.ethers.provider.getFeeData();
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log("units", units.length);
  console.log("balance", hre.ethers.formatEther(balance));
  console.log("gasPrice", fee.gasPrice?.toString());
  console.log("maxFee", fee.maxFeePerGas?.toString());
  console.log("maxPrio", fee.maxPriorityFeePerGas?.toString());

  const gas = await game.startMatch.estimateGas(units.slice(0, 4), []);
  console.log("startMatch gas", gas.toString());
  const price = fee.maxFeePerGas || fee.gasPrice || 1n;
  console.log("worst cost", hre.ethers.formatEther(gas * price));
}

main().catch((error) => {
  console.error(error.shortMessage || error.message || error);
  process.exitCode = 1;
});
