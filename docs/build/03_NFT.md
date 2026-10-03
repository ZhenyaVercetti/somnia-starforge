# Feed 3 — NFT metadata and tradable Echo. Do not start until Foundry is on testnet.

Branch `nft-echo` from accepted `forge`. Do not edit the battle library or `startMatch`.

## Combat tokens

Ships stay non-transferable. Mark them ERC-5192: `locked(tokenId)` always true, emit `Locked` on mint. Relics stay ERC-1155 amount 1, transfers revert.

`tokenURI` must be a real metadata JSON, not a text rectangle. On-chain traits are the source: faction, class, rarity, attack, defense, speed, forge seed, name. Image and `animation_url` are renders exported by `frontend-v2` into immutable storage. URI stores the CID. If upload is unavailable, generate an on-chain SVG of the mesh silhouette, never the old portrait PNG.

Relic `uri(id)` returns type, value, and name, plus an image. Empty uri is not acceptable.

## Tradable Echo

New ERC-721 `StarForgeEcho`. Transfers enabled. ERC-2981 royalty to the treasury address recorded in `DEPLOYMENT.md`. No attack, defense, or speed fields. Battle, Foundry combat reads, and the battle library must not reference this contract.

Mint only from Foundry, one per qualifying action:

- First named Legendary of a hull: edition 1/1, parents included.
- Faction set, 4 Rare+ different classes: one set Echo, fixed cap stored in Foundry.
- Hall of 12: one Echo per account.

A second call for the same action reverts. Selling an Echo does not move the soulbound hull.

No in-game marketplace. No public sale. No dust-for-native. Blueprint and faction banner are out of scope.

## Client

Collection shows combat tokens and Echoes separately. Echo card has no stats and a transfer-open badge. Combat card has a locked badge. Clicking an Echo opens the metadata URI.

## Done when

- A wallet sees combat metadata and a locked flag.
- An Echo from a named Legendary transfers to another address. The hull does not.
- `startMatch` still ignores Echo.
- New Echo address is in `DEPLOYMENT.md`.
- `npm run build` in `frontend-v2` succeeds.
