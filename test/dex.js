const { expectRevert } = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const Bat = artifacts.require("mocks/Bat.sol");
const Dai = artifacts.require("mocks/Dai.sol");
const Rep = artifacts.require("mocks/Rep.sol");
const Zrx = artifacts.require("mocks/Zrx.sol");
const Dex = artifacts.require("Dex.sol");

const SIDE = {
  BUY: 0,
  SELL: 1,
};

contract("Dex", (accounts) => {
  let dex;
  let bat, dai, rep, zrx;

  const [BAT, DAI, REP, ZRX] = ["BAT", "DAI", "REP", "ZRX"].map((ticker) =>
    web3.utils.fromAscii(ticker)
  );

  const [trader1, trader2] = [accounts[1], accounts[2]];
  const tradeAmount = web3.utils.toWei("100");

  /** Test utils */
  const initialBalance = web3.utils.toWei("1000");
  const initialTokenBalance = async (token, trader) => {
    await token.faucet(trader, initialBalance);
    await token.approve(dex.address, initialBalance, {
      from: trader,
    });
  };

  beforeEach(async () => {
    [bat, dai, rep, zrx] = await Promise.all([
      Bat.new(),
      Dai.new(),
      Rep.new(),
      Zrx.new(),
    ]);

    dex = await Dex.new();
    await Promise.all([
      dex.addToken(BAT, bat.address),
      dex.addToken(DAI, dai.address),
      dex.addToken(REP, rep.address),
      dex.addToken(ZRX, zrx.address),
    ]);

    await Promise.all(
      [bat, dai, rep, zrx].map((token) => initialTokenBalance(token, trader1))
    );
    await Promise.all(
      [bat, dai, rep, zrx].map((token) => initialTokenBalance(token, trader2))
    );
  });

  describe("Wallet functionality", () => {
    describe("deposit", () => {
      it("should deposit tokens if it exists in registry", async () => {
        await dex.deposit(tradeAmount, DAI, { from: trader1 });

        const balance = await dex.traderBalances(trader1, DAI);
        assert(balance.toString() === tradeAmount);
      });
      it("should not deposit tokens if it does not exists in registry", async () => {
        await expectRevert(
          dex.deposit(
            tradeAmount,
            web3.utils.fromAscii("some-unsupported-token"),
            {
              from: trader1,
            }
          ),
          "token does not exist"
        );
      });
    });

    describe("withdraw", () => {
      it("should withdraw tokens if trader's balance is equal or greater than amount", async () => {
        await dex.deposit(tradeAmount, DAI, { from: trader1 });

        await dex.withdraw(web3.utils.toWei("70"), DAI, { from: trader1 });
        await dex.withdraw(web3.utils.toWei("30"), DAI, { from: trader1 });

        const [balanceDex, balanceDai] = await Promise.all([
          dex.traderBalances(trader1, DAI),
          dai.balanceOf(trader1),
        ]);
        assert(balanceDex.isZero());
        assert(balanceDai.toString() === initialBalance);
      });
      it("should not withdraw tokens if it does not exists in registry", async () => {
        await expectRevert(
          dex.withdraw(
            tradeAmount,
            web3.utils.fromAscii("some-unsupported-token"),
            {
              from: trader1,
            }
          ),
          "token does not exist"
        );
      });
      it("should not withdraw tokens if trader's balance is less than amount", async () => {
        await dex.deposit(tradeAmount, DAI, { from: trader1 });

        await expectRevert(
          dex.withdraw(web3.utils.toWei("101"), DAI, { from: trader1 }),
          "balance too low"
        );

        const balance = await dex.traderBalances(trader1, DAI);
        assert(balance.toString() === tradeAmount);
      });
    });
  });

  describe("Trading", () => {
    describe("Create limit order", () => {
      it("should create BUY limit orders in DESC order", async () => {
        // Order 1
        await dex.deposit(tradeAmount, DAI, { from: trader1 });

        await dex.createLimitOrder(REP, web3.utils.toWei("10"), 10, SIDE.BUY, {
          from: trader1,
        });

        let buyOrders = await dex.getOrders(REP, SIDE.BUY);
        let sellOrders = await dex.getOrders(REP, SIDE.SELL);
        assert(buyOrders.length === 1);
        assert(buyOrders[0].trader === trader1);
        assert(buyOrders[0].ticker === web3.utils.padRight(REP, 64));
        assert(buyOrders[0].price === "10");
        assert(buyOrders[0].amount === web3.utils.toWei("10"));
        assert(sellOrders.length === 0);

        // Order 2
        await dex.deposit(web3.utils.toWei("200"), DAI, { from: trader2 });

        await dex.createLimitOrder(REP, web3.utils.toWei("10"), 11, SIDE.BUY, {
          from: trader2,
        });

        buyOrders = await dex.getOrders(REP, SIDE.BUY);
        sellOrders = await dex.getOrders(REP, SIDE.SELL);
        assert(buyOrders.length === 2);
        assert(buyOrders[0].trader === trader2);
        assert(buyOrders[1].trader === trader1);
        assert(sellOrders.length === 0);

        // Order 3
        await dex.createLimitOrder(REP, web3.utils.toWei("10"), 9, SIDE.BUY, {
          from: trader2,
        });

        buyOrders = await dex.getOrders(REP, SIDE.BUY);
        sellOrders = await dex.getOrders(REP, SIDE.SELL);
        assert(buyOrders.length === 3);
        assert(buyOrders[0].trader === trader2);
        assert(buyOrders[1].trader === trader1);
        assert(buyOrders[2].trader === trader2);
        assert(buyOrders[2].price === "9");
        assert(sellOrders.length === 0);
      });
      it("should create SELL limit orders in ASC order", async () => {
        // Order 1
        await dex.deposit(tradeAmount, ZRX, { from: trader1 });

        await dex.createLimitOrder(ZRX, web3.utils.toWei("10"), 10, SIDE.SELL, {
          from: trader1,
        });

        let sellOrders = await dex.getOrders(ZRX, SIDE.SELL);
        let buyOrders = await dex.getOrders(ZRX, SIDE.BUY);
        assert(sellOrders.length === 1);
        assert(sellOrders[0].trader === trader1);
        assert(sellOrders[0].ticker === web3.utils.padRight(ZRX, 64));
        assert(sellOrders[0].price === "10");
        assert(sellOrders[0].amount === web3.utils.toWei("10"));
        assert(buyOrders.length === 0);

        // Order 2
        await dex.deposit(web3.utils.toWei("200"), ZRX, { from: trader2 });

        await dex.createLimitOrder(ZRX, web3.utils.toWei("10"), 9, SIDE.SELL, {
          from: trader2,
        });

        sellOrders = await dex.getOrders(ZRX, SIDE.SELL);
        buyOrders = await dex.getOrders(ZRX, SIDE.BUY);
        assert(sellOrders.length === 2);
        assert(sellOrders[0].trader === trader2);
        assert(sellOrders[1].trader === trader1);
        assert(buyOrders.length === 0);

        // Order 3
        await dex.createLimitOrder(ZRX, web3.utils.toWei("10"), 11, SIDE.SELL, {
          from: trader2,
        });

        sellOrders = await dex.getOrders(ZRX, SIDE.SELL);
        buyOrders = await dex.getOrders(ZRX, SIDE.BUY);
        assert(sellOrders.length === 3);
        assert(sellOrders[0].trader === trader2);
        assert(sellOrders[1].trader === trader1);
        assert(sellOrders[2].trader === trader2);
        assert(sellOrders[2].price === "11");
        assert(buyOrders.length === 0);
      });
      it("should not create a limit order for a unregistered token", async () => {
        await expectRevert(
          dex.createLimitOrder(
            web3.utils.fromAscii("unregistered-token"),
            web3.utils.toWei("1"),
            1,
            SIDE.BUY,
            { from: trader1 }
          ),
          "token does not exist"
        );
      });
      it("should not create a limit order if token is DAI", async () => {
        await expectRevert(
          dex.createLimitOrder(DAI, web3.utils.toWei("1"), 1, SIDE.BUY, {
            from: trader1,
          }),
          "cannot trade DAI"
        );
      });
      it("should not create BUY limit order if DAI balance is too low", async () => {
        await dex.deposit(tradeAmount, DAI, { from: trader1 });

        await expectRevert(
          dex.createLimitOrder(ZRX, web3.utils.toWei("11"), 10, SIDE.BUY, {
            from: trader1,
          }),
          "DAI balance too low"
        );
      });
      it("should not create SELL limit order if token balance is too low", async () => {
        await dex.deposit(tradeAmount, ZRX, { from: trader1 });

        await expectRevert(
          dex.createLimitOrder(ZRX, web3.utils.toWei("101"), 10, SIDE.SELL, {
            from: trader1,
          }),
          "token balance too low"
        );
      });
    });

    describe("Create market order", () => {
      it("should execute a market order and match against existing limit order(s)", async () => {
        // Limit order buying 10 REP
        await dex.deposit(tradeAmount, DAI, { from: trader1 });
        await dex.createLimitOrder(REP, web3.utils.toWei("10"), 10, SIDE.BUY, {
          from: trader1,
        });
        await dex.deposit(tradeAmount, REP, { from: trader2 });

        // Market order selling 5 REP
        await dex.createMarketOrder(REP, web3.utils.toWei("5"), SIDE.SELL, {
          from: trader2,
        });

        const balances = await Promise.all([
          dex.traderBalances(trader1, DAI),
          dex.traderBalances(trader1, REP),
          dex.traderBalances(trader2, DAI),
          dex.traderBalances(trader2, REP),
        ]);
        const orders = await dex.getOrders(REP, SIDE.BUY);
        assert(orders[0].filled === web3.utils.toWei("5"));
        assert(balances[0].toString() === web3.utils.toWei("50"));
        assert(balances[1].toString() === web3.utils.toWei("5"));
        assert(balances[2].toString() === web3.utils.toWei("50"));
        assert(balances[3].toString() === web3.utils.toWei("95"));
      });
      it("should not create a market order for a unregistered token", async () => {
        await expectRevert(
          dex.createMarketOrder(
            web3.utils.fromAscii("unregistered-token"),
            web3.utils.toWei("1"),
            SIDE.BUY,
            { from: trader1 }
          ),
          "token does not exist"
        );
      });
      it("should not create a market order if token is DAI", async () => {
        await expectRevert(
          dex.createMarketOrder(DAI, web3.utils.toWei("1"), SIDE.BUY, {
            from: trader1,
          }),
          "cannot trade DAI"
        );
      });
      it("should not create SELL market order if token balance is too low", async () => {
        await dex.deposit(tradeAmount, ZRX, { from: trader1 });

        await expectRevert(
          dex.createMarketOrder(ZRX, web3.utils.toWei("101"), SIDE.SELL, {
            from: trader1,
          }),
          "token balance too low"
        );
      });
      it("should not create BUY market order if DAI balance is too low", async () => {
        await dex.deposit(tradeAmount, BAT, { from: trader1 });
        await dex.createLimitOrder(BAT, web3.utils.toWei("10"), 5, SIDE.SELL, {
          from: trader1,
        });

        await expectRevert(
          dex.createMarketOrder(BAT, web3.utils.toWei("1"), SIDE.BUY, {
            from: trader2,
          }),
          "DAI balance too low"
        );
      });
    });
  });
});
