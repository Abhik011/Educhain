const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC = process.env.BLOCKCHAIN_RPC;
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CERTIFICATE_CONTRACT_ADDRESS;

/* ===========================
   SAFE GUARDS
=========================== */
if (!RPC) console.warn("⚠️ BLOCKCHAIN_RPC not set — blockchain disabled");
if (!PRIVATE_KEY)
  console.warn("⚠️ DEPLOYER_PRIVATE_KEY not set — blockchain disabled");
if (!CONTRACT_ADDRESS)
  console.warn(
    "⚠️ CERTIFICATE_CONTRACT_ADDRESS not set — blockchain disabled"
  );

/* ===========================
   LOAD ABI SAFELY
=========================== */
let abi = null;

try {
  const abiPath = path.join(
    __dirname,
    "../blockchain/abi/CertificateRegistry.json" // ✅ artifact file
  );

  const artifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  if (!Array.isArray(artifact.abi)) {
    throw new Error("ABI is not iterable");
  }

  abi = artifact.abi;
} catch (err) {
  console.warn("⚠️ ABI not found or invalid — blockchain disabled");
}

/* ===========================
   INIT CONTRACT
=========================== */
let contract = null;

if (RPC && PRIVATE_KEY && CONTRACT_ADDRESS && abi) {
  try {
    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

    console.log("🔗 Blockchain connected");
  } catch (err) {
    console.error("❌ Blockchain init failed:", err.message);
  }
}

/* ===========================
   ISSUE CERTIFICATE
=========================== */
async function issueCertificate({
  certId,
  studentName,
  course,
  fileHash,
}) {
  if (!contract) {
    console.warn("⚠️ Blockchain skipped (not configured)");
    return { txHash: "BLOCKCHAIN_DISABLED" };
  }

  const tx = await contract.issueCertificate(
    certId,
    studentName,
    course,
    fileHash
  );

  await tx.wait();

  return { txHash: tx.hash };
}

/* ===========================
   VERIFY CERTIFICATE
=========================== */
async function verifyCertificate(certId) {
  if (!contract) {
    return { verified: false, reason: "BLOCKCHAIN_DISABLED" };
  }

  const [id, studentName, course, issuedAt, issuedBy] =
    await contract.verifyCertificate(certId);

  return {
    verified: true,
    certId: id,
    studentName,
    course,
    issuedAt: Number(issuedAt),
    issuedBy,
  };
}

module.exports = {
  issueCertificate,
  verifyCertificate,
};
