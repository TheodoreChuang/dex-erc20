pragma solidity 0.6.3;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Dex {
    using SafeMath for uint256;

    bytes32 constant DAI = bytes32("DAI");
    enum Side {BUY, SELL}

    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }

    struct Order {
        uint256 id;
        address trader;
        Side side;
        bytes32 ticker;
        uint256 amount;
        uint256 filled;
        uint256 price;
        uint256 date;
    }

    // Registry:
    // ticker => Token
    mapping(bytes32 => Token) public tokens;
    // ticker[]
    bytes32[] public tokenList;

    // Wallet: user => ticker => amount
    mapping(address => mapping(bytes32 => uint256)) public traderBalances;

    // ticker => Side => Order[] (sorted: BUY DESC, SELL ASC)
    mapping(bytes32 => mapping(uint256 => Order[])) public orderBook;
    uint256 public nextOrderId;
    uint256 public nextTradeId;

    address public admin;

    event NewTrade(
        uint256 tradeId,
        uint256 orderId,
        bytes32 indexed ticker,
        address indexed trader1,
        address indexed trader2,
        uint256 amount,
        uint256 price,
        uint256 date
    );

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

    // Registry: Get the list of tokens that can be traded
    function getTokens() external view returns (Token[] memory) {
        Token[] memory _tokens = new Token[](tokenList.length);
        for (uint256 i = 0; i < tokenList.length; i++) {
            _tokens[i] = Token(
                tokens[tokenList[i]].ticker,
                tokens[tokenList[i]].tokenAddress
            );
        }
        return _tokens;
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

        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker]
            .add(amount);
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

        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker]
            .sub(amount);
        IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);
    }

    // Trading: List of limit orders for a ticker and side
    function getOrders(bytes32 ticker, Side side)
        external
        view
        returns (Order[] memory)
    {
        return orderBook[ticker][uint256(side)];
    }

    // Trading
    function createLimitOrder(
        bytes32 ticker,
        uint256 amount,
        uint256 price,
        Side side
    ) external tokenExist(ticker) tokenIsNotDai(ticker) {
        if (side == Side.SELL) {
            require(
                traderBalances[msg.sender][ticker] >= amount,
                "token balance too low"
            );
        } else {
            require(
                traderBalances[msg.sender][DAI] >= amount.mul(price),
                "DAI balance too low"
            );
        }

        Order[] storage orders = orderBook[ticker][uint256(side)];
        orders.push(
            Order(nextOrderId, msg.sender, side, ticker, amount, 0, price, now)
        );

        // bubble sort (BUY DESC, SELL ASC)
        uint256 i = orders.length > 0 ? orders.length - 1 : 0;
        while (i > 0) {
            if (side == Side.BUY && orders[i - 1].price > orders[i].price) {
                break;
            }
            if (side == Side.SELL && orders[i - 1].price < orders[i].price) {
                break;
            }
            Order memory order = orders[i - 1];
            orders[i - 1] = orders[i];
            orders[i] = order;
            i = i.sub(1);
        }

        nextOrderId = nextOrderId.add(1);
    }

    // Trading
    function createMarketOrder(
        bytes32 ticker,
        uint256 amount,
        Side side
    ) external tokenExist(ticker) tokenIsNotDai(ticker) {
        if (side == Side.SELL) {
            require(
                traderBalances[msg.sender][ticker] >= amount,
                "token balance too low"
            );
        }
        Order[] storage orders = orderBook[ticker][uint256(
            side == Side.BUY ? Side.SELL : Side.BUY
        )];

        // Fill market order with existing limit orders
        uint256 i;
        uint256 remaining = amount;
        while (i < orders.length && remaining > 0) {
            uint256 available = orders[i].amount.sub(orders[i].filled);
            uint256 matched = (remaining > available) ? available : remaining;
            remaining = remaining.sub(matched);
            orders[i].filled = orders[i].filled.add(matched);
            emit NewTrade(
                nextTradeId,
                orders[i].id,
                ticker,
                orders[i].trader,
                msg.sender,
                matched,
                orders[i].price,
                now
            );

            if (side == Side.SELL) {
                traderBalances[msg.sender][ticker] = traderBalances[msg
                    .sender][ticker]
                    .sub(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg
                    .sender][DAI]
                    .add(matched.mul(orders[i].price));

                traderBalances[orders[i]
                    .trader][ticker] = traderBalances[orders[i].trader][ticker]
                    .add(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i]
                    .trader][DAI]
                    .sub(matched.mul(orders[i].price));
            }
            if (side == Side.BUY) {
                require(
                    traderBalances[msg.sender][DAI] >=
                        matched * orders[i].price,
                    "DAI balance too low"
                );
                traderBalances[msg.sender][ticker] = traderBalances[msg
                    .sender][ticker]
                    .add(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg
                    .sender][DAI]
                    .sub(matched.mul(orders[i].price));

                traderBalances[orders[i]
                    .trader][ticker] = traderBalances[orders[i].trader][ticker]
                    .sub(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i]
                    .trader][DAI]
                    .add(matched.mul(orders[i].price));
            }
            nextTradeId = nextTradeId.add(1);
            i = i.add(1);
        }

        // Prune order book of fully filled limit orders
        i = 0;
        while (i < orders.length && orders[i].filled == orders[i].amount) {
            for (uint256 j = i; j < orders.length - 1; j++) {
                orders[j] = orders[j + 1];
            }
            orders.pop();
            i = i.add(1);
        }
    }

    modifier tokenIsNotDai(bytes32 ticker) {
        require(ticker != DAI, "cannot trade DAI");
        _;
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
