pragma solidity ^0.5.0;

import "./token/ERC20/IERC20.sol";
import "./cryptography/ECDSA.sol";
import "./math/SafeMath.sol";

contract TokenDropbox{

    using ECDSA for bytes32;
    using SafeMath for uint256;

    mapping (bytes32 => bool) public certificateClaimed;
    mapping (address => mapping (address => bool)) public delegates;

    /************
     * PUBLIC FUNCTIONS
     ***********/

    /// Redeem
    function redeem(
        address _from,
        address _erc20,
        uint256 _amount,
        uint256 _nonce,
        bytes calldata _signature)
        external
    {
        // Recreate hash from params
        bytes32 certHash = getCertificateHash(_amount, msg.sender, _from, _erc20, _nonce);

        // Verify signature is valid for the hash
        require(_verifySignature(certHash, _signature, _from), "Certificate Signature Not Valid");
        //require(verifyCertificate(_from, msg.sender, _erc20, _amount, _nonce, _signature), "Certificate Signature Not Valid");

        // Verify that certificate is not already claimed
        require(!certificateClaimed[certHash], "Certificate already claimed");

        // Mark Claimed and transfer to recipient
        certificateClaimed[certHash] = true;
        IERC20 ERC20 = IERC20(_erc20);
        require(ERC20.transferFrom(_from, msg.sender, _amount), "Transfer Failed");
    }

    /// Redeem
    function redeemSigned(
        address _to,
        address _from,
        address _erc20,
        uint256 _amount,
        uint256 _nonce,
        bytes calldata _certSignature,
        bytes calldata _sig2
    )
        external
    {
        // Recreate hash from params
        bytes32  certHash = getCertificateHash(_amount, _to, _from, _erc20, _nonce);

        // Verify signature is valid for the hash
        // require(_verifySignature(certHash, _signature, _from), "Certificate Signature Not Valid");
        require(_verifySignature(certHash, _certSignature, _from), "Certificate Signature Not Valid");
        // Verify that certificate is not already claimed
        require(!certificateClaimed[certHash], "Certificate already claimed");

        // Verify that the original certificate was signed over to the new redeemer from the original _to address in the cert
        require(procurationSigner(_certSignature, _sig2, msg.sender)==_to, "");

        // Mark Claimed and transfer to recipient
        certificateClaimed[certHash] = true;
        IERC20 ERC20 = IERC20(_erc20);
        require(ERC20.transferFrom(_from, msg.sender, _amount), "Transfer Failed");
    }

    function addAdminDelegate(address _delegate) external {
        delegates[msg.sender][_delegate] = true;
    }

    function removeAdminDelegate(address _delegate) external {
        delegates[msg.sender][_delegate] = false;
    }

    /************
     * VIEW FUNCTIONS
     ***********/

    /// Create Unsigned Certificate Hash
    function getCertificateHash(
        uint256 _amount,
        address _recipient,
        address _holder,
        address _erc20,
        uint256 _nonce)
        public view returns (bytes32)
    {
        return keccak256(abi.encodePacked(address(this), _amount, _recipient, _holder, _erc20, _nonce));
    }

    /// Check Certificate Valid
    function verifyCertificate(
        address _from,
        address _recipient,
        address _erc20,
        uint256 _amount,
        uint256 _nonce,
        bytes memory _signature
    )
       public view returns (bool)
    {
        bytes32 certHash = getCertificateHash(_amount, _recipient, _from, _erc20, _nonce);
        return _verifySignature(certHash, _signature, _from);
    }

    function procurationSigner(
        bytes memory _certificateSignature,
        bytes memory _procurationSigature,
        address _newRedeemer
    )
       public pure returns (address)
    {
        bytes32 h = keccak256(abi.encodePacked(_certificateSignature,_newRedeemer));
        return h.toEthSignedMessageHash().recover(_procurationSigature);
    }

    /************
     * INTERNAL FUNCTIONS
     ***********/

    /// Verify signed hash
    function _verifySignature(
        bytes32 _hash,
        bytes memory _signature,
        address _from)
        internal view returns (bool)
    {
        address signer = _hash.toEthSignedMessageHash().recover(_signature);
        if (signer == _from) {
            return true;
        }
        return delegates[_from][signer];
    }
}