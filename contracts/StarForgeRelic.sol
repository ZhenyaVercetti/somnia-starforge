// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts@4.9.3/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts@4.9.3/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.3/utils/Strings.sol";

contract StarForgeRelic is ERC1155, Ownable {
    using Strings for uint256;

    address public gameContract;

    uint256 private _nextRelicId;

    struct RelicData {
        RelicType relicType;
        uint8 value;
        string name;
    }

    enum RelicType {
        ATTACK_BOOST,
        DEFENSE_BOOST,
        SPEED_BOOST,
        HP_BOOST,
        CRIT_CHANCE,
        LAST_STAND
    }

    mapping(uint256 => RelicData) public relics;

    event RelicMinted(address indexed to, uint256 id, RelicType relicType, uint8 value, string name);

    modifier onlyGameContract() {
        require(msg.sender == gameContract, "Only StarForgeGame contract can mint relics");
        _;
    }

    constructor() ERC1155("") Ownable() {}

    function setGameContract(address _gameContract) external onlyOwner {
        gameContract = _gameContract;
    }

    function mintRelic(
        address to,
        RelicType relicType,
        uint8 value
    ) external onlyGameContract returns (uint256) {
        uint256 id = _nextRelicId++;
        string memory name = _generateRelicName(relicType, value);

        _mint(to, id, 1, "");

        relics[id] = RelicData({
            relicType: relicType,
            value: value,
            name: name
        });

        emit RelicMinted(to, id, relicType, value, name);
        return id;
    }

    function getRelic(uint256 id) external view returns (RelicData memory) {
        require(relics[id].value > 0, "Relic does not exist");
        return relics[id];
    }

    function _generateRelicName(RelicType t, uint8 value) internal pure returns (string memory) {
        if (t == RelicType.ATTACK_BOOST)    return string(abi.encodePacked("Quantum Strike +", Strings.toString(uint256(value))));
        if (t == RelicType.DEFENSE_BOOST)   return string(abi.encodePacked("Void Shield +", Strings.toString(uint256(value))));
        if (t == RelicType.SPEED_BOOST)     return string(abi.encodePacked("Nebula Dash +", Strings.toString(uint256(value))));
        if (t == RelicType.HP_BOOST)        return string(abi.encodePacked("Echo Core +", Strings.toString(uint256(value))));
        if (t == RelicType.CRIT_CHANCE)     return string(abi.encodePacked("Flux Overload +", Strings.toString(uint256(value))));
        return string(abi.encodePacked("Last Stand +", Strings.toString(uint256(value))));
    }

    function uri(uint256 id) public view override returns (string memory) {
        RelicData memory r = relics[id];
        if (r.value == 0) return "";
        return super.uri(id);
    }

    function totalSupply() external view returns (uint256) {
        return _nextRelicId;
    }

    // ==================== SOULBOUND: DISABLE TRANSFERS ====================

    function safeTransferFrom(address, address, uint256, uint256, bytes memory) public pure override {
        revert("Soulbound: transfers are disabled");
    }

    function safeBatchTransferFrom(address, address, uint256[] memory, uint256[] memory, bytes memory) public pure override {
        revert("Soulbound: transfers are disabled");
    }
}