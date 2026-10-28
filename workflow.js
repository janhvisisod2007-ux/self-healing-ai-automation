const fs = require("fs");
const path = require("path");

const CRM_FILE = path.join(__dirname, "crm.json");

const STEPS = [
  { name: "Validate Order", fn: (p) => {
      if (!p.name) throw new Error('Missing field "name"');
      if (!p.email) throw new Error('Missing field "email"');
  }},
  { name: "Create Invoice", fn: (p) => {
      if (!p.phone) throw new Error('Missing field "phone"');
      if (typeof p.phone !== "string") throw new Error('"phone" must be a string');
      if (typeof p.amount !== "number" || Number.isNaN(p.amount)) throw new Error('"amount" must be a number');
  }},
  { name: "Send Email", fn: (p) => {
      if (typeof p.email !== "string" || !p.email.includes("@")) throw new Error('Invalid "email" format');
  }},
  { name: "Update CRM", fn: (p) => {
      const rows = fs.existsSync(CRM_FILE) ? JSON.parse(fs.readFileSync(CRM_FILE, "utf8")) : [];
      rows.unshift({
        name: p.name, email: p.email, phone: p.phone, amount: p.amount,
        savedAt: new Date().toLocaleTimeString(),
      });
      fs.writeFileSync(CRM_FILE, JSON.stringify(rows, null, 2));
  }},
];

// ---------- Random data ----------
const NAMES = ["Rahul", "Priya", "Amit", "Sneha", "Karan", "Anjali", "Vikram", "Neha", "Rohan", "Pooja"];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function randomBase() {
  const name = pick(NAMES);
  const phone = String(pick([6, 7, 8, 9])) + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
  const email = `${name.toLowerCase()}${Math.floor(Math.random() * 90 + 10)}@gmail.com`;
  const amount = pick([199, 299, 499, 750, 1200, 2499, 3500]);
  return { name, email, phone, amount };
}

// Failure inject karne ke tareeke (har baar naya random order)
function makeOrder(type) {
  const base = randomBase();
  if (type === "rename") { const { phone, ...rest } = base; return { ...rest, phone_no: phone }; }
  if (type === "bad_amount") {
    return { ...base, amount: pick([`${base.amount} rupees`, `Rs. ${base.amount}`, `${base.amount}.00 INR`]) };
  }
  if (type === "missing_email") { const { email, ...rest } = base; return rest; }
  return base; // "ok"
}

function newRun(type, custom) {
  const isCustom = custom && typeof custom === "object" && !Array.isArray(custom);
  const payload = isCustom ? custom : makeOrder(type);
  return {
    original: JSON.parse(JSON.stringify(payload)),
    payload,
    steps: STEPS.map((s) => ({ name: s.name, status: "pending" })),
    error: null, failedStep: null, proposal: null, lastFix: null,
    log: [], failedAt: null, recoveredAt: null,
  };
}

function runFrom(state, start = 0) {
  for (let i = start; i < STEPS.length; i++) {
    try {
      STEPS[i].fn(state.payload);
      state.steps[i].status = "success";
      state.log.push(`✅ ${STEPS[i].name} passed`);
    } catch (e) {
      state.steps[i].status = "failed";
      state.failedStep = i;
      state.error = e.message;
      state.failedAt ||= Date.now();
      state.log.push(`❌ ${STEPS[i].name} failed: ${e.message}`);
      return false;
    }
  }
  state.error = null;
  state.failedStep = null;
  if (state.failedAt) state.recoveredAt = Date.now();
  return true;
}

// AI ke fix ko check karne ke liye (validation step)
function validatePayload(p) {
  return p && typeof p.name === "string" && p.name.length > 0 &&
    typeof p.email === "string" && p.email.includes("@") &&
    typeof p.phone === "string" && typeof p.amount === "number";
}

module.exports = { newRun, runFrom, validatePayload, makeOrder, STEPS, CRM_FILE };