// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./StarForgeUnitNFT.sol";

contract StarForgeGame is Ownable, ReentrancyGuard, Pausable {
    StarForgeUnitNFT public unitNFT;

    uint256 public constant BUY_PRICE = 0.001 ether;
    uint256 public constant REROLL_PRICE = 0.0005 ether;

    struct PlayerProfile {
        uint16 level;
        uint32 xp;
        uint256 wins;
        uint256 losses;
    }

    mapping(address => PlayerProfile) public profiles;

    // === SHOP ===
    mapping(address => uint256[5]) public playerShop; // tokenId в каждом слоте

    event UnitBought(address player, uint256 tokenId);
    event MatchPlayed(address player, uint256 score, uint256[] rewards);
    event ShopRerolled(address player);

    constructor(address _unitNFT) Ownable(msg.sender) {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    function setUnitNFT(address _unitNFT) external onlyOwner {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    /**
     * @notice Генерирует 5 новых юнитов в shop игрока
     */
    function _generateShop(address player) internal {
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, player, unitNFT.totalSupply())));
        for (uint256 i = 0; i < 5; i++) {
            StarForgeUnitNFT.Faction faction = StarForgeUnitNFT.Faction(uint8((seed >> (i*8)) % 3));
            StarForgeUnitNFT.Rarity rarity = StarForgeUnitNFT.Rarity.Common;
            StarForgeUnitNFT.UnitClass unitClass = StarForgeUnitNFT.UnitClass(uint8((seed >> (i*16)) % 4));

            uint256 tokenId = unitNFT.mintUnit(player, faction, rarity, unitClass, 5 + uint8(i%4), 4 + uint8(i%3), 5 + uint8(i%5));
            playerShop[player][i] = tokenId;
        }
    }

    function rerollShop() external payable whenNotPaused nonReentrant {
        require(msg.value == REROLL_PRICE, "Incorrect payment for reroll");
        _generateShop(msg.sender);
        emit ShopRerolled(msg.sender);
    }

    /**
     * @notice Купить юнит из конкретного слота shop
     */
    function buyFromShop(uint256 slot) external payable whenNotPaused nonReentrant {
        require(msg.value == BUY_PRICE, "Incorrect payment");
        require(slot < 5, "Invalid slot");
        uint256 tokenId = playerShop[msg.sender][slot];
        require(tokenId != 0, "Slot empty");

        // Юнит уже заминчен на игрока
        playerShop[msg.sender][slot] = 0; // очищаем слот

        _updateProfileBuy(msg.sender);

        emit UnitBought(msg.sender, tokenId);
    }

    function startMatch(uint256[] calldata team) external whenNotPaused nonReentrant {
        require(team.length >= 4 && team.length <= 8, "Team size 4-8 only");

        for (uint256 i = 0; i < team.length; i++) {
            require(unitNFT.ownerOf(team[i]) == msg.sender, "Not your unit");
        }

        (uint256 score, ) = _simulateBattle(team);

        _updateProfileMatch(msg.sender, score > 80);

        StarForgeUnitNFT.Faction faction = StarForgeUnitNFT.Faction(uint8(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender))) % 3));
        uint256 rewardTokenId = unitNFT.mintUnit(msg.sender, faction, StarForgeUnitNFT.Rarity.Common, StarForgeUnitNFT.UnitClass.Fighter, 5, 5, 6);

        uint256[] memory finalRewards = new uint256[](1);
        finalRewards[0] = rewardTokenId;

        emit MatchPlayed(msg.sender, score, finalRewards);
    }

    function _simulateBattle(uint256[] calldata team) internal view returns (uint256 score, uint256[] memory) {
        uint256 totalPower = 0;
        uint8[3] memory factionCount;

        for (uint256 i = 0; i < team.length; i++) {
            StarForgeUnitNFT.Unit memory u = unitNFT.getUnit(team[i]);
            totalPower += uint256(u.attack) + uint256(u.defense) + uint256(u.speed) * 2;
            factionCount[uint8(u.faction)]++;
        }

        for (uint8 f = 0; f < 3; f++) {
            if (factionCount[f] >= 3) {
                totalPower = totalPower * 130 / 100;
            }
        }

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
        score = (totalPower % 120) + 40;

        uint256[] memory empty;
        return (score, empty);
    }

    function _updateProfileBuy(address player) internal {
        PlayerProfile storage p = profiles[player];
        if (p.level == 0) p.level = 1;
        p.xp += 10;
    }

    function _updateProfileMatch(address player, bool won) internal {
        PlayerProfile storage p = profiles[player];
        if (won) {
            p.wins++;
            p.xp += 50;
        } else {
            p.losses++;
            p.xp += 20;
        }
        if (p.xp >= p.level * 100) p.level++;
    }

    function getPlayerUnits(address player) external view returns (uint256[] memory) {
        uint256 total = unitNFT.totalSupply();
        uint256[] memory temp = new uint256[](total);
        uint256 count = 0;

        for (uint256 i = 0; i < total; i++) {
            if (unitNFT.ownerOf(i) == player) {
                temp[count] = i;
                count++;
            }
        }

        uint256[] memory owned = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            owned[i] = temp[i];
        }
        return owned;
    }

    function getPlayerShop(address player) external view returns (uint256[5] memory) {
        return playerShop[player];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
