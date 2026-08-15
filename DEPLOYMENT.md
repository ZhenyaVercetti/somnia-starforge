# DEPLOYMENT.md
**Актуально на 15 августа 2026 — единственный источник правды по адресам**

Testnet: Chain ID **50312**, RPC `https://dream-rpc.somnia.network`

## Актуальные адреса (testnet)

- **StarForgeUnitNFT**: `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1`
- **StarForgeRelic**: `0x619e19df1975A8D289545834aAff3FEEf1b84909`
- **StarForgePlayerProfile**: `0x2C8976ECc9e9bDf939745ee61b1aD858607563d9`
- **StarForgeGame** (новый): `0x2087baAb3Ee7456E6B3100A58BAc7144662ea3fF` ← **актуальный**
  - Shadow Fleet (ИИ всегда 8), Variant 1 battle events (emit)
  - anti-abuse daily 10 + free ship за level-up
  - Last Stand 1 раз, unique team/relics, previousGame = old Game

## Предыдущий Game

- `0x227cF27Ec12c1cCBfE536f10AE1f765DEfA8cb8a` — снят с NFT/Relic/Profile GAME_ROLE

## Порядок деплоя и связывания контрактов

**При деплое нового StarForgeGame:**

1. Деплоим **НОВЫЙ** `StarForgeGame` с параметрами:
   - `_unitNFT` = `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1`
   - `_relic` = `0x619e19df1975A8D289545834aAff3FEEf1b84909`
   - `_playerProfile` = `0x2C8976ECc9e9bDf939745ee61b1aD858607563d9`

2. После деплоя выполняем:

```solidity
StarForgeUnitNFT.setGameContract(0x2087baAb3Ee7456E6B3100A58BAc7144662ea3fF)
StarForgeRelic.setGameContract(0x2087baAb3Ee7456E6B3100A58BAc7144662ea3fF)
StarForgePlayerProfile.setGameContract(0x2087baAb3Ee7456E6B3100A58BAc7144662ea3fF)
StarForgeGame.setPreviousGame(0x227cF27Ec12c1cCBfE536f10AE1f765DEfA8cb8a)
```
