import { useState, useEffect } from "react";

import { getContracts, getWeb3 } from "./utils";
import App from "./App";

const LoadingContainer = () => {
  const [web3, setWeb3] = useState(undefined);
  const [accounts, setAccounts] = useState([]);
  const [contracts, setContracts] = useState(undefined);

  useEffect(() => {
    (async () => {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      const contracts = await getContracts(web3);
      setWeb3(web3);
      setAccounts(accounts);
      setContracts(contracts);
    })();
  }, []);

  const isReady = () =>
    typeof web3 !== "undefined" &&
    typeof contracts !== "undefined" &&
    accounts.length > 0;

  if (!isReady()) return <div>Loading...</div>;

  return <App web3={web3} accounts={accounts} contracts={contracts} />;
};

export default LoadingContainer;
