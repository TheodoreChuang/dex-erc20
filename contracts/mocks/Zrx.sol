pragma solidity 0.6.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock Token
contract Zrx is ERC20 {
    constructor() public ERC20("0x token", "ZRX") {}

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
