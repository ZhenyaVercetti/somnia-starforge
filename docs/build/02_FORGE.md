# Feed 2 — Foundry. Do not start until client v2 is accepted.

Branch `forge` from accepted `client-v2`. Do not edit `StarForgeBattleLibrary.sol`. Do not change `startMatch` logic, event layout, or combat math.

## Contracts

New `contracts/StarForgeFoundry.sol`. Dust is `mapping(address => uint32)` inside Foundry. Not a token. Not sold for native.

`StarForgeUnitNFT` and `StarForgeRelic` currently allow a single `gameContract`. Add a second role, `FOUNDRY_ROLE`, without removing the game mint path. Game keeps battle mints. Foundry mints ascend output and burns salvage input. Burning a soulbound token must be an explicit `burnFromGame` / `burnFromFoundry` on the NFT. Do not enable transfers.

Ascend and reforge write events: token ids in, token id out, parent ids, new stats. Reforge keeps the same token id and rarity.

Rules:

- Salvage from account level 2. Dust: Common 1, Rare 4, Legendary 12.
- Reforge from level 4. Reroll attack, defense, speed inside the current rarity band. Costs 4 dust.
- Ascend: 3 owned ships, same class, faction, rarity. Common to Rare from level 4 and 6 dust. Rare to Legendary from level 10 and 18 dust. Inputs burned. No rarity above Legendary.
- Name once on Legendary, 3–18 bytes, ASCII letters and space. Costs nothing but level 10.
- Legendary salvage in the client requires a second confirm. Contract still allows it.

Deploy new Foundry only. Do not redeploy Game. After deploy, owner calls the new role setter on NFT and Relic. Put the new address in `DEPLOYMENT.md`. Leave existing Game, NFT, Relic, Profile addresses in place.

Bind reminder: Foundry is not a new Game. Do not call `setGameContract` with the Foundry address. That would steal mint rights from the live Game.

## Client

On `frontend-v2` only. Screen `/foundry`: owned hulls, salvage, reforge, ascend, name. Hall of 12 niches: one Legendary per faction and class. Duplicate stays in the hold. Errors show the revert.

Reads and writes for the existing shop and `startMatch` stay on the old ABI. Foundry has its own ABI file.

## Done when

- Three Commons of one class and faction become one Rare with three parents in the event.
- Reforge does not change token id or rarity.
- Below the level gate the call reverts.
- `startMatch` bytecode and battle events are unchanged.
- `npm run build` in `frontend-v2` succeeds.

Do not build Echo in this feed.
