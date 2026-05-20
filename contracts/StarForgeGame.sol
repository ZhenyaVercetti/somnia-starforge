// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./StarForgeBattleLibrary.sol";
import "./StarForgeUnitNFT.sol";
import "./StarForgeRelic.sol";

/**
 * @title StarForgeGame
 * @notice Main game contract for Somnia StarForge — fully on-chain Auto-Battler (TFT-like).
 * @dev Uses BattleLibrary for deterministic combat resolution. Gas-optimized per TЗ Variant 1:
 *      - No storage of full BattleEvent arrays (only summary + lastBattleId).
 *      - All detailed events emitted via logs (cheap for frontend replay via getLogs).
 *      - AI team generated on-chain deterministically.
 * @custom:version v1.6
 */
contract StarForgeGame {
    using StarForgeBattleLibrary for *;

    // ==================== STORAGE ====================

    mapping(address => bool) public hasProfile;
    mapping(address => PlayerProfile) public profiles;
    mapping(address => uint256[]) public playerUnits;
    mapping(address => uint256[]) public playerRelics;
    mapping(address => uint256[3]) public equippedRelics;
    mapping(address => ShopItem[3]) public playerShop;

    // Last battle summary (gas-optimized — no full event array)
    mapping(address => bool) public lastPlayerWon;
    mapping(address => uint16[]) public lastPlayerMaxHp;
    mapping(address => uint16[]) public lastAIMaxHp;
    bytes32 public lastBattleId;

    // ==================== EVENTS ====================

    event BattleResolved(
        bytes32 indexed battleId,
        address indexed player,
        bool playerWon,
        uint16[] playerMaxHp,
        uint16[] aiMaxHp
    );

    event BattleEventEmitted(
        bytes32 indexed battleId,
        uint8 round,
        bool isPlayerSide,
        uint8 attackerIndex,
        uint8 targetIndex,
        uint16 damage,
        uint16 remainingHp,
        string specialEffect
    );

    // ==================== STRUCTS ====================

    struct PlayerProfile {
        uint16 level;
        uint32 xp;
        uint256 wins;
        uint256 losses;
        uint16 currentAITier;
    }

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

    // ==================== CONSTRUCTOR ====================

    /**
     * @notice Initializes the game with existing NFT and Relic contracts.
     * @param _unitNFT Address of deployed StarForgeUnitNFT
     * @param _relic Address of deployed StarForgeRelic
     */
    constructor(address _unitNFT, address _relic) {
        unitNFT = StarForgeUnitNFT(_unitNFT);
        relicContract = StarForgeRelic(_relic);
    }

    // ==================== ADMIN / SETTERS ====================

    function setUnitNFT(address _unitNFT) external {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    function setRelicContract(address _relic) external {
        relicContract = StarForgeRelic(_relic);
    }

    // ==================== PROFILE ====================

    /**
     * @notice Creates a new player profile. Can be called only once per address.
     */
    function createProfile() external {
        require(!hasProfile[msg.sender], "Profile already exists");
        hasProfile[msg.sender] = true;
        profiles[msg.sender] = PlayerProfile(1, 0, 0, 0, 1);
    }

    // ==================== ECONOMY: BUY / SHOP ====================

    /**
     * @notice Buys a new random unit for 0.01 ETH. Mints ERC-721 via UnitNFT.
     * @dev Uses block.prevrandao for better randomness than timestamp only.
     */
    function buyUnit() external payable {
        require(hasProfile[msg.sender], "Create profile first");
        require(msg.value >= 0.01 ether, "Insufficient payment");

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao)));

        uint8 atk = uint8(10 + (seed % 11));
        uint8 def = uint8(8 + ((seed >> 8) % 11));
        uint8 spd = uint8(9 + ((seed >> 16) % 11));

        uint8 faction = uint8((seed >> 24) % 3);
        uint8 unitClass = uint8((seed >> 32) % 4);
        uint8 rarity = uint8((seed >> 40) % 3);

        uint256 tokenId = unitNFT.mintUnit(
            msg.sender,
            StarForgeUnitNFT.Faction(faction),
            StarForgeUnitNFT.Rarity(rarity),
            StarForgeUnitNFT.UnitClass(unitClass),
            atk,
            def,
            spd
        );

        playerUnits[msg.sender].push(tokenId);
    }

    /**
     * @notice Rerolls the 3-item shop for 0.005 ETH.
     */
    function rerollShop() external payable {
        require(hasProfile[msg.sender], "Create profile first");
        require(msg.value >= 0.005 ether, "Insufficient payment");

        for (uint256 i = 0; i < 3; i++) {
            playerShop[msg.sender][i] = _generateShopItem();
        }
    }

    /**
     * @notice Buys item from shop slot. If relic — mints real ERC-1155 via Relic contract.
     * @dev This fixes previous fake relic IDs. Real mint happens here.
     */
    function buyFromShop(uint256 slot) external payable {
        require(hasProfile[msg.sender], "Create profile first");
        require(slot < 3, "Invalid slot");

        ShopItem memory item = playerShop[msg.sender][slot];
        require(item.id != 0 || item.isRelic, "Empty slot");

        if (item.isRelic) {
            require(msg.value >= 0.008 ether, "Insufficient payment for relic");
            // Mint real relic and store actual token ID
            uint256 realId = relicContract.mintRelic(
                msg.sender,
                StarForgeRelic.RelicType(item.relicType),
                item.relicValue
            );
            playerRelics[msg.sender].push(realId);
        } else {
            require(msg.value >= 0.01 ether, "Insufficient payment for unit");

            uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao, slot)));

            uint8 atk = uint8(10 + (seed % 11));
            uint8 def = uint8(8 + ((seed >> 8) % 11));
            uint8 spd = uint8(9 + ((seed >> 16) % 11));

            uint8 faction = uint8((seed >> 24) % 3);
            uint8 unitClass = uint8((seed >> 32) % 4);
            uint8 rarity = uint8((seed >> 40) % 3);

            uint256 tokenId = unitNFT.mintUnit(
                msg.sender,
                StarForgeUnitNFT.Faction(faction),
                StarForgeUnitNFT.Rarity(rarity),
                StarForgeUnitNFT.UnitClass(unitClass),
                atk,
                def,
                spd
            );

            playerUnits[msg.sender].push(tokenId);
        }

        playerShop[msg.sender][slot] = _generateShopItem();
    }

    // ==================== BATTLE ====================

    /**
     * @notice Starts an on-chain auto-battle. Team size 4-8.
     * @dev AI team is generated deterministically here (critical fix from previous broken version).
     *      Gas optimization per TЗ: only summary stored + events emitted (no full BattleEvent[] storage).
     * @param team Array of player's unit token IDs
     * @param equipped Array of relic IDs to apply this match (can be empty)
     */
    function startMatch(uint256[] calldata team, uint256[] calldata equipped) external {
        require(hasProfile[msg.sender], "Create profile first");
        require(team.length >= 4 && team.length <= 8, "Invalid team size");

        // Generate 8 AI units deterministically (balanced vs player level)
        StarForgeBattleLibrary.ShopItem[] memory aiTeam = new StarForgeBattleLibrary.ShopItem[](8);
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao, block.number)));

        for (uint8 i = 0; i < 8; i++) {
            uint256 aiSeed = uint256(keccak256(abi.encodePacked(seed, i, profiles[msg.sender].level)));
            uint8 atk = uint8(8 + (aiSeed % 13));
            uint8 def = uint8(7 + ((aiSeed >> 8) % 12));
            uint8 spd = uint8(8 + ((aiSeed >> 16) % 11));
            uint8 faction = uint8((aiSeed >> 24) % 3);
            uint8 unitClass = uint8((aiSeed >> 32) % 4);
            uint8 rarity = uint8((aiSeed >> 40) % 3);

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

        // Run fully on-chain deterministic battle
        StarForgeBattleLibrary.BattleResult memory result = StarForgeBattleLibrary._simulateBattle(
            team,
            aiTeam,
            seed,
            msg.sender,
            unitNFT,
            relicContract,
            equipped,
            profiles[msg.sender].level
        );

        // Generate battleId and store only lightweight summary (gas optimization)
        bytes32 battleId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            block.prevrandao,
            result.playerWon
        ));

        lastBattleId = battleId;
        lastPlayerWon[msg.sender] = result.playerWon;

        delete lastPlayerMaxHp[msg.sender];
        for (uint256 i = 0; i < result.playerMaxHp.length; i++) {
            lastPlayerMaxHp[msg.sender].push(result.playerMaxHp[i]);
        }

        delete lastAIMaxHp[msg.sender];
        for (uint256 i = 0; i < result.aiMaxHp.length; i++) {
            lastAIMaxHp[msg.sender].push(result.aiMaxHp[i]);
        }

        // Emit summary + all battle events (cheap logs for frontend replay)
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

        _updateProfileAfterBattle(result.playerWon);
    }

    // ==================== VIEW FUNCTIONS ====================

    function getLastBattleResult(address player) external view returns (
        bool playerWon,
        uint16[] memory playerMaxHp,
        uint16[] memory aiMaxHp,
        bytes32 battleId
    ) {
        return (
            lastPlayerWon[player],
            lastPlayerMaxHp[player],
            lastAIMaxHp[player],
            lastBattleId
        );
    }

    function getPlayerUnits(address player) external view returns (uint256[] memory) {
        return playerUnits[player];
    }

    function getPlayerRelics(address player) external view returns (uint256[] memory) {
        return playerRelics[player];
    }

    function getPlayerShop(address player) external view returns (ShopItem[3] memory) {
        return playerShop[player];
    }

    function getEquippedRelics(address player) external view returns (uint256[3] memory) {
        return equippedRelics[player];
    }

    function getCurrentAI(address /*player*/) external pure returns (ShopItem[] memory) {
        ShopItem[] memory ai = new ShopItem[](8);
        return ai;
    }

    // ==================== INTERNAL HELPERS ====================

    /**
     * @dev Generates a shop item (40% relic chance). Used by reroll and buyFromShop.
     *      Seed includes prevrandao for better unpredictability.
     */
    function _generateShopItem() internal view returns (ShopItem memory) {
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender)));

        bool isRelic = (seed % 100) < 40;

        if (isRelic) {
            uint8 relicType = uint8(seed % 6);
            uint8 value = uint8(8 + ((seed >> 8) % 13));
            return ShopItem(true, 0, 0, 0, 0, 0, 0, 0, relicType, value);
        } else {
            uint8 faction = uint8((seed >> 16) % 3);
            uint8 unitClass = uint8((seed >> 24) % 4);
            uint8 rarity = uint8((seed >> 32) % 3);

            uint8 atk = uint8(10 + ((seed >> 40) % 11));
            uint8 def = uint8(8 + ((seed >> 48) % 11));
            uint8 spd = uint8(9 + ((seed >> 56) % 11));

            return ShopItem(false, 0, faction, rarity, unitClass, atk, def, spd, 0, 0);
        }
    }

    /**
     * @dev Updates player XP / level / winrate after battle.
     */
    function _updateProfileAfterBattle(bool won) internal {
        PlayerProfile storage profile = profiles[msg.sender];
        profile.xp += won ? 25 : 10;
        if (won) profile.wins++;
        else profile.losses++;

        if (profile.xp >= uint32(profile.level) * 55 + 90) {
            profile.level++;
        }
    }

    // ==================== CLEANUP ====================

    function clearPlayerData() external {
        delete playerUnits[msg.sender];
        delete playerRelics[msg.sender];
        delete equippedRelics[msg.sender];
        delete lastPlayerMaxHp[msg.sender];
        delete lastAIMaxHp[msg.sender];
    }
}