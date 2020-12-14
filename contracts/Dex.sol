pragma solidity 0.6.3;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Dex {
    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }

    mapping(bytes32 => Token) public tokens;
    bytes32[] public tokenList;

    // user => ticker => amount
    mapping(address => mapping(bytes32 => uint256)) public traderBalances;

    address public admin;

    constructor() public {
        admin = msg.sender;
    }

    // Registry: Add new token to the Dex's token registry
    function addToken(bytes32 ticker, address tokenAddress)
        external
        onlyAdmin()
    {
        tokens[ticker] = Token(ticker, tokenAddress);
        tokenList.push(ticker);
    }

    // Wallet: User to deposit token into the dex
    function deposit(uint256 amount, bytes32 ticker)
        external
        tokenExist(ticker)
    {
        IERC20(tokens[ticker].tokenAddress).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        traderBalances[msg.sender][ticker] += amount;
    }

    // Wallet: User to withdraw their token from the dex
    function withdraw(uint256 amount, bytes32 ticker)
        external
        tokenExist(ticker)
    {
        require(
            traderBalances[msg.sender][ticker] >= amount,
            "balance too low"
        );

        traderBalances[msg.sender][ticker] -= amount;
        IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);
    }

    modifier tokenExist(bytes32 ticker) {
        require(
            tokens[ticker].tokenAddress != address(0),
            "token does not exist"
        );
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }
}
