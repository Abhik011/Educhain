const express = require("express");
const { ethers } = require("ethers");

const router = express.Router();

const abi = [
  "function verifyCertificate(string) view returns (string,string,string,uint256,address)"
];

const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  abi,
  provider
);

router.get("/:certId", async (req, res) => {
  try {
    const data = await contract.verifyCertificate(req.params.certId);

    res.json({
      studentName: data[0],
      course: data[1],
      certHash: data[2],
      issuedAt: new Date(Number(data[3]) * 1000),
      issuedBy: data[4],
    });
  } catch {
    res.status(404).json({ message: "Invalid certificate" });
  }
});

router.get("/verify/:value", async (req, res) => {
  try {
    const value = req.params.value;

    // 1️⃣ Find certificate by certId OR tx hash
    const cert = await Certificate.findOne({
      $or: [
        { certId: value },
        { blockchainTx: value },
      ],
    }).populate("collegeId", "name");

    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    // 2️⃣ Verify on blockchain
    const chainData = await blockchain.verifyCertificate(cert.certId);

    // 3️⃣ Respond with FULL DATA
    res.json({
      verified: true,
      certId: cert.certId,
      studentName: cert.studentName,
      course: cert.course,
      rollNumber: cert.rollNumber,
      year: cert.year,
      college: cert.collegeId.name,
      txHash: cert.blockchainTx,
      issuedAt: cert.issuedAt,
      blockchain: chainData,
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: "Invalid or unverified certificate" });
  }
});


module.exports = router;
