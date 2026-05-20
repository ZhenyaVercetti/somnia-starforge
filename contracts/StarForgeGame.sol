// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./StarForgeBattleLibrary.sol";
import "./StarForgeUnitNFT.sol";
import "./StarForgeRelic.sol";
import "./StarForgePlayerProfile.sol";
import "@openzeppelin/contracts@4.9.3/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.3/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts@4.9.3/security/Pausable.sol";

contract StarForgeGame is Ownable, ReentrancyGuard, Pausable {
    using StarForgeBattleLibrary for *;

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
    mapping(address => bytes) public lastBattleEventsPacked;

    // ==================== PRICES ====================

    uint256 public buyUnitPrice = 0.01 ether;
    uint256 public rerollPrice = 0.005 ether;
    uint256 public buyUnitShopPrice = 0.01 ether;
    uint256 public buyRelicShopPrice = 0.008 ether;

    event PricesUpdated(uint256 buyUnit, uint256 reroll, uint256 buyUnitShop, uint256 buyRelicShop);
    event BattleResolved(bytes32 indexed battleId, address indexed player, bool playerWon, uint16[] playerMaxHp, uint16[] aiMaxHp);
    event BattleEventEmitted(bytes32 indexed battleId, uint8 round, bool isPlayerSide, uint8 attackerIndex, uint8 targetIndex, uint16 damage, uint16 remainingHp, uint8 specialEffect);
    event RelicsEquipped(address indexed player, uint256[3] relics);

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
        address _playerProfile
    ) Ownable() {
        unitNFT = StarForgeUnitNFT(_unitNFT);
        relicContract = StarForgeRelic(_relic);
        playerProfileContract = StarForgePlayerProfile(_playerProfile);
    }

    // ==================== ADMIN ====================

    function setUnitNFT(address _unitNFT) external onlyOwner {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    function setRelicContract(address _relic) external onlyOwner {
        relicContract = StarForgeRelic(_relic);
    }

    function setPlayerProfileContract(address _playerProfile) external onlyOwner {
        playerProfileContract = StarForgePlayerProfile(_playerProfile);
    }

    function setPrices(
        uint256 _buyUnitPrice,
        uint256 _rerollPrice,
        uint256 _buyUnitShopPrice,
        uint256 _buyRelicShopPrice
    ) external onlyOwner {
        buyUnitPrice = _buyUnitPrice;
        rerollPrice = _rerollPrice;
        buyUnitShopPrice = _buyUnitShopPrice;
        buyRelicShopPrice = _buyRelicShopPrice;
        emit PricesUpdated(_buyUnitPrice, _rerollPrice, _buyUnitShopPrice, _buyRelicShopPrice);
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
        payable(owner()).transfer(balance);
    }

    // ==================== ECONOMY ====================

    function buyUnit() external payable whenNotPaused nonReentrant {
        playerProfileContract.createProfile(msg.sender);
        
        // Проверка лимита
        uint256 remaining = playerProfileContract.getRemainingBuys(msg.sender);
        require(remaining > 0, "Daily buy limit reached");

        require(msg.value >= buyUnitPrice, "Insufficient payment");

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao)));

        uint8 atk = uint8(10 + (seed % 11));
        uint8 def = uint8(8 + ((seed >> 8) % 11));
        uint8 spd = uint8(9 + ((seed >> 16) % 11));

        uint8 faction = uint8((seed >> 24) % 3);
        uint8 unitClass = uint8((seed >> 32) % 4);
        uint8 rarity = _getWeightedRarity(seed);

        uint256 tokenId = unitNFT.mintUnit(
            msg.sender,
            StarForgeUnitNFT.Faction(faction),
            StarForgeUnitNFT.Rarity(rarity),
            StarForgeUnitNFT.UnitClass(unitClass),
            atk,
            def,
            spd
        );

        playerProfileContract.addUnit(msg.sender, tokenId);
        playerProfileContract.useBuy(msg.sender);
    }

    function generateTenShips() external payable whenNotPaused nonReentrant {
        playerProfileContract.createProfile(msg.sender);
        
        uint256 remaining = playerProfileContract.getRemainingBuys(msg.sender);
        require(remaining >= 10, "Not enough daily buys remaining");

        require(msg.value >= buyUnitPrice * 10, "Insufficient payment for 10 ships");

        for (uint256 i = 0; i < 10; i++) {
            uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao, i)));

            uint8 atk = uint8(10 + (seed % 11));
            uint8 def = uint8(8 + ((seed >> 8) % 11));
            uint8 spd = uint8(9 + ((seed >> 16) % 11));

            uint8 faction = uint8((seed >> 24) % 3);
            uint8 unitClass = uint8((seed >> 32) % 4);
            uint8 rarity = _getWeightedRarity(seed);

            uint256 tokenId = unitNFT.mintUnit(
                msg.sender,
                StarForgeUnitNFT.Faction(faction),
                StarForgeUnitNFT.Rarity(rarity),
                StarForgeUnitNFT.UnitClass(unitClass),
                atk,
                def,
                spd
            );

            playerProfileContract.addUnit(msg.sender, tokenId);
        }

        // Используем 10 покупок
        for (uint256 i = 0; i < 10; i++) {
            playerProfileContract.useBuy(msg.sender);
        }
    }

    function rerollShop() external payable whenNotPaused nonReentrant {
        playerProfileContract.createProfile(msg.sender);
        
        require(playerProfileContract.canReroll(msg.sender), "Daily reroll limit reached (2 per day)");
        require(msg.value >= rerollPrice, "Insufficient payment");

        for (uint256 i = 0; i < 3; i++) {
            uint256 slotSeed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, i)));
            playerShop[msg.sender][i] = _generateShopItem(slotSeed);
        }

        playerProfileContract.useReroll(msg.sender);
    }

    function buyFromShop(uint256 slot) external payable whenNotPaused nonReentrant {
        playerProfileContract.createProfile(msg.sender);
        require(slot < 3, "Invalid slot");

        ShopItem memory item = playerShop[msg.sender][slot];
        require(item.isRelic && item.relicValue > 0, "Empty slot");

        require(msg.value >= buyRelicShopPrice, "Insufficient payment for relic");

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

        for (uint256 i = 0; i < 3; i++) {
            if (relics[i] != 0) {
                require(relicContract.balanceOf(msg.sender, relics[i]) > 0, "You do not own this relic");
            }
        }

        equippedRelics[msg.sender] = relics;
        emit RelicsEquipped(msg.sender, relics);
    }

    // ==================== BATTLE ====================

    function startMatch(uint256[] calldata team, uint256[] calldata equipped) external whenNotPaused nonReentrant {
        playerProfileContract.createProfile(msg.sender);
        require(team.length >= 4 && team.length <= 8, "Invalid team size");

        // Проверка владения юнитами (теперь через профиль)
        uint256[] memory ownedUnits = playerProfileContract.getPlayerUnits(msg.sender);
        for (uint256 i = 0; i < team.length; i++) {
            bool owns = false;
            for (uint256 j = 0; j < ownedUnits.length; j++) {
                if (ownedUnits[j] == team[i]) {
                    owns = true;
                    break;
                }
            }
            require(owns, "You do not own this unit");
        }

        uint256[] memory activeEquipped = equipped.length > 0 ? equipped : new uint256[](3);
        if (equipped.length == 0) {
            for (uint256 i = 0; i < 3; i++) {
                activeEquipped[i] = equippedRelics[msg.sender][i];
            }
        } else {
            require(equipped.length <= 3, "Too many relics");
            for (uint256 i = 0; i < equipped.length; i++) {
                if (equipped[i] != 0) {
                    require(relicContract.balanceOf(msg.sender, equipped[i]) > 0, "You do not own this relic");
                }
            }
            activeEquipped = equipped;
        }

        StarForgeBattleLibrary.ShopItem[] memory aiTeam = new StarForgeBattleLibrary.ShopItem[](8);
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao, block.number)));

        for (uint8 i = 0; i < 8; i++) {
            uint256 aiSeed = uint256(keccak256(abi.encodePacked(seed, i, playerProfileContract.getProfile(msg.sender).level)));
            uint8 atk = uint8(8 + (aiSeed % 13));
            uint8 def = uint8(7 + ((aiSeed >> 8) % 12));
            uint8 spd = uint8(8 + ((aiSeed >> 16) % 11));
            uint8 faction = uint8((aiSeed >> 24) % 3);
            uint8 unitClass = uint8((aiSeed >> 32) % 4);
            uint8 rarity = _getWeightedRarity(aiSeed);

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
            playerProfileContract.getProfile(msg.sender).level
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

        bytes memory packedEvents = _packBattleEvents(result.events, battleId);
        lastBattleEventsPacked[msg.sender] = packedEvents;

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
    }

    // ==================== VIEW FUNCTIONS ====================

    function getLastBattleSummary(address player) external view returns (BattleSummary memory) {
        return lastBattleSummary[player];
    }

    function getPackedBattleEvents(address player) external view returns (bytes memory) {
        return lastBattleEventsPacked[player];
    }

    function getLastBattleResult(address player) external view returns (
        bool,
        uint16[] memory,
        uint16[] memory,
        bytes32,
        bytes memory
    ) {
        BattleSummary memory summary = lastBattleSummary[player];
        return (
            summary.playerWon,
            summary.playerFinalHp,
            summary.aiFinalHp,
            summary.battleId,
            lastBattleEventsPacked[player]
        );
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
        return playerProfileContract.getRemainingBuys(player);
    }

    function canReroll(address player) external view returns (bool) {
        return playerProfileContract.canReroll(player);
    }

    // ==================== INTERNAL ====================

    function _getWeightedRarity(uint256 seed) internal pure returns (uint8) {
        uint256 roll = seed % 100;
        if (roll < 60) return 0;
        if (roll < 90) return 1;
        return 2;
    }

    function _generateShopItem(uint256 seed) internal pure returns (ShopItem memory) {
        uint8 relicType = uint8(seed % 6);
        uint8 value = uint8(8 + ((seed >> 8) % 13));
        return ShopItem(true, 0, 0, 0, 0, 0, 0, 0, relicType, value);
    }

    function _packBattleEvents(
        StarForgeBattleLibrary.BattleEvent[] memory events,
        bytes32 battleId
    ) internal pure returns (bytes memory) {
        bytes memory packed = new bytes(32 + events.length * 13);
        
        assembly {
            mstore(add(packed, 32), battleId)
        }
        
        for (uint256 i = 0; i < events.length; i++) {
            StarForgeBattleLibrary.BattleEvent memory e = events[i];
            uint256 offset = 32 + (i * 13);
            
            packed[offset]     = bytes1(e.isPlayerSide ? 1 : 0);
            packed[offset + 1] = bytes1(e.round);
            packed[offset + 2] = bytes1(e.attackerIndex);
            packed[offset + 3] = bytes1(e.targetIndex);
            
            packed[offset + 4] = bytes1(uint8(e.damage >> 8));
            packed[offset + 5] = bytes1(uint8(e.damage));
            
            packed[offset + 6] = bytes1(uint8(e.remainingHp >> 8));
            packed[offset + 7] = bytes1(uint8(e.remainingHp));
            
            packed[offset + 8]  = bytes1(e.specialEffect);
            packed[offset + 9]  = bytes1(e.attackerRarity);
            packed[offset + 10] = bytes1(e.attackerClass);
            packed[offset + 11] = bytes1(e.targetRarity);
            packed[offset + 12] = bytes1(e.targetClass);
        }
        
        return packed;
    }

    function clearPlayerData() external whenNotPaused {
        delete equippedRelics[msg.sender];
        delete playerShop[msg.sender];
        delete lastBattleSummary[msg.sender];
        delete lastBattleEventsPacked[msg.sender];
    }
}