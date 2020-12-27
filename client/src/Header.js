import PropTypes from "prop-types";

import Dropdown from "./Dropdown";

const Header = ({ user, tokens, contracts, selectToken }) => (
  <header id="header" className="card">
    <div className="row">
      <div className="col-sm-3 flex">
        <Dropdown
          activeItem={{
            label: user.selectedToken.ticker,
            value: user.selectedToken,
          }}
          items={tokens.map((token) => ({
            label: token.ticker,
            value: token,
          }))}
          onSelect={selectToken}
        />
      </div>
      <div className="col-sm-9 flex">
        <h1 className="header-title">
          Dex -{" "}
          <span className="contract-adddress">
            Contract Address:{" "}
            <span className="address">{contracts.dex.options.address}</span>
          </span>
        </h1>
      </div>
    </div>
  </header>
);

Header.propTypes = {
  user: PropTypes.shape({
    selectedToken: PropTypes.shape({
      ticker: PropTypes.string,
    }),
  }),
  tokens: PropTypes.arrayOf(PropTypes.object),
  contracts: PropTypes.shape({
    dex: PropTypes.shape({
      options: PropTypes.shape({
        address: PropTypes.string,
      }),
    }),
  }),
  selectToken: PropTypes.func,
};

export default Header;
