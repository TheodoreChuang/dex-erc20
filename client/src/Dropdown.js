import { useState } from "react";
import PropTypes from "prop-types";

const Dropdown = ({ activeItem, items, onSelect }) => {
  const [visible, setVisible] = useState(false);

  const selectItem = (e, item) => {
    e.preventDefault();
    setVisible(!visible);
    onSelect(item);
  };

  return (
    <div className="dropdown ml-3">
      <button
        className="btn btn-secondary dropdown-toggle"
        type="button"
        onClick={() => setVisible(!visible)}
      >
        {activeItem.label}
      </button>
      <div className={`dropdown-menu ${visible ? "visible" : ""}`}>
        {items?.map((item, i) => (
          <a
            className={`dropdown-item ${
              item.value === activeItem.value ? "active" : null
            }`}
            href="#"
            key={i}
            onClick={(e) => selectItem(e, item.value)}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
};

Dropdown.propTypes = {
  activeItem: PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.object,
  }),
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.object,
    })
  ),
  onSelect: PropTypes.func.isRequired,
};

export default Dropdown;
