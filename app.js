/* ============================================================
   app.js — Nezer Network Staking DApp
   ============================================================ */

/* ── CONTRACT ADDRESSES ── */
const STAKING_ADDRESS = "0xD7ACd2a9FD159E69Bb102A1ca21C9a3e3A5F771B";
const TOKEN_ADDRESS   = "0xf8e81D47203A594245E36C48e151709F0C19fBe8";

/* ── CONTRACT ABIs ── */
const STAKING_ABI = [
  "function stake(uint256 amount)",
  "function unstake(uint256 amount)",
  "function claimReward()",
  "function totalStaked() view returns(uint256)",
  "function staked(address) view returns(uint256)",   // per-user stake
  "function rewards(address) view returns(uint256)"   // per-user reward
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) returns(bool)"
];

/* ── STATE ── */
let provider, signer, stakingContract, tokenContract;
let isConnected = false;

/* ============================================================
   TOAST NOTIFICATION
   Shows a small popup at the bottom of the screen
   type: "info" | "success" | "error"
   ============================================================ */
function showToast(msg, type = "info", duration = 3500) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = "toast"; }, duration);
}

/* ============================================================
   WALLET GUARD
   Stops any action if wallet is not connected yet
   ============================================================ */
function requireWallet() {
  if (!isConnected) {
    showToast("Please connect your wallet first", "error");
    // Shake the connect button to draw attention
    const btn = document.getElementById("connectBtn");
    btn.style.animation = "shake 0.3s ease";
    setTimeout(() => { btn.style.animation = ""; }, 400);
    return false;
  }
  return true;
}

/* ============================================================
   CONNECT WALLET
   Triggered by the "Connect Wallet" button
   ============================================================ */
async function connectWallet() {
  try {
    // Check MetaMask is installed
    if (!window.ethereum) {
      showToast("MetaMask not detected. Please install it.", "error");
      return;
    }

    // Show loading state on button
    const btn = document.getElementById("connectBtn");
    btn.innerHTML = '<span class="spinner"></span>CONNECTING...';
    btn.disabled = true;

    // Connect to MetaMask
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();

    // Create contract instances
    stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, signer);
    tokenContract   = new ethers.Contract(TOKEN_ADDRESS,   TOKEN_ABI,   signer);

    // Get wallet address and network
    const address = await signer.getAddress();
    const network = await provider.getNetwork();
    const shortAddr = address.slice(0, 6) + "..." + address.slice(-4);

    // Update UI to show connected state
    isConnected = true;
    btn.textContent = shortAddr;
    btn.style.background = "linear-gradient(135deg, #1a3a26, #2fbd62)";

    document.getElementById("walletStatus").textContent = "CONNECTED";
    document.getElementById("walletStatus").className = "wallet-status connected";
    document.getElementById("networkName").textContent = network.name.toUpperCase();
    document.getElementById("userStats").style.display = "grid";

    showToast("Wallet connected ✓", "success");

    // Load on-chain data for this user
    loadData(address);

    // Reload page if user switches accounts or network in MetaMask
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged",    () => location.reload());

  } catch (error) {
    // Reset button if something went wrong
    const btn = document.getElementById("connectBtn");
    btn.textContent = "CONNECT WALLET";
    btn.disabled = false;
    showToast(error.message || "Connection failed", "error");
  }
}

/* ============================================================
   LOAD ON-CHAIN DATA
   Reads totalStaked, user's stake, and user's pending reward
   ============================================================ */
async function loadData(address) {
  try {
    // Fetch all 3 values at the same time (faster)
    const [total, userStake, userReward] = await Promise.all([
      stakingContract.totalStaked(),
      stakingContract.staked(address),
      stakingContract.rewards(address)
    ]);

    // Helper: convert from wei to readable number with 2 decimals
    const fmt = (val) => parseFloat(ethers.utils.formatEther(val)).toFixed(2);

    // Update the UI
    document.getElementById("totalStaked").textContent    = fmt(total);
    document.getElementById("userStaked").textContent     = fmt(userStake);
    document.getElementById("pendingReward").textContent  = fmt(userReward);
    document.getElementById("claimAmount").textContent    = fmt(userReward) + " NZR";

  } catch (error) {
    // Contract may not be deployed on this network
    document.getElementById("totalStaked").textContent = "—";
    console.error("loadData error:", error);
  }
}

/* ============================================================
   STAKE
   1. Approves the staking contract to spend user's tokens
   2. Calls stake() on the staking contract
   ============================================================ */
async function stake() {
  if (!requireWallet()) return;

  const raw = document.getElementById("amount").value;
  if (!raw || parseFloat(raw) <= 0) {
    showToast("Enter a valid amount", "error");
    return;
  }

  try {
    const value = ethers.utils.parseEther(raw);

    // Step 1: Approve
    showToast("Approving token transfer...", "info", 8000);
    const approval = await tokenContract.approve(STAKING_ADDRESS, value);
    await approval.wait();

    // Step 2: Stake
    showToast("Staking in progress...", "info", 8000);
    const tx = await stakingContract.stake(value);
    await tx.wait();

    showToast("Stake successful ✓", "success");
    document.getElementById("amount").value = "";
    loadData(await signer.getAddress());

  } catch (error) {
    // error.reason gives the Solidity revert message e.g. "invalid"
    showToast(error.reason || error.message || "Stake failed", "error");
  }
}

/* ============================================================
   UNSTAKE
   Returns staked tokens back to the user's wallet
   ============================================================ */
async function unstake() {
  if (!requireWallet()) return;

  const raw = document.getElementById("amount").value;
  if (!raw || parseFloat(raw) <= 0) {
    showToast("Enter a valid amount", "error");
    return;
  }

  try {
    showToast("Unstaking in progress...", "info", 8000);
    const tx = await stakingContract.unstake(ethers.utils.parseEther(raw));
    await tx.wait();

    showToast("Unstake successful ✓", "success");
    document.getElementById("amount").value = "";
    loadData(await signer.getAddress());

  } catch (error) {
    showToast(error.reason || error.message || "Unstake failed", "error");
  }
}

/* ============================================================
   CLAIM REWARDS
   Sends pending rewards to the user's wallet
   ============================================================ */
async function claimRewards() {
  if (!requireWallet()) return;

  try {
    showToast("Claiming rewards...", "info", 8000);
    const tx = await stakingContract.claimReward();
    await tx.wait();

    showToast("Rewards claimed ✓", "success");
    loadData(await signer.getAddress());

  } catch (error) {
    showToast(error.reason || error.message || "Claim failed", "error");
  }
}
