import { useState, useEffect } from "react";
import PropTypes from "prop-types";

import Header from "./Header";
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

  const getBalances = async (account, token) => {
    const tokenDex = await contracts.dex.methods
      .traderBalances(account, web3.utils.fromAscii(token.ticker))
      .call();
    const tokenWallet = await contracts[token.ticker].methods
      .balanceOf(account)
      .call();
    return { tokenDex, tokenWallet };
  };

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

  useEffect(() => {
    (async () => {
      const rawTokens = await contracts.dex.methods.getTokens().call();
      const tokens = rawTokens.map((token) => ({
        ...token,
        ticker: web3.utils.hexToUtf8(token.ticker),
      }));
      const balances = await getBalances(accounts[0], tokens[0]);

      setTokens(tokens);
      setUser({ accounts, balances, getBalances, selectedToken: tokens[0] });
    })();
  }, [accounts, contracts.dex.methods, web3.utils]);

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
          </div>
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
