# DEPLOYMENT.md
**Актуально на 17 августа 2026 — единственный источник правды по адресам**

Testnet: Chain ID **50312**, RPC `https://dream-rpc.somnia.network`

## Актуальные адреса (testnet)

- **StarForgeUnitNFT**: `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1`
- **StarForgeRelic**: `0x619e19df1975A8D289545834aAff3FEEf1b84909`
- **StarForgePlayerProfile**: `0x2C8976ECc9e9bDf939745ee61b1aD858607563d9`
- **StarForgeGame** (новый): `0x064fE7661b1eb52b727e562E652764b94c008383` ← **актуальный**
  - Shadow Fleet (ИИ всегда 8), Variant 1 battle events (emit)
  - anti-abuse daily 10 + free ship за level-up
  - Last Stand 1 раз, unique team/relics, previousGame = old Game
  - EOA-only: `buyUnit` / `generateTenShips` / `buyFromShop` / `startMatch`
  - `startMatch` пишет экип реликвий в storage

## Предыдущие Game (GAME_ROLE снят)

- `0x6DE0834950Ed5f4d13E90A5EA049d43a3Ade9118` — previousGame текущего
- `0xdFc7e27F2ABbA61Ea8aB65e3C6bC1454c8060aAd`
- `0x0F6BC3846c64743aCC109C489366fDc26658A324`

Полный список для revoke: `scripts/lib/previousGames.js`.

## Порядок деплоя и связывания контрактов

**При деплое нового StarForgeGame:**

1. Деплоим **НОВЫЙ** `StarForgeGame` с параметрами:
   - `_unitNFT` = `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1`
   - `_relic` = `0x619e19df1975A8D289545834aAff3FEEf1b84909`
   - `_playerProfile` = `0x2C8976ECc9e9bDf939745ee61b1aD858607563d9`
   - `_previousGame` = `0x064fE7661b1eb52b727e562E652764b94c008383`

2. После деплоя выполняем:

```solidity
StarForgeUnitNFT.setGameContract(<NEW>)
StarForgeRelic.setGameContract(<NEW>)
StarForgePlayerProfile.setGameContract(<NEW>)
StarForgeGame constructor previousGame = 0x064fE7661b1eb52b727e562E652764b94c008383
```

Команда: `npx hardhat run scripts/deploy.js --network somniaTestnet`

Порядок bind в скрипте: Relic → Profile → revoke `GAME_ROLE` со старых Game → NFT last.

Live verify 17.08: wiring OK, все старые GAME_ROLE сняты. Smoke `startMatch` `0x9b1758bf…` (10 events).
