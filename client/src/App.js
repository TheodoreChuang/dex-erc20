import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

import { SIDE } from "./constants";
import AllOrders from "./AllOrders";
import Header from "./Header";
import MyOrders from "./MyOrders";
import NewOrder from "./NewOrder";
import Wallet from "./Wallet";

const App = ({ web3, accounts, contracts }) => {
  const [tokens, setTokens] = useState([]);
  const [user, setUser] = useState({
    accounts: [],
    balances: {
      tokenDex: 0,
      tokenWallet: 0,
    },
    selectedToken: undefined,
  });
  const [orders, setOrders] = useState({
    buy: [],
    sell: [],
  });

  const getBalances = useCallback(
    async (account, token) => {
      const tokenDex = await contracts.dex.methods
        .traderBalances(account, web3.utils.fromAscii(token.ticker))
        .call();
      const tokenWallet = await contracts[token.ticker].methods
        .balanceOf(account)
        .call();
      return { tokenDex, tokenWallet };
    },
    [contracts, web3.utils]
  );

  const getOrders = useCallback(
    async (token) => {
      const [buy, sell] = await Promise.all([
        contracts.dex.methods
          .getOrders(web3.utils.fromAscii(token.ticker), SIDE.BUY)
          .call(),
        contracts.dex.methods
          .getOrders(web3.utils.fromAscii(token.ticker), SIDE.SELL)
          .call(),
      ]);
      return { buy, sell };
    },
    [contracts.dex.methods, web3.utils]
  );

  const selectToken = (token) => {
    setUser({ ...user, selectedToken: token });
  };

  // Wallet: User to deposit token into the dex
  const deposit = async (amount) => {
    await contracts[user.selectedToken.ticker].methods
      .approve(contracts.dex.options.address, amount)
      .send({ from: accounts[0] });

    await contracts.dex.methods
      .deposit(amount, web3.utils.fromAscii(user.selectedToken.ticker))
      .send({ from: accounts[0] });

    const balances = await getBalances(user.accounts[0], user.selectedToken);
    setUser((user) => ({ ...user, balances }));
  };

  // Wallet: User to withdraw their token from the dex
  const withdraw = async (amount) => {
    await contracts.dex.methods
      .withdraw(amount, web3.utils.fromAscii(user.selectedToken.ticker))
      .send({ from: accounts[0] });

    const balances = await getBalances(user.accounts[0], user.selectedToken);
    setUser((user) => ({ ...user, balances }));
  };

  const createLimitOrder = async (amount, price, side) => {
    await contracts.dex.methods
      .createLimitOrder(
        web3.utils.fromAscii(user.selectedToken.ticker),
        amount,
        price,
        side
      )
      .send({ from: user.accounts[0] });

    const orders = await getOrders(user.selectedToken);
    setOrders(orders);
  };

  const createMarketOrder = async (amount, side) => {
    await contracts.dex.methods
      .createMarketOrder(
        web3.utils.fromAscii(user.selectedToken.ticker),
        amount,
        side
      )
      .send({ from: user.accounts[0] });

    const orders = await getOrders(user.selectedToken);
    setOrders(orders);
  };

  useEffect(() => {
    (async () => {
      const rawTokens = await contracts.dex.methods.getTokens().call();
      const tokens = rawTokens.map((token) => ({
        ...token,
        ticker: web3.utils.hexToUtf8(token.ticker),
      }));
      const [balances, orders] = await Promise.all([
        getBalances(accounts[0], tokens[0]),
        getOrders(tokens[0]),
      ]);

      setTokens(tokens);
      setUser({ accounts, balances, getBalances, selectedToken: tokens[0] });
      setOrders(orders);
    })();
  }, [accounts, contracts.dex.methods, getBalances, getOrders, web3.utils]);

  useEffect(() => {
    if (typeof user.selectedToken !== "undefined") {
      (async () => {
        const [balances, orders] = await Promise.all([
          getBalances(accounts[0], user.selectedToken),
          getOrders(user.selectedToken),
        ]);
        setUser((user) => ({ ...user, balances }));
        setOrders(orders);
      })();
    }
  }, [accounts, getBalances, getOrders, user.selectedToken]);

  if (typeof user.selectedToken === "undefined") {
    return <div>Loading...</div>;
  }

  return (
    <div id="app">
      <Header
        user={user}
        tokens={tokens}
        contracts={contracts}
        selectToken={selectToken}
      />
      <main className="container-fluid">
        <div className="row">
          <div className="col-sm-4 first-col">
            <Wallet deposit={deposit} withdraw={withdraw} user={user} />
            {user.selectedToken.ticker !== "DAI" && (
              <NewOrder
                createLimitOrder={createLimitOrder}
                createMarketOrder={createMarketOrder}
              />
            )}
          </div>

          {user.selectedToken.ticker !== "DAI" && (
            <div className="col-sm-8">
              <AllOrders orders={orders} />
              <MyOrders
                orders={{
                  buy: orders.buy.filter(
                    (order) =>
                      order.trader.toLowerCase() ===
                      user.accounts[0].toLowerCase()
                  ),
                  sell: orders.sell.filter(
                    (order) =>
                      order.trader.toLowerCase() ===
                      user.accounts[0].toLowerCase()
                  ),
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

App.propTypes = {
  web3: PropTypes.object,
  accounts: PropTypes.arrayOf(PropTypes.string),
  contracts: PropTypes.object,
};

export default App;
