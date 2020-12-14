const { expectRevert } = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const Bat = artifacts.require("mocks/Bat.sol");
const Dai = artifacts.require("mocks/Dai.sol");
const Rep = artifacts.require("mocks/Rep.sol");
const Zrx = artifacts.require("mocks/Zrx.sol");
const Dex = artifacts.require("Dex.sol");

contract("Dex", (accounts) => {
  let bat, dai, dex, rep, zrx;

  const [BAT, DAI, REP, ZRX] = ["BAT", "DAI", "REP", "ZRX"].map((ticker) =>
    web3.utils.fromAscii(ticker)
  );

  const [trader1, trader2] = [accounts[1], accounts[2]];

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
    const amount = web3.utils.toWei("100");
    describe("deposit", () => {
      it("should deposit tokens if it exists in registry", async () => {
        await dex.deposit(amount, DAI, { from: trader1 });

        const balance = await dex.traderBalances(trader1, DAI);
        assert(balance.toString() === amount);
      });
      it("should not deposit tokens if it does not exists in registry", async () => {
        await expectRevert(
          dex.deposit(amount, web3.utils.fromAscii("some-unsupported-token"), {
            from: trader1,
          }),
          "token does not exist"
        );
      });
    });

    describe("withdraw", () => {
      it("should withdraw tokens if trader's balance is equal or greater than amount", async () => {
        await dex.deposit(amount, DAI, { from: trader1 });

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
          dex.withdraw(amount, web3.utils.fromAscii("some-unsupported-token"), {
            from: trader1,
          }),
          "token does not exist"
        );
      });
      it("should not withdraw tokens if trader's balance is less than amount", async () => {
        await dex.deposit(amount, DAI, { from: trader1 });

        await expectRevert(
          dex.withdraw(web3.utils.toWei("101"), DAI, { from: trader1 }),
          "balance too low"
        );

        const balance = await dex.traderBalances(trader1, DAI);
        assert(balance.toString() === amount);
      });
    });
  });
});
