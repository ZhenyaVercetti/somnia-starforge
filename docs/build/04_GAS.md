# Feed 4 — battle gas, optional. Do not start until client v2 replay is accepted.

Possible next stage after feed 1. Not required for forge or Echo. Do not feed this file together with feed 1.

Branch `gas-battle` from the accepted client branch. Battle resolution stays inside `startMatch`. The client only replays what the contract emits. Do not move the fight off-chain. Do not add VRF.

## Measure first

Before editing combat code, read one real `startMatch` receipt on Shannon. Record `gasUsed`, not the 12_000_000 client floor. Split the receipt into log gas, `lastAI` writes, HP array writes, and a level-up mint if one fired. The task is done only if the new receipt is lower and the winner matches the old library on a fixed fixture.

Somnia charges logs and cold storage far above Ethereum. A hit log with two topics and about 224 bytes of data is on the order of 49,000 gas. Fifteen to forty hits is about 0.7–2.0M gas in logs alone. A new storage slot is 200,000 gas. An existing slot outside the recent-access window is 1,000,000. Keccak is about 40x Ethereum. At about 3.33 gwei, 12M gas is about 0.04 SOMI. The win is the gas limit and cold writes, not alpha revenue.

## Contract changes

Keep `_simulateBattle` as the source of winner, damage, remaining HP, and effect codes. Crit = 1, Dodge = 2, Last Stand = 3. Do not change damage math, Shadow Fleet, round cap, or team rules.

Replace per-hit `BattleEventEmitted` with packed logs. One 32-byte word per hit: round, side, attacker index, target index, damage, remaining HP, effect. One log per round, or one log for the whole battle if it fits. Index only `battleId`. `BattleResolved` stays, but HP arrays are not also written to storage.

Stop writing `lastAI` on every match. The shadow team must be recoverable from the stored seed and `battleId`. Store that seed on the summary. Drop `playerFinalHp` and `aiFinalHp` from `BattleSummary` storage. The event is enough.

Remove `_grantPendingLevelUpShips` from `startMatch`. Level-up hulls stay on `claimLevelUpShips` only.

Read team stats once into memory. Do not hash the same seed twice.

## Deploy

This is a new Game. Do not redeploy NFT, Relic, or Profile.

1. Deploy a new `StarForgeGame` with `_unitNFT` = current UnitNFT, `_relic` = current Relic, `_playerProfile` = current Profile, `_previousGame` = current Game.
2. `StarForgeUnitNFT.setGameContract(new Game)`.
3. `StarForgeRelic.setGameContract(new Game)`.
4. `StarForgePlayerProfile.setGameContract(new Game)`.
5. Do not pass Foundry to `setGameContract`. That steals mint rights from Game.
6. Write the new Game address in `DEPLOYMENT.md`. Old Game loses `GAME_ROLE`.

Addresses before this feed are only in `DEPLOYMENT.md`.

## Client

Update `frontend-v2` only. Decode the packed log back into the existing `BattleEvent` shape. Preview battle and a wallet `startMatch` must show the same beats: crit, dodge, last stand, kill. Legacy `frontend/` may stay on the old event until it is retired. Do not import Phaser into v2.

## Done when

- A fixture battle has the same winner and the same hit list as the old library.
- Shannon `gasUsed` is lower than the measured baseline. Log the before and after numbers in the PR.
- No `lastAI` write and no HP array write in the new receipt.
- A level-up does not mint inside `startMatch`.
- `npm run build` in `frontend-v2` succeeds.

Do not change forge, Echo, or add combat effects in this feed.
