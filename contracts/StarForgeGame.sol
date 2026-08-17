// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./StarForgeBattleLibrary.sol";
import "./StarForgeUnitNFT.sol";
import "./StarForgeRelic.sol";
import "./StarForgePlayerProfile.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract StarForgeGame is Ownable, ReentrancyGuard, Pausable {
    // ==================== STORAGE ====================

    mapping(address => uint256[3]) public equippedRelics;
    mapping(address => ShopItem[3]) public playerShop;
    mapping(address => ShopItem[8]) public lastAI;

    struct BattleSummary {
        bool playerWon;
        uint16[] playerFinalHp;
        uint16[] aiFinalHp;
        bytes32 battleId;
        uint64 timestamp;
    }

    mapping(address => BattleSummary) public lastBattleSummary;
    mapping(address => uint16) public freeShipsGranted;
    address public previousGame;

    uint256 public constant DAILY_PAID_BUY_LIMIT = 10;

    // ==================== PRICES ====================

    uint256 public buyUnitPrice = 0.01 ether;
    uint256 public rerollPrice = 0.005 ether;
    uint256 public buyRelicShopPrice = 0.008 ether;

    event PricesUpdated(uint256 buyUnit, uint256 reroll, uint256 buyRelicShop);
    event BattleResolved(bytes32 indexed battleId, address indexed player, bool playerWon, uint16[] playerMaxHp, uint16[] aiMaxHp);
    event BattleEventEmitted(bytes32 indexed battleId, uint8 round, bool isPlayerSide, uint8 attackerIndex, uint8 targetIndex, uint16 damage, uint16 remainingHp, uint8 specialEffect);
    event RelicsEquipped(address indexed player, uint256[3] relics);
    event LevelUpShipsGranted(address indexed player, uint16 count, uint256[] tokenIds);

    // ==================== STRUCTS ====================

    struct ShopItem {
        bool isRelic;
        uint256 id;
        uint8 faction;
        uint8 rarity;
        uint8 unitClass;
        uint8 attack;
        uint8 defense;
        uint8 speed;
        uint8 relicType;
        uint8 relicValue;
    }

    // ==================== STATE VARIABLES ====================

    StarForgeUnitNFT public unitNFT;
    StarForgeRelic public relicContract;
    StarForgePlayerProfile public playerProfileContract;

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _unitNFT,
        address _relic,
        address _playerProfile,
        address _previousGame
    ) Ownable() {
        unitNFT = StarForgeUnitNFT(_live(_unitNFT));
        relicContract = StarForgeRelic(_live(_relic));
        playerProfileContract = StarForgePlayerProfile(_live(_playerProfile));
        _setPrevious(_previousGame);
    }

    // ==================== ADMIN ====================

    function setUnitNFT(address _unitNFT) external onlyOwner {
        unitNFT = StarForgeUnitNFT(_live(_unitNFT));
    }

    function setRelicContract(address _relic) external onlyOwner {
        relicContract = StarForgeRelic(_live(_relic));
    }

    function setPlayerProfileContract(address _playerProfile) external onlyOwner {
        playerProfileContract = StarForgePlayerProfile(_live(_playerProfile));
    }

    function setPreviousGame(address _previousGame) external onlyOwner {
        _setPrevious(_previousGame);
    }

    function setPrices(
        uint256 _buyUnitPrice,
        uint256 _rerollPrice,
        uint256 _buyRelicShopPrice
    ) external onlyOwner {
        buyUnitPrice = _buyUnitPrice;
        rerollPrice = _rerollPrice;
        buyRelicShopPrice = _buyRelicShopPrice;
        emit PricesUpdated(_buyUnitPrice, _rerollPrice, _buyRelicShopPrice);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool ok, ) = payable(owner()).call{value: balance}("");
        require(ok, "Withdraw failed");
    }

    error NotEOA();

    function _requireEOA() internal view {
        if (tx.origin != msg.sender) revert NotEOA();
    }

    // ==================== ECONOMY ====================

    function buyUnit() external payable whenNotPaused nonReentrant {
        _requireEOA();
        playerProfileContract.createProfile(msg.sender);
        require(_remainingPaidBuys(msg.sender) > 0, "Daily buy limit reached");
        _requireExact(buyUnitPrice);

        _mintRandomUnit(msg.sender, 0);
        playerProfileContract.useBuy(msg.sender);
    }

    function generateTenShips() external payable whenNotPaused nonReentrant {
        _requireEOA();
        playerProfileContract.createProfile(msg.sender);
        require(_remainingPaidBuys(msg.sender) >= DAILY_PAID_BUY_LIMIT, "Not enough daily buys remaining");
        _requireExact(buyUnitPrice * DAILY_PAID_BUY_LIMIT);

        for (uint256 i = 0; i < DAILY_PAID_BUY_LIMIT; i++) {
            _mintRandomUnit(msg.sender, i);
            playerProfileContract.useBuy(msg.sender);
        }
    }

    function rerollShop() external payable whenNotPaused nonReentrant {
        playerProfileContract.createProfile(msg.sender);
        
        require(playerProfileContract.canReroll(msg.sender), "Daily reroll limit reached (2 per day)");
        _requireExact(rerollPrice);

        for (uint256 i = 0; i < 3; i++) {
            uint256 slotSeed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, i)));
            playerShop[msg.sender][i] = _generateShopItem(slotSeed);
        }

        playerProfileContract.useReroll(msg.sender);
    }

    function buyFromShop(uint256 slot) external payable whenNotPaused nonReentrant {
        _requireEOA();
        playerProfileContract.createProfile(msg.sender);
        require(slot < 3, "Invalid slot");

        ShopItem memory item = playerShop[msg.sender][slot];
        require(item.isRelic && item.relicValue > 0, "Empty slot");

        _requireExact(buyRelicShopPrice);

        uint256 realId = relicContract.mintRelic(
            msg.sender,
            StarForgeRelic.RelicType(item.relicType),
            item.relicValue
        );
        playerProfileContract.addRelic(msg.sender, realId);

        uint256 newSeed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, slot)));
        playerShop[msg.sender][slot] = _generateShopItem(newSeed);
    }

    // ==================== EQUIP ====================

    function equipRelics(uint256[3] calldata relics) external whenNotPaused {
        playerProfileContract.createProfile(msg.sender);

        uint256[] memory relicsMem = new uint256[](3);
        relicsMem[0] = relics[0];
        relicsMem[1] = relics[1];
        relicsMem[2] = relics[2];
        _requireUniqueOwnedRelics(relicsMem);

        equippedRelics[msg.sender] = relics;
        emit RelicsEquipped(msg.sender, relics);
    }

    // ==================== BATTLE ====================

    function startMatch(uint256[] calldata team, uint256[] calldata equipped) external whenNotPaused nonReentrant {
        _requireEOA();
        playerProfileContract.createProfile(msg.sender);
        require(team.length >= 4 && team.length <= 8, "Invalid team size");
        _requireOwnedUniqueTeam(team);
        uint256[] memory activeEquipped = _resolveEquipped(equipped);
        equippedRelics[msg.sender] = [activeEquipped[0], activeEquipped[1], activeEquipped[2]];

        StarForgePlayerProfile.PlayerProfile memory profileData = playerProfileContract.getProfile(msg.sender);
        uint16 playerLevel = profileData.level;
        uint256 battles = uint256(profileData.wins) + uint256(profileData.losses);
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao, block.number)));
        StarForgeBattleLibrary.ShopItem[] memory aiTeam = _buildShadowAI(team, battles, seed);

        for (uint8 i = 0; i < 8; i++) {
            lastAI[msg.sender][i].isRelic    = aiTeam[i].isRelic;
            lastAI[msg.sender][i].id         = aiTeam[i].id;
            lastAI[msg.sender][i].faction    = uint8(aiTeam[i].faction);
            lastAI[msg.sender][i].rarity     = uint8(aiTeam[i].rarity);
            lastAI[msg.sender][i].unitClass  = uint8(aiTeam[i].unitClass);
            lastAI[msg.sender][i].attack     = aiTeam[i].attack;
            lastAI[msg.sender][i].defense    = aiTeam[i].defense;
            lastAI[msg.sender][i].speed      = aiTeam[i].speed;
            lastAI[msg.sender][i].relicType  = aiTeam[i].relicType;
            lastAI[msg.sender][i].relicValue = aiTeam[i].relicValue;
        }

        StarForgeBattleLibrary.BattleResult memory result = StarForgeBattleLibrary._simulateBattle(
            team,
            aiTeam,
            seed,
            msg.sender,
            unitNFT,
            relicContract,
            activeEquipped,
            playerLevel,
            battles
        );

        bytes32 battleId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            block.prevrandao,
            result.playerWon
        ));

        lastBattleSummary[msg.sender] = BattleSummary({
            playerWon: result.playerWon,
            playerFinalHp: result.playerMaxHp,
            aiFinalHp: result.aiMaxHp,
            battleId: battleId,
            timestamp: uint64(block.timestamp)
        });

        emit BattleResolved(battleId, msg.sender, result.playerWon, result.playerMaxHp, result.aiMaxHp);

        for (uint256 i = 0; i < result.events.length; i++) {
            StarForgeBattleLibrary.BattleEvent memory e = result.events[i];
            emit BattleEventEmitted(
                battleId,
                e.round,
                e.isPlayerSide,
                e.attackerIndex,
                e.targetIndex,
                e.damage,
                e.remainingHp,
                e.specialEffect
            );
        }

        playerProfileContract.updateAfterBattle(msg.sender, result.playerWon);
        _grantPendingLevelUpShips(msg.sender);
    }

    function claimLevelUpShips() external whenNotPaused nonReentrant {
        playerProfileContract.createProfile(msg.sender);
        uint16 pending = pendingLevelUpShips(msg.sender);
        require(pending > 0, "No level-up ships to claim");
        _grantPendingLevelUpShips(msg.sender);
    }

    // ==================== VIEW FUNCTIONS ====================

    function getLastBattleSummary(address player) external view returns (BattleSummary memory) {
        return lastBattleSummary[player];
    }

    function getCurrentAI(address player) external view returns (ShopItem[8] memory) {
        return lastAI[player];
    }

    function getPlayerUnits(address player) external view returns (uint256[] memory) {
        return playerProfileContract.getPlayerUnits(player);
    }

    function getPlayerRelics(address player) external view returns (uint256[] memory) {
        return playerProfileContract.getPlayerRelics(player);
    }

    function getPlayerShop(address player) external view returns (ShopItem[3] memory) {
        return playerShop[player];
    }

    function getEquippedRelics(address player) external view returns (uint256[3] memory) {
        return equippedRelics[player];
    }

    function getRemainingBuys(address player) external view returns (uint256) {
        return _remainingPaidBuys(player);
    }

    function pendingLevelUpShips(address player) public view returns (uint16) {
        uint16 level = playerProfileContract.getProfile(player).level;
        if (level <= 1) {
            return 0;
        }
        uint16 entitled = level - 1;
        uint16 granted = _grantedFreeShips(player);
        if (entitled <= granted) {
            return 0;
        }
        return entitled - granted;
    }

    function canReroll(address player) external view returns (bool) {
        return playerProfileContract.canReroll(player);
    }

    // ==================== INTERNAL ====================

    function _live(address target) internal view returns (address) {
        require(target != address(0) && target.code.length > 0, "Bad addr");
        return target;
    }

    function _setPrevious(address _previousGame) internal {
        require(_previousGame != address(this), "Self");
        if (_previousGame != address(0)) {
            require(_previousGame.code.length > 0, "No code");
        }
        previousGame = _previousGame;
    }

    function _requireExact(uint256 price) internal view {
        require(msg.value == price, "Wrong payment");
    }

    function _getWeightedRarity(uint256 seed) internal pure returns (uint8) {
        uint256 roll = seed % 100;
        if (roll < 60) return 0;
        if (roll < 90) return 1;
        return 2;
    }

    function _shadowProgress(uint256 battles) internal pure returns (uint256) {
        return battles > 100 ? 100 : battles;
    }

    function _lerpShadowStat(uint256 weakVal, uint256 playerVal, uint256 progress) internal pure returns (uint8) {
        uint256 mixed = weakVal * (100 - progress) + playerVal * progress;
        uint256 scale = 104 + progress * 6 / 100;
        uint256 value = mixed * scale / 10000;
        if (value == 0) {
            value = 1;
        }
        if (value > 255) {
            value = 255;
        }
        return uint8(value);
    }

    function _buildShadowAI(
        uint256[] memory team,
        uint256 battles,
        uint256 seed
    ) internal view returns (StarForgeBattleLibrary.ShopItem[] memory aiTeam) {
        uint256 progress = _shadowProgress(battles);
        uint256 n = team.length;
        aiTeam = new StarForgeBattleLibrary.ShopItem[](8);

        for (uint8 i = 0; i < 8; i++) {
            uint256 aiSeed = uint256(keccak256(abi.encodePacked(seed, i, progress)));
            uint8 atk;
            uint8 def;
            uint8 spd;
            uint8 faction;
            uint8 unitClass;
            uint8 rarity;

            if (i < n) {
                StarForgeUnitNFT.Unit memory u = unitNFT.getUnit(team[i]);
                // Same ranges as player mint. Early AI must not be wet paper.
                uint8 weakAtk = uint8(10 + (aiSeed % 11));
                uint8 weakDef = uint8(8 + ((aiSeed >> 8) % 11));
                uint8 weakSpd = uint8(9 + ((aiSeed >> 16) % 11));
                atk = _lerpShadowStat(weakAtk, u.attack, progress);
                def = _lerpShadowStat(weakDef, u.defense, progress);
                spd = _lerpShadowStat(weakSpd, u.speed, progress);
                if ((aiSeed >> 48) % 100 < progress) {
                    rarity = uint8(u.rarity);
                } else {
                    rarity = _getWeightedRarity(aiSeed);
                }
                faction = uint8(u.faction);
                unitClass = uint8(u.unitClass);
            } else {
                atk = uint8(14 + (aiSeed % 7));
                def = uint8(12 + ((aiSeed >> 8) % 7));
                spd = uint8(13 + ((aiSeed >> 16) % 7));
                rarity = progress < 50 ? 1 : 2;
                faction = uint8((aiSeed >> 24) % 3);
                unitClass = uint8((aiSeed >> 32) % 4);
            }

            aiTeam[i] = StarForgeBattleLibrary.ShopItem({
                isRelic: false,
                id: 0,
                faction: StarForgeUnitNFT.Faction(faction),
                rarity: StarForgeUnitNFT.Rarity(rarity),
                unitClass: StarForgeUnitNFT.UnitClass(unitClass),
                attack: atk,
                defense: def,
                speed: spd,
                relicType: 0,
                relicValue: 0
            });
        }
    }

    function _generateShopItem(uint256 seed) internal pure returns (ShopItem memory) {
        uint8 relicType = uint8(seed % 6);
        uint8 value = uint8(8 + ((seed >> 8) % 13));
        return ShopItem(true, 0, 0, 0, 0, 0, 0, 0, relicType, value);
    }

    function _remainingPaidBuys(address player) internal view returns (uint256) {
        uint256 currentDay = block.timestamp / 86400;
        uint256 lastDay = playerProfileContract.lastResetTimestamp(player) / 86400;
        uint256 used = currentDay > lastDay ? 0 : playerProfileContract.dailyBuysUsed(player);
        if (used >= DAILY_PAID_BUY_LIMIT) {
            return 0;
        }
        return DAILY_PAID_BUY_LIMIT - used;
    }

    function _mintRandomUnit(address to, uint256 salt) internal returns (uint256) {
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, to, block.prevrandao, salt)));

        uint8 atk = uint8(10 + (seed % 11));
        uint8 def = uint8(8 + ((seed >> 8) % 11));
        uint8 spd = uint8(9 + ((seed >> 16) % 11));
        uint8 faction = uint8((seed >> 24) % 3);
        uint8 unitClass = uint8((seed >> 32) % 4);
        uint8 rarity = _getWeightedRarity(seed);

        uint256 tokenId = unitNFT.mintUnit(
            to,
            StarForgeUnitNFT.Faction(faction),
            StarForgeUnitNFT.Rarity(rarity),
            StarForgeUnitNFT.UnitClass(unitClass),
            atk,
            def,
            spd
        );

        playerProfileContract.addUnit(to, tokenId);
        return tokenId;
    }

    function _grantPendingLevelUpShips(address player) internal {
        uint16 pending = pendingLevelUpShips(player);
        if (pending == 0) {
            return;
        }

        uint16 granted = _grantedFreeShips(player);
        uint256[] memory tokenIds = new uint256[](pending);
        for (uint16 i = 0; i < pending; i++) {
            tokenIds[i] = _mintRandomUnit(player, 1000 + uint256(granted) + uint256(i));
        }

        freeShipsGranted[player] = granted + pending;
        emit LevelUpShipsGranted(player, pending, tokenIds);
    }

    function _grantedFreeShips(address player) internal view returns (uint16) {
        uint16 granted = freeShipsGranted[player];
        address cursor = previousGame;
        for (uint256 i = 0; granted == 0 && cursor != address(0) && i < 8; i++) {
            granted = StarForgeGame(cursor).freeShipsGranted(player);
            if (granted == 0) {
                cursor = StarForgeGame(cursor).previousGame();
            }
        }
        return granted;
    }

    function _requireOwnedUniqueTeam(uint256[] calldata team) internal view {
        for (uint256 i = 0; i < team.length; i++) {
            require(unitNFT.ownerOf(team[i]) == msg.sender, "Not owner");
            for (uint256 j = 0; j < i; j++) {
                require(team[i] != team[j], "Dup unit");
            }
        }
    }

    function _requireUniqueOwnedRelics(uint256[] memory relics) internal view {
        for (uint256 i = 0; i < relics.length; i++) {
            if (relics[i] == 0) continue;
            require(relicContract.balanceOf(msg.sender, relics[i]) > 0, "Not owner");
            for (uint256 j = 0; j < i; j++) {
                require(relics[i] != relics[j], "Dup relic");
            }
        }
    }

    function _resolveEquipped(uint256[] calldata equipped) internal view returns (uint256[] memory active) {
        active = new uint256[](3);
        if (equipped.length == 0) {
            for (uint256 i = 0; i < 3; i++) active[i] = equippedRelics[msg.sender][i];
        } else {
            require(equipped.length <= 3, "Too many relics");
            for (uint256 i = 0; i < equipped.length; i++) active[i] = equipped[i];
        }
        _requireUniqueOwnedRelics(active);
    }

    function clearPlayerData() external whenNotPaused {
        delete equippedRelics[msg.sender];
        delete playerShop[msg.sender];
        delete lastBattleSummary[msg.sender];
        delete lastAI[msg.sender];
    }
}