const ethers = require("ethers");
const common = require('./common')
const fs = require('fs')
const {abi,bytecode} = require('./contracts/abi/TokenDropbox.abi.js')

const contractName = 'TokenDropbox'

class Lockbox {

    static async init(config) {
        let me = new Lockbox()
        await me.initializeProvider(config)
        me.initializeContracts(config)
        return me
    }

    static async create(config) {
        let me = new Lockbox()
        await me.initializeProvider(config)
        await me.deployNewContract()
        console.log("created new contract at address: " + me.contract.address)
        return me
    }

    constructor() {

    }
    async deployNewContract() {
        const factory = new ethers.ContractFactory(abi, bytecode, this.signer);
        this.contract = await factory.deploy();
        await this.contract.deployed()
    }
    async initializeProvider(config) {
        await common.initializeProvider(this, config)
    }

    initializeContracts(config) {
        if (config.address) {
            this.contract = common.createContractAtAddress(this, contractName, config.address)
        } else {
            this.contract = common.createContract(this, contractName)
        }
    }

    async signAndApproveCertificate(amount, recipient, erc20Address) {
        let erc20Contract = common.createERC20Contract(this, erc20Address)
        let allowance = await erc20Contract.allowance(this.signer.address, this.contract.address)
        console.log('ALLOWANCE IS ' + allowance)
        //first approve only if existing allowance is less than amount
        if (allowance.lt(amount)) {
            console.log('allowance is less than ' + amount + ', approving first...')
            let tx = await erc20Contract.approve(this.contract.address, amount)
            await tx.wait()
            console.log('Done approve')
        }
        return await this.createSignedCertificate(amount, recipient, erc20Address)

    }

    async createSignedCertificate(amount, recipient, erc20Address) {
        let from = this.signer.address
        return await this.createCertificateFromAddress(amount, recipient, erc20Address, from)
    }

    async createSignedDelegateCertificate(amount, recipient, erc20Address, from) {
        let me = this.signer.address
        let isDelegate = await this.contract.delegates(from, me)
        if (!isDelegate) {
            throw new Error(me + " is not a valid delegate for " + from)
        }
        return await this.createCertificateFromAddress(amount, recipient, erc20Address, from)
    }

    async createCertificateFromAddress(amount, recipient, erc20Address, fromAddress) {
        let nonce = Date.now()
        let params = [amount, recipient, fromAddress, erc20Address, nonce]
        let certificateId = await this.contract.getCertificateHash(...params)
        let signature = await this.signCertificateHash(certificateId)
        let certificate = {
            recipient,
            from: fromAddress,
            erc20Address,
            amount,
            nonce,
            signature
        }
        return certificate
    }

    async signCertificateHash(certificateId) {
        let messageHashBytes = ethers.utils.arrayify(certificateId);
        return await this.signer.signMessage(messageHashBytes);
    }

    async addDelegate(address) {
        const tx = await this.contract.addDelegate(address)
        await tx.wait()
        return
    }

    async removeDelegate(address) {
        const tx = await this.contract.removeDelegate(address)
        await tx.wait()
        return
    }

    async approveToken(tokenAddress, amount) {
        let erc20Contract = common.createERC20Contract(this, tokenAddress)
        const tx = await erc20Contract.approve(this.contract.address, amount)
        await tx.wait()
        return tx
    }

    async checkCertificateClaimed(certificateId) {
        return await this.contract.certificateClaimed(certificateId)
    }

    async redeemCertificate(certificateData) {
        let {
            recipient,
            from,
            erc20Address,
            amount,
            nonce,
            signature
        } = certificateData
        let signerIsRecipient = (recipient.toLowerCase() === this.signer.address.toLowerCase())
        if (!signerIsRecipient) {
            throw new Error("Certificate Recipient (" + recipient + ") is NOT signer")
        }
        let isValidSignature = await this.contract.verifyCertificate(from, this.signer.address, erc20Address, amount, signature, nonce)
        if (!isValidSignature) {
            throw new Error("Signature invalid for certificate")
        }
        let approvedLimit = await this.approvedAmount(erc20Address, from)
        if (approvedLimit.lt(amount)) {
            throw new Error("Certificate Signer has not approved enough funds... Approved Amount: " + approvedLimit)
        }
        let tx = await this.contract.redeem(from, erc20Address, amount, nonce, signature)
        await tx.wait()
        return tx

    }
    
    updateSigner(wallet) { common.updateSigner(this, wallet); }
    exportABI(file) {
        //todo
        // let tokenfile = require('contracts/abi/TokenDropbox.abi')
        // tokenfile.networks = {}
        // fs.writeFileSync(file, JSON.stringify())
    }
}


module.exports = Lockbox