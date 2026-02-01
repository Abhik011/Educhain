const path = require("path");
const { ethers } = require("ethers");

const artifactPath = path.join(
  __dirname,
  "../../../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json"
);

const contractJson = require(artifactPath);

// 🔐 Provider (Hardhat local)
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

// 🔑 Use ONE of the hardhat node private keys
const wallet = new ethers.Wallet(
  process.env.BLOCKCHAIN_PRIVATE_KEY,
  provider
);

// 📜 Contract instance
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  contractJson.abi,
  wallet
);

module.exports = {
  async issueCertificate({ certId, studentName, course, fileHash }) {
    const tx = await contract.issueCertificate(
      certId,
      studentName,
      course,
      fileHash
    );

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
    };
  },

  async verifyCertificate(certId) {
    return await contract.verifyCertificate(certId);
  },
};
