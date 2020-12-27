import { useState, useEffect } from "react";
import PropTypes from "prop-types";

import Header from "./Header";

const App = ({ web3, accounts, contracts }) => {
  const [tokens, setTokens] = useState([]);
  const [user, setUser] = useState({
    accounts: [],
    selectedToken: undefined,
  });

  const selectToken = (token) => {
    setUser({ ...user, selectedToken: token });
  };

  useEffect(() => {
    (async () => {
      const rawTokens = await contracts.dex.methods.getTokens().call();
      const tokens = rawTokens.map((token) => ({
        ...token,
        ticker: web3.utils.hexToUtf8(token.ticker),
      }));
      setTokens(tokens);
      setUser({ accounts, selectedToken: tokens[0] });
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
    </div>
  );
};

App.propTypes = {
  web3: PropTypes.object,
  accounts: PropTypes.arrayOf(PropTypes.string),
  contracts: PropTypes.object,
};

export default App;
