// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts@4.9.3/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.3/access/AccessControl.sol";

contract StarForgePlayerProfile is Ownable, AccessControl {
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

    struct PlayerProfile {
        uint16 level;
        uint32 xp;
        uint256 wins;
        uint256 losses;
        uint16 currentAITier;
    }

    mapping(address => PlayerProfile) public profiles;
    mapping(address => bool) public hasProfile;

    event ProfileCreated(address indexed player);
    event ProfileUpdated(address indexed player, uint16 newLevel, uint32 newXp);

    constructor() Ownable() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyGame() {
        require(hasRole(GAME_ROLE, msg.sender), "Only Game contract can call");
        _;
    }

    function setGameContract(address _game) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(GAME_ROLE, _game);
    }

    function createProfile(address player) external onlyGame {
        if (!hasProfile[player]) {
            hasProfile[player] = true;
            profiles[player] = PlayerProfile(1, 0, 0, 0, 1);
            emit ProfileCreated(player);
        }
    }

    function updateAfterBattle(address player, bool won) external onlyGame {
        PlayerProfile storage p = profiles[player];
        p.xp += won ? 25 : 10;
        if (won) p.wins++;
        else p.losses++;

        uint32 xpNeeded = uint32(p.level) * 55 + 90;
        if (p.xp >= xpNeeded) {
            p.level++;
            emit ProfileUpdated(player, p.level, p.xp);
        }
    }

    function getProfile(address player) external view returns (PlayerProfile memory) {
        return profiles[player];
    }

    function hasPlayerProfile(address player) external view returns (bool) {
        return hasProfile[player];
    }
}