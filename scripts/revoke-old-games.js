const hre = require("hardhat");

const PROFILE = "0x2C8976ECc9e9bDf939745ee61b1aD858607563d9";
const CURRENT_GAME = "0x4628FC45cb2f28A198A4ebF1491791b2E12D92DA";
const OLD_GAMES = [
  "0x05bcfA66B38259ea33B6986C1f04F028f0129a9F",
  "0xB0768AE07a84F8172424ED331c80525D1B4564de"
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const profile = await hre.ethers.getContractAt("StarForgePlayerProfile", PROFILE, signer);
  const GAME_ROLE = hre.ethers.id("GAME_ROLE");

  console.log(`Signer: ${signer.address}`);
  console.log(`Keep GAME_ROLE on ${CURRENT_GAME}: ${await profile.hasRole(GAME_ROLE, CURRENT_GAME)}`);

  for (const oldGame of OLD_GAMES) {
    const address = hre.ethers.getAddress(oldGame.toLowerCase());
    const hasRole = await profile.hasRole(GAME_ROLE, address);
    console.log(`${address} has GAME_ROLE: ${hasRole}`);
    if (!hasRole) {
      continue;
    }
    const tx = await profile.revokeRole(GAME_ROLE, address);
    console.log(`  revoke tx ${tx.hash}`);
    const receipt = await tx.wait();
    if (receipt.status !== 1) {
      throw new Error(`revokeRole failed for ${address}`);
    }
    console.log(`  OK revoked ${address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
