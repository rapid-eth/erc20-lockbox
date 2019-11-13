const _ = require('lodash')
const ethers = require("ethers");
const IPFS = require('ipfs-http-client')

const contractsABIDirectory = `./contracts/abi`

const initializeProvider = async (self, config) => {
    let w3
    try {
        if (web3) {
            w3 = web3
        }
    } catch (error) {
        
    }
    if (w3) {
        self.provider = new ethers.providers.Web3Provider(web3.currentProvider);
    } else {
        // let infuraURL = 'https://rinkeby.infura.io/v3/9dd73bc075d441f684db7bc34f4e5950'
        self.provider = new ethers.providers.JsonRpcProvider(config.providerURL);
    }
    self.network = await self.provider.getNetwork()
    self.ipfs = new IPFS('ipfs.infura.io', '5001', { protocol: 'https' })
    self.contracts = {}
    self.contractAddresses = require('./networkAddresses.json')[self.network.chainId.toString()]
    if (config.wallet) {
        self.signer = config.wallet.connect(self.provider)
    } else {
        console.log('meta signer')
        self.signer = await self.provider.getSigner(); //works with metamask
    }
}

const initializeContracts = (self, contractNames) => {
        _.forEach(contractNames, (name) => {
        const abi = require(`${contractsABIDirectory}/${name}.abi.js`).abi
        const address = self.contractAddresses[name]
        self.contracts[name] = new ethers.Contract(address, abi, self.provider)
    })
}

const initializeContractAtAddress = (self, name, address) => {
    const abi = require(`${contractsABIDirectory}/${name}.abi.js`).abi
    self.contracts[name] = new ethers.Contract(address, abi, self.provider)
}

const createContractAtAddress = (self, name, address) => {
    const abi = require(`${contractsABIDirectory}/${name}.abi.js`).abi
    return new ethers.Contract(address, abi, self.signer)
}

const createContract = (self, name) => {
    const abi = require(`${contractsABIDirectory}/${name}.abi.js`).abi
    return new ethers.Contract(self.contractAddresses[name], abi, self.signer)
}

const createERC20Contract = (self, address) => {
    const abi = require(`${contractsABIDirectory}/ERC20.abi.js`).abi
    return new ethers.Contract(address, abi, self.signer)
}

const callContract = async (contract, func, params, signer) => {
    let contractWithSigner = contract.connect(signer)
    let response = await contractWithSigner.functions[func](...params)
    return response
}

const contractFromABI = (self, abi, address) => {
    if (typeof abi === 'string') {
        abi = require(`${contractsABIDirectory}/${abi}.abi.js`)
    }
    return new ethers.Contract(address, abi, self.signer)
}

const updateSigner = (self, wallet) => {
    self.signer = wallet.connect(self.provider)
}

module.exports = {
    initializeProvider,
    initializeContracts,
    initializeContractAtAddress,
    createContractAtAddress,
    callContract,
    contractFromABI,
    createContract,
    createERC20Contract,
    updateSigner
}