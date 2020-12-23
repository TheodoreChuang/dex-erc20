const Bat = artifacts.require("mocks/Bat.sol");
const Dai = artifacts.require("mocks/Dai.sol");
const Rep = artifacts.require("mocks/Rep.sol");
const Zrx = artifacts.require("mocks/Zrx.sol");
const Dex = artifacts.require("Dex.sol");

const [BAT, DAI, REP, ZRX] = ["BAT", "DAI", "REP", "ZRX"].map((ticker) =>
  web3.utils.fromAscii(ticker)
);

// Deploy Dex and mock ERC20 contracts
module.exports = async (deployer) => {
  await Promise.all(
    [Bat, Dai, Rep, Zrx, Dex].map((contract) => deployer.deploy(contract))
  );

  const [bat, dai, rep, zrx, dex] = await Promise.all(
    [Bat, Dai, Rep, Zrx, Dex].map((contract) => contract.deployed())
  );

  await Promise.all([
    dex.addToken(BAT, bat.address),
    dex.addToken(DAI, dai.address),
    dex.addToken(REP, rep.address),
    dex.addToken(ZRX, zrx.address),
  ]);
};
