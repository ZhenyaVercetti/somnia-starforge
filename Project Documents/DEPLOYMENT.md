# DEPLOYMENT.md
**Актуально на 29 апреля 2026 — единственный источник правды по адресам**

## Актуальные адреса (testnet)

- **StarForgeUnitNFT**: `0x9D00dB7fb6faF315C9c63971ae34380d5b831a56`
- **StarForgeGame**: `0x52C428Ec735ef6fEb46334E626600ec31120cC80`   ← **актуальный**
- **StarForgeRelic**: `0x83930224Ced8cEB6350fC9F41202B8fAA0033173`

## Порядок обновления контрактов

**При обновлении StarForgeGame.sol:**
1. Деплоим **НОВЫЙ** StarForgeGame с параметром `_unitNFT = 0x9D00dB7fb6faF315C9c63971ae34380d5b831a56`
2. В StarForgeUnitNFT вызываем `setGameContract(новый_адрес_Game)`
3. В новом StarForgeGame вызываем `setRelicContract(0x83930224Ced8cEB6350fC9F41202B8fAA0033173)`
4. В Relic вызываем `setGameContract(новый_адрес_StarForgeGame)`

**При обновлении StarForgeRelic.sol:**
1. Деплоим **НОВЫЙ** StarForgeRelic
2. В новом Relic вызываем `setGameContract(текущий_адрес_StarForgeGame)`
3. В текущем StarForgeGame вызываем `setRelicContract(новый_адрес_Relic)`

## RPC и Chain ID
- Testnet RPC: `https://dream-rpc.somnia.network`
- Chain ID: `50312`