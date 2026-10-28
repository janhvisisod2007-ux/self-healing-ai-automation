require("dotenv").config();
const fs = require("fs");
const express = require("express");
const { newRun, runFrom, validatePayload, makeOrder, CRM_FILE } = require("./workflow");
const { diagnose } = require("./ai");

const app = express();
app.use(express.json());
app.use(express.static("public"));

let state = newRun("ok");
const history = [];
let healing = false;

function applyFix(mode = "auto") {
  const idx = state.failedStep;
  const stepName = state.steps[idx].name;
  const errorMsg = state.error;
  const proposal = state.proposal;
  const before = JSON.parse(JSON.stringify(state.payload));

  state.payload = proposal.fixed_payload;
  state.log.push("🔧 Fix applied, retrying...");
  state.proposal = null;
  const ok = runFrom(state, idx);

  state.lastFix = {
    step: stepName,
    error: errorMsg,
    root_cause: proposal.root_cause,
    explanation: proposal.explanation,
    confidence: proposal.confidence,
    mode,
    before,
    after: proposal.fixed_payload,
    ok,
  };

  history.unshift({
    time: new Date().toLocaleTimeString(),
    step: stepName,
    error: errorMsg,
    root_cause: proposal.root_cause,
    mode,
    outcome: ok ? "recovered" : "retry failed",
    seconds: ok ? ((state.recoveredAt - state.failedAt) / 1000).toFixed(1) : null,
  });
}

app.get("/api/state", (req, res) => res.json(state));
app.get("/api/history", (req, res) => res.json(history));
app.get("/api/crm", (req, res) => {
  res.json(fs.existsSync(CRM_FILE) ? JSON.parse(fs.readFileSync(CRM_FILE, "utf8")) : []);
});
app.get("/api/sample", (req, res) => res.json(makeOrder(req.query.type || "ok")));

app.post("/api/reset", (req, res) => {
  history.length = 0;
  if (fs.existsSync(CRM_FILE)) fs.unlinkSync(CRM_FILE);
  state = newRun("ok");
  res.json(state);
});

app.post("/api/run", (req, res) => {
  state = newRun(req.body.type, req.body.payload);
  runFrom(state, 0);
  res.json(state);
});

app.post("/api/diagnose", async (req, res) => {
  if (healing || state.failedStep === null) return res.json(state);
  healing = true;
  const current = state;
  try {
    const proposal = await diagnose(current);
    // agar beech me state badal gayi ya pehle hi theek ho gayi, to ignore
    if (current !== state || current.failedStep === null) return res.json(state);

    state.log.push(`🧠 AI: ${proposal.root_cause}`);
    const valid = validatePayload(proposal.fixed_payload);

    if (!valid) {
      state.proposal = { ...proposal, needsHuman: true };
      state.log.push("🙋 Auto-fix not possible, human needed");
      history.unshift({
        time: new Date().toLocaleTimeString(),
        step: state.steps[state.failedStep].name,
        error: state.error,
        root_cause: proposal.root_cause,
        mode: "human",
        outcome: "escalated to human",
        seconds: null,
      });
    } else if (!proposal.risky && proposal.confidence >= 0.8) {
      state.proposal = proposal;
      applyFix("auto");
    } else {
      state.proposal = proposal;
      state.log.push("⏸ Risky fix, waiting for approval");
    }
    res.json(state);
  } finally {
    healing = false;
  }
});

app.post("/api/approve", (req, res) => {
  if (state.proposal && validatePayload(state.proposal.fixed_payload)) applyFix("approved");
  res.json(state);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on port " + PORT));