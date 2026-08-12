# DEPLOYMENT.md
**Актуально на 13 августа 2026 — единственный источник правды по адресам**

## Актуальные адреса (testnet)

- **StarForgeUnitNFT**: `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1`
- **StarForgeRelic**: `0x619e19df1975A8D289545834aAff3FEEf1b84909`
- **StarForgePlayerProfile**: `0x2C8976ECc9e9bDf939745ee61b1aD858607563d9`
- **StarForgeGame** (новый): `0xcc51dbf77d96b477485122BA2F6Ee6beBBA21B88` ← **актуальный**

## Порядок деплоя и связывания контрактов

**При деплое нового StarForgeGame:**

1. Деплоим **НОВЫЙ** `StarForgeGame` с параметрами:
   - `_unitNFT` = `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1`
   - `_relic` = `0x619e19df1975A8D289545834aAff3FEEf1b84909`
   - `_playerProfile` = `0x2C8976ECc9e9bDf939745ee61b1aD858607563d9`

2. После деплоя выполняем:

```solidity
// 1. NFT → новый Game
StarForgeUnitNFT.setGameContract(0xcc51dbf77d96b477485122BA2F6Ee6beBBA21B88)

// 2. Relic → новый Game
StarForgeRelic.setGameContract(0xcc51dbf77d96b477485122BA2F6Ee6beBBA21B88)

// 3. PlayerProfile → новый Game
StarForgePlayerProfile.setGameContract(0xcc51dbf77d96b477485122BA2F6Ee6beBBA21B88)
```
