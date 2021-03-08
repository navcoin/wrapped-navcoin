pragma solidity ^0.6.0;

import "@openzeppelin/contracts-upgradeable/presets/ERC20PresetMinterPauserUpgradeable.sol";

contract WNAV is ERC20PresetMinterPauserUpgradeable {

    address private _owner;
    address private _feeAddress;
    uint256 private _withdrawalFee;

    function initialize(string memory name, string memory symbol)
        public
        initializer
        override
    {
        __ERC20PresetMinterPauser_init(name, symbol);

        _feeAddress = msg.sender;
        _withdrawalFee = 1000000;
        _setupDecimals(8);
    }

    event BurnedWithNote(address indexed a, uint256 v, string n);

    function burnWithNote(uint256 _value, string memory _note) public {
        require(_value > _withdrawalFee);
        super.burn(_value);
        emit BurnedWithNote(msg.sender, _value, _note);
    }

    mapping (string => bool) mints;

    event MintedWithNote(address indexed a, uint256 v, string n, uint256 f);

    function mint(address _to, uint256 _amount, string memory _note, uint256 _fee) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "ERROR: must have minter role to mint");
        require(!existsMint(_note));
        require(isRegistered(_to));
        super._mint(_to, _amount);
        if (_fee != 0x0)
        {
          super._mint(_feeAddress, _fee);
        }
        mints[_note] = true;
        emit MintedWithNote(_to, _amount, _note, _fee);
    }

    function setFeeAddress(address _to) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "ERROR: must have admin role");
        _feeAddress = _to;
    }

    function setMinFee(uint256 _fee) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "ERROR: must have admin role");
        _withdrawalFee = _fee;
    }

    function existsMint(string memory _note) public view returns (bool) {
        return mints[_note] == true;
    }

    mapping (address => bool) navAddresses;

    event Registered(address indexed a);

    function register() public {
        require(!isRegistered(msg.sender));
        navAddresses[msg.sender] = true;
        emit Registered(msg.sender);
    }

    function isRegistered(address _native) public view returns (bool) {
        return navAddresses[_native] == true;
    }
}

