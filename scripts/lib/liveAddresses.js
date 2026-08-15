const fs = require("fs");
const path = require("path");

function readFrontendAddresses() {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", "frontend", "src", "lib", "contractAddresses.ts"),
    "utf8"
  );
  const grab = (name) => {
    const match = source.match(new RegExp(`${name} = '([^']+)'`));
    if (!match) {
      throw new Error(`Missing ${name} in frontend/src/lib/contractAddresses.ts`);
    }
    return match[1];
  };
  return {
    game: grab("GAME_ADDRESS"),
    nft: grab("NFT_ADDRESS"),
    relic: grab("RELIC_ADDRESS"),
    profile: grab("PLAYER_PROFILE_ADDRESS")
  };
}

module.exports = { readFrontendAddresses };
