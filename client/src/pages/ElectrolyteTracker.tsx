// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────────
// FASTMODE — ELECTROLYTE TRACKER MODULE
// Drop-in component. Import and add to your tab nav as id="electrolytes"
//
// HOW TO ADD TO YOUR APP:
// 1. Copy this file into your /src folder
// 2. In App.jsx, add: import ElectrolyteTracker from './ElectrolyteTracker'
// 3. Add tab: { id: "electrolytes", icon: "zap", label: "Electrolytes" }
// 4. Add render: {tab === "electrolytes" && <ElectrolyteTracker profile={profile} weightLogs={weightLogs} />}
// 5. Add the Zap icon to your Ic component: zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

// ─── SCIENCE-BACKED ELECTROLYTE CALCULATIONS ─────────────────────────────────
// Sources: NIH, WHO, Dr. Eric Berg fasting protocol, Dr. Peter Attia extended fast guidelines
// All targets scale with body weight and adjust upward during fasting states

function calcElectrolyteTargets(weightLbs, isFasting, fastingHours = 0) {
  const kg = weightLbs * 0.453592;

  // BASE daily targets (non-fasting) — NIH Dietary Reference Intakes
  // Sodium: 1500–2300mg/day standard
  // Potassium: 3400mg/day (men), 2600mg/day (women) — using 3400 as default
  // Magnesium: 4.5mg/kg/day baseline

  const baseSodium = Math.round(1500 + (kg * 5));         // scales with body mass
  const basePotassium = Math.round(2600 + (kg * 12));     // scales with lean mass proxy
  const baseMagnesium = Math.round(kg * 4.5);             // 4.5mg/kg

  if (!isFasting) {
    return {
      sodium: { target: Math.min(baseSodium, 2300), unit: "mg", note: "Normal intake" },
      potassium: { target: Math.min(basePotassium, 3400), unit: "mg", note: "Normal intake" },
      magnesium: { target: Math.min(baseMagnesium, 420), unit: "mg", note: "Normal intake" },
    };
  }

  // FASTING MULTIPLIERS — electrolyte loss accelerates during fasting
  // Kidneys excrete more sodium/potassium when insulin is low (insulin causes retention)
  // Extended fasting loses ~1000-2000mg sodium/day extra, ~500-1000mg potassium extra
  // Magnesium depletion is slower but critical — cramps, heart rhythm, sleep

  let sodiumMultiplier = 1.4;    // base fasting bump
  let potassiumMultiplier = 1.3;
  let magnesiumMultiplier = 1.2;

  if (fastingHours >= 24) { sodiumMultiplier = 1.7; potassiumMultiplier = 1.5; magnesiumMultiplier = 1.35; }
  if (fastingHours >= 48) { sodiumMultiplier = 2.0; potassiumMultiplier = 1.8; magnesiumMultiplier = 1.5; }
  if (fastingHours >= 72) { sodiumMultiplier = 2.2; potassiumMultiplier = 2.0; magnesiumMultiplier = 1.6; }

  // Weight-adjusted fasting targets with hard safety caps
  const sodiumTarget = Math.min(Math.round(baseSodium * sodiumMultiplier), 4000);   // cap 4000mg
  const potassiumTarget = Math.min(Math.round(basePotassium * potassiumMultiplier), 4700); // cap 4700mg
  const magnesiumTarget = Math.min(Math.round(baseMagnesium * magnesiumMultiplier), 600);  // cap 600mg

  const sodiumNote = fastingHours >= 48 ? "Extended fast — critical replacement" : fastingHours >= 24 ? "Full-day fast — elevated need" : "Fasting — increased loss";
  const potassiumNote = fastingHours >= 48 ? "Extended fast — monitor for cramps" : "Fasting depletes potassium faster";
  const magnesiumNote = fastingHours >= 48 ? "Extended fast — sleep + heart critical" : "Fasting reduces absorption";

  return {
    sodium: { target: sodiumTarget, unit: "mg", note: sodiumNote },
    potassium: { target: potassiumTarget, unit: "mg", note: potassiumNote },
    magnesium: { target: magnesiumTarget, unit: "mg", note: magnesiumNote },
  };
}

// Weight-based recommendation: how much of each supplement to take
function calcSupplementDose(weightLbs, electrolyte, fastingHours) {
  const kg = weightLbs * 0.453592;
  const doses = {
    sodium: {
      amount: fastingHours >= 48 ? "1/2 tsp pink himalayan salt (1150mg) + 1/4 tsp" : fastingHours >= 24 ? "1/2 tsp pink himalayan salt (~1150mg)" : "1/4 tsp pink himalayan salt (~575mg)",
      timing: "Split into 2-3 doses throughout day in water",
      products: [
        { name: "Redmond Real Salt", store: "amazon", price: "$8.99/26oz" },
        { name: "Himalayan Pink Salt", store: "walmart", price: "$4.98/26oz" },
        { name: "Redmond Re-Lyte Electrolytes", store: "sprouts", price: "$39.99/60 servings" },
      ]
    },
    potassium: {
      amount: fastingHours >= 48 ? `${Math.round(kg * 6)}mg (${Math.round(kg * 6 / 99)} caps ×99mg)` : `${Math.round(kg * 4)}mg (${Math.round(kg * 4 / 99)} caps ×99mg)`,
      timing: "With meals or spread through eating window. Never take on empty stomach in large doses.",
      warning: "Never take >99mg potassium per pill (FDA limit). High single doses dangerous.",
      products: [
        { name: "NOW Potassium Chloride Powder", store: "amazon", price: "$10.99/8oz" },
        { name: "Nature Made Potassium 99mg", store: "walmart", price: "$7.98/100ct" },
        { name: "Sprouts Potassium 99mg", store: "sprouts", price: "$9.99/100ct" },
      ]
    },
    magnesium: {
      amount: fastingHours >= 48 ? `${Math.round(kg * 5)}mg magnesium glycinate` : `${Math.round(kg * 4)}mg magnesium glycinate`,
      timing: "200mg with dinner, rest at bedtime. Glycinate form — least laxative effect.",
      note: "Glycinate > oxide > citrate for fasting. Citrate causes loose stools at high doses.",
      products: [
        { name: "Doctor's Best Magnesium Glycinate 200mg", store: "amazon", price: "$19.99/240ct" },
        { name: "Nature Made Magnesium 250mg", store: "walmart", price: "$9.98/100ct" },
        { name: "Sprouts Magnesium Glycinate 400mg", store: "sprouts", price: "$21.99/90ct" },
      ]
    }
  };
  return doses[electrolyte];
}

// ─── UTIL ─────────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().split("T")[0]; }
function useLS(key, init) {
  const [v, sv] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, sv];
}
function getLast(arr, n) { return [...arr].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-n); }
function getWeekDates() {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().split("T")[0]; }).reverse();
}

// ─── ELECTROLYTE CSS ──────────────────────────────────────────────────────────
const ECSS = `
  .elec-screen { padding-bottom: 20px; }
  .elec-ring-row { display: flex; gap: 10px; padding: 0 14px; margin-bottom: 10px; }
  .elec-ring { flex: 1; background: var(--s1); border: 1px solid var(--b1); border-radius: var(--rl); padding: 14px 10px; text-align: center; position: relative; overflow: hidden; }
  .elec-ring-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--t3); margin-bottom: 6px; }
  .elec-ring-val { font-family: var(--fm); font-size: 16px; font-weight: 700; }
  .elec-ring-target { font-size: 9px; color: var(--t3); margin-top: 2px; }
  .elec-ring-bar { height: 4px; background: var(--b2); border-radius: 2px; margin-top: 6px; overflow: hidden; }
  .elec-ring-fill { height: 100%; border-radius: 2px; transition: width .5s ease; }
  .elec-status { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 3px 8px; border-radius: 10px; margin-top: 6px; }
  .elec-status.ok { background: rgba(74,222,128,.12); color: var(--grn); }
  .elec-status.low { background: rgba(251,146,60,.12); color: var(--org); }
  .elec-status.critical { background: rgba(248,113,113,.12); color: var(--red); }
  .elec-status.over { background: rgba(167,139,250,.12); color: var(--pur); }
  .elec-log-row { display: flex; gap: 8px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--b1); }
  .elec-log-row:last-child { border-bottom: none; }
  .elec-intake-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--b2); background: var(--s2); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all .2s; flex-shrink: 0; }
  .elec-intake-btn:hover { border-color: var(--acc); }
  .elec-intake-btn.active { background: rgba(94,231,223,.12); border-color: var(--acc); }
  .elec-week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-top: 8px; }
  .elec-week-day { text-align: center; }
  .elec-week-label { font-size: 8px; color: var(--t3); margin-bottom: 3px; font-weight: 600; }
  .elec-week-dot { height: 6px; border-radius: 3px; transition: background .3s; }
  .elec-sup-card { background: var(--s2); border: 1px solid var(--b1); border-radius: var(--r); padding: 14px; margin-bottom: 8px; }
  .elec-sup-name { font-size: 14px; font-weight: 600; margin-bottom: 3px; }
  .elec-sup-dose { font-size: 12px; color: var(--t2); margin-bottom: 6px; line-height: 1.5; }
  .elec-sup-timing { font-size: 11px; color: var(--t3); line-height: 1.5; }
  .elec-warning { background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.2); border-radius: var(--r); padding: 10px 12px; font-size: 11px; color: var(--red); line-height: 1.5; margin-top: 8px; }
  .elec-tip { background: rgba(94,231,223,.06); border: 1px solid rgba(94,231,223,.15); border-radius: var(--r); padding: 10px 12px; font-size: 11px; color: var(--t2); line-height: 1.6; margin-bottom: 8px; }
  .elec-product-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-top: 1px solid var(--b1); }
  .elec-fasting-banner { background: linear-gradient(135deg, rgba(248,113,113,.1), rgba(251,146,60,.08)); border: 1px solid rgba(248,113,113,.2); border-radius: var(--rl); padding: 14px 18px; margin: 0 14px 10px; }
  .elec-add-modal-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }
  .elec-quick-btn { background: var(--s2); border: 1px solid var(--b1); border-radius: var(--r); padding: 10px 8px; text-align: center; cursor: pointer; transition: all .2s; }
  .elec-quick-btn:hover { border-color: var(--acc); }
  .elec-quick-btn.selected { background: rgba(94,231,223,.08); border-color: var(--acc); }
  .elec-quick-val { font-family: var(--fm); font-size: 14px; font-weight: 700; color: var(--acc); }
  .elec-quick-label { font-size: 9px; color: var(--t3); margin-top: 2px; text-transform: uppercase; letter-spacing: .8px; }
  .elec-history-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--b1); }
  .elec-history-row:last-child { border-bottom: none; }
  .weight-log-note { font-size: 10px; color: var(--t3); font-style: italic; margin-top: 4px; }
`;

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ElectrolyteTracker({ profile, weightLogs = [], fastState = {} }) {
  // electrolyte logs: { date, sodium, potassium, magnesium, weightUsed, fastingHours }
  const [elecLogs, setElecLogs] = useLS("fm_elec_logs", []);
  const [showAdd, setShowAdd] = useState(false);
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState("today"); // today | guide | history
  const [expandedElec, setExpandedElec] = useState(null);
  const [newWeight, setNewWeight] = useState("");
  const [logWeight, setLogWeight] = useState("");
  const [toast, setToast] = useState("");
  const [entry, setEntry] = useState({ sodium: "", potassium: "", magnesium: "" });
  const [weightTrackMode, setWeightTrackMode] = useLS("fm_elec_wtrack", "daily"); // daily | weekly | monthly

  // Get most relevant current weight
  const sortedWeights = [...(weightLogs || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const currentWeight = sortedWeights[0]?.weight || profile?.weight || 200;

  // Fasting state
  const isFasting = fastState?.active || false;
  const fastingHours = isFasting && fastState?.startTime ? Math.floor((Date.now() - fastState.startTime) / 3600000) : 0;

  // Targets based on current weight + fasting state
  const targets = calcElectrolyteTargets(currentWeight, isFasting, fastingHours);

  // Today's logs
  const todayLog = elecLogs.find(l => l.date === today()) || { sodium: 0, potassium: 0, magnesium: 0 };
  const sodiumpct = Math.min(100, Math.round((todayLog.sodium / targets.sodium.target) * 100));
  const potpct = Math.min(100, Math.round((todayLog.potassium / targets.potassium.target) * 100));
  const magpct = Math.min(100, Math.round((todayLog.magnesium / targets.magnesium.target) * 100));

  // Status helpers
  const getStatus = (pct) => {
    if (pct === 0) return { label: "Not logged", cls: "low" };
    if (pct < 40) return { label: "Critical low", cls: "critical" };
    if (pct < 70) return { label: "Below target", cls: "low" };
    if (pct <= 100) return { label: "On track ✓", cls: "ok" };
    return { label: "Above target", cls: "over" };
  };

  // Weight tracking reminder logic
  const lastWeightDate = sortedWeights[0]?.date || null;
  const daysSinceWeight = lastWeightDate ? Math.floor((new Date() - new Date(lastWeightDate)) / 86400000) : 999;
  const needsWeightUpdate =
    (weightTrackMode === "daily" && daysSinceWeight >= 1) ||
    (weightTrackMode === "weekly" && daysSinceWeight >= 7) ||
    (weightTrackMode === "monthly" && daysSinceWeight >= 30);

  // Save today's electrolytes
  const saveLog = () => {
    const na = +entry.sodium || todayLog.sodium;
    const k = +entry.potassium || todayLog.potassium;
    const mg = +entry.magnesium || todayLog.magnesium;
    setElecLogs(prev => {
      const filtered = prev.filter(l => l.date !== today());
      return [...filtered, { date: today(), sodium: na, potassium: k, magnesium: mg, weightUsed: currentWeight, fastingHours, isFasting }];
    });
    setEntry({ sodium: "", potassium: "", magnesium: "" });
    setShowAdd(false);
    setToast("Electrolytes logged ✓");
  };

  const quickAdd = (elec, amount) => {
    setElecLogs(prev => {
      const existing = prev.find(l => l.date === today()) || { sodium: 0, potassium: 0, magnesium: 0 };
      const filtered = prev.filter(l => l.date !== today());
      return [...filtered, { ...existing, date: today(), [elec]: (existing[elec] || 0) + amount, weightUsed: currentWeight, fastingHours, isFasting }];
    });
    setToast(`+${amount}mg ${elec} logged`);
  };

  const weekDates = getWeekDates();

  // Supplement guide data
  const suppGuide = [
    {
      id: "sodium",
      name: "Sodium",
      icon: "🧂",
      color: "var(--org)",
      target: targets.sodium.target,
      logged: todayLog.sodium,
      note: targets.sodium.note,
      unit: "mg",
      quickAmounts: [575, 1150, 1725],
      quickLabels: ["¼ tsp", "½ tsp", "¾ tsp"],
      desc: "Lost fastest during fasting — insulin drop causes kidneys to flush sodium. Replenish with pink himalayan or sea salt in water, not table salt.",
      fastingNote: isFasting ? `At hour ${fastingHours} of your fast, you've likely lost ~${Math.round(fastingHours * 40)}mg extra sodium through urine. Replace immediately.` : "Maintain baseline sodium when not fasting. Don't over-restrict.",
      dose: calcSupplementDose(currentWeight, "sodium", fastingHours),
    },
    {
      id: "potassium",
      name: "Potassium",
      icon: "🍌",
      color: "var(--yel)",
      target: targets.potassium.target,
      logged: todayLog.potassium,
      note: targets.potassium.note,
      unit: "mg",
      quickAmounts: [99, 198, 396],
      quickLabels: ["1 cap", "2 caps", "4 caps"],
      desc: "Critical for heart rhythm, muscle function, and preventing cramps during fasting. Works with sodium — you need both in balance.",
      fastingNote: isFasting ? `Extended fasting depletes potassium through urine. Muscle cramps and heart palpitations are warning signs. You need ~${targets.potassium.target}mg today.` : "Potassium works opposite to sodium — eating window foods like avocado, spinach, banana boost levels naturally.",
      dose: calcSupplementDose(currentWeight, "potassium", fastingHours),
    },
    {
      id: "magnesium",
      name: "Magnesium",
      icon: "💊",
      color: "var(--pur)",
      target: targets.magnesium.target,
      logged: todayLog.magnesium,
      note: targets.magnesium.note,
      unit: "mg",
      quickAmounts: [100, 200, 400],
      quickLabels: ["100mg", "200mg", "400mg"],
      desc: "Most critical for sleep quality, stress response, and heart rhythm during extended fasting. Over 50% of people are deficient even when not fasting.",
      fastingNote: isFasting ? `Magnesium glycinate at bedtime prevents night cramps and improves sleep quality during your fast. Target: ${targets.magnesium.target}mg today.` : "Take magnesium glycinate at bedtime for sleep quality — it's depleted by stress, caffeine, and alcohol.",
      dose: calcSupplementDose(currentWeight, "magnesium", fastingHours),
    },
  ];

  const storeColor = (store) => {
    if (store === "amazon") return "#ff9900";
    if (store === "sprouts") return "var(--grn)";
    return "var(--blu)";
  };

  return (
    <>
      <style>{ECSS}</style>
      {toast && (
        <div className="toast" style={{ borderColor: "var(--acc)", color: "var(--acc)" }} onClick={() => setToast("")}>
          {toast}
        </div>
      )}

      <div className="elec-screen">
        {/* Header */}
        <div className="hdr">
          <div>
            <div className="htitle">ELECTROLYTES</div>
            <div className="hsub">{currentWeight} lbs · {isFasting ? `${fastingHours}h fasting` : "Eating window"}</div>
          </div>
          <button className="btn pri sm" onClick={() => setShowAdd(true)}>+ Log</button>
        </div>

        {/* Weight Update Reminder */}
        {needsWeightUpdate && (
          <div className="elec-fasting-banner">
            <div className="flex ac jb">
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--org)", marginBottom: 3 }}>⚖️ Weight Update Needed</div>
                <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
                  Your electrolyte targets scale with your weight.{" "}
                  {weightTrackMode === "daily" ? "Log your weight daily for accurate targets." : weightTrackMode === "weekly" ? `Last logged ${daysSinceWeight} days ago — update weekly.` : `Last logged ${daysSinceWeight} days ago — update monthly.`}
                </div>
              </div>
              <button className="btn gho sm" style={{ flexShrink: 0, marginLeft: 10 }} onClick={() => setShowWeightPrompt(true)}>
                Log Weight
              </button>
            </div>
            <div className="flex ac gap8" style={{ marginTop: 10 }}>
              <span style={{ fontSize: 10, color: "var(--t3)" }}>Track frequency:</span>
              {["daily", "weekly", "monthly"].map(m => (
                <button key={m} onClick={() => setWeightTrackMode(m)} style={{ padding: "3px 10px", borderRadius: 12, border: `1px solid ${weightTrackMode === m ? "var(--acc)" : "var(--b2)"}`, background: weightTrackMode === m ? "rgba(94,231,223,.1)" : "var(--s2)", color: weightTrackMode === m ? "var(--acc)" : "var(--t3)", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fasting Banner */}
        {isFasting && (
          <div className="elec-fasting-banner" style={{ background: "linear-gradient(135deg, rgba(94,231,223,.08), rgba(248,113,113,.06))", borderColor: "rgba(94,231,223,.2)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)", marginBottom: 4 }}>⚡ Fasting Mode — Elevated Targets Active</div>
            <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.6 }}>
              At hour {fastingHours} of your fast, your kidneys are excreting electrolytes faster than normal. Targets below are adjusted upward for your {currentWeight}lb body weight.
              {fastingHours >= 24 && " Extended fast detected — replenish every 4-6 hours."}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="tabrow">
          {["today", "guide", "history"].map(t => (
            <button key={t} className={`tab ${activeTab === t ? "on" : ""}`} onClick={() => setActiveTab(t)}>
              {t === "today" ? "Today" : t === "guide" ? "Dosing Guide" : "History"}
            </button>
          ))}
        </div>

        {/* ── TODAY TAB ── */}
        {activeTab === "today" && (
          <>
            {/* Three rings */}
            <div className="elec-ring-row">
              {suppGuide.map(e => {
                const pct = Math.min(100, Math.round((e.logged / e.target) * 100));
                const status = getStatus(pct);
                return (
                  <div key={e.id} className="elec-ring" onClick={() => setExpandedElec(expandedElec === e.id ? null : e.id)} style={{ cursor: "pointer", borderColor: expandedElec === e.id ? e.color : "var(--b1)" }}>
                    <div className="elec-ring-label" style={{ color: e.color }}>{e.name}</div>
                    <div className="elec-ring-val" style={{ color: e.color }}>{e.logged}<span style={{ fontSize: 9, color: "var(--t3)", fontFamily: "var(--fb)" }}>mg</span></div>
                    <div className="elec-ring-target">of {e.target}mg</div>
                    <div className="elec-ring-bar"><div className="elec-ring-fill" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--pur)" : pct >= 70 ? "var(--grn)" : pct >= 40 ? "var(--org)" : "var(--red)" }} /></div>
                    <div className={`elec-status ${status.cls}`}>{status.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Expanded electrolyte detail */}
            {expandedElec && (() => {
              const e = suppGuide.find(s => s.id === expandedElec);
              return (
                <div className="card gblue" style={{ marginTop: -4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: e.color, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>{e.icon} {e.name} Detail</div>
                  <div className="elec-tip">{e.fastingNote}</div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Quick Add</div>
                    <div className="elec-add-modal-grid">
                      {e.quickAmounts.map((amt, i) => (
                        <div key={amt} className="elec-quick-btn" onClick={() => quickAdd(e.id, amt)}>
                          <div className="elec-quick-val">+{amt}</div>
                          <div className="elec-quick-label">{e.quickLabels[i]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.6 }}>{e.desc}</div>
                  {e.dose?.warning && <div className="elec-warning">⚠️ {e.dose.warning}</div>}
                </div>
              );
            })()}

            {/* Summary card */}
            <div className="card">
              <div className="clabel">TODAY'S SUMMARY — {currentWeight} LBS</div>
              {suppGuide.map(e => {
                const pct = Math.min(100, Math.round((e.logged / e.target) * 100));
                const remain = Math.max(0, e.target - e.logged);
                return (
                  <div key={e.id} className="elec-log-row">
                    <span style={{ fontSize: 18, width: 28, flexShrink: 0 }}>{e.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{e.name}</span>
                        <span style={{ fontFamily: "var(--fm)", fontSize: 12, color: e.color }}>{e.logged} / {e.target}mg</span>
                      </div>
                      <div className="pbar"><div className="pfill" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--pur)" : pct >= 70 ? e.color : "var(--red)" }} /></div>
                      {remain > 0 && <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 3 }}>Need {remain}mg more today</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weight-adjusted target explanation */}
            <div className="card">
              <div className="clabel">WHY THESE TARGETS?</div>
              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.7 }}>
                Your targets are calculated using your current weight of <strong style={{ color: "var(--acc)" }}>{currentWeight} lbs ({(currentWeight * 0.453592).toFixed(1)} kg)</strong>.<br /><br />
                {isFasting
                  ? `During a ${fastingHours}h fast, your insulin is low — this causes your kidneys to excrete more sodium and potassium than normal. Your targets are elevated by ${fastingHours >= 48 ? "100%" : fastingHours >= 24 ? "70%" : "40%"} to compensate.`
                  : "When eating normally, targets follow NIH Dietary Reference Intakes scaled to body mass. Heavier bodies require more electrolytes for proper cellular function."}
                <br /><br />
                <strong style={{ color: "var(--org)" }}>Log your weight {weightTrackMode} so targets stay accurate as you lose fat.</strong>
              </div>
            </div>
          </>
        )}

        {/* ── GUIDE TAB ── */}
        {activeTab === "guide" && (
          <>
            <div className="card gbp">
              <div className="clabel">DOSING GUIDE — {currentWeight} LBS</div>
              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.6 }}>
                All doses below are weight-adjusted for your {currentWeight} lb body weight and {isFasting ? `current ${fastingHours}h fasting state` : "non-fasting state"}. Update your weight {weightTrackMode} for accuracy.
              </div>
            </div>

            {suppGuide.map(e => (
              <div key={e.id} className="elec-sup-card" onClick={() => setExpandedElec(expandedElec === e.id ? null : e.id)} style={{ cursor: "pointer", borderColor: expandedElec === e.id ? e.color : "var(--b1)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{e.icon}</span>
                    <div>
                      <div className="elec-sup-name" style={{ color: e.color }}>{e.name}</div>
                      <div style={{ fontSize: 10, color: "var(--t3)" }}>Daily target: {e.target}mg · {e.note}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--t3)" }}>{expandedElec === e.id ? "▲" : "▼"}</span>
                </div>

                {expandedElec === e.id && (
                  <>
                    <div style={{ background: "var(--s1)", borderRadius: "var(--r)", padding: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Recommended Daily Amount</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: e.color, lineHeight: 1.6 }}>{e.dose?.amount}</div>
                    </div>
                    <div className="elec-sup-timing">⏰ Timing: {e.dose?.timing}</div>
                    {e.dose?.note && <div className="elec-tip" style={{ marginTop: 8 }}>💡 {e.dose.note}</div>}
                    {e.dose?.warning && <div className="elec-warning">⚠️ {e.dose.warning}</div>}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Where to Buy</div>
                      {e.dose?.products?.map((p, i) => (
                        <div key={i} className="elec-product-row">
                          <span style={{ fontSize: 12 }}>{p.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: storeColor(p.store), background: `${storeColor(p.store)}18`, border: `1px solid ${storeColor(p.store)}30`, borderRadius: 6, padding: "2px 7px" }}>{p.store}</span>
                            <span style={{ fontFamily: "var(--fm)", fontSize: 11, color: "var(--t3)" }}>{p.price}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 11, color: "var(--t2)", lineHeight: 1.6 }}>{e.desc}</div>
                  </>
                )}
              </div>
            ))}

            {/* Electrolyte drink recipes */}
            <div className="shdr"><div className="stitle">Fast-Friendly Electrolyte Drinks</div></div>
            <div className="card">
              {[
                { name: "Basic Fasting Water", icon: "💧", recipe: "32oz water + ¼ tsp pink salt (575mg Na) + squeeze lemon + pinch cream of tartar (for K)", sodium: 575, potassium: 250, magnesium: 0 },
                { name: "Dr. Berg's Electrolyte", icon: "⚡", recipe: "16oz water + ½ tsp pink salt + 1 tsp cream of tartar + lemon juice. Sip over 2hrs.", sodium: 1150, potassium: 500, magnesium: 0 },
                { name: "Extended Fast Protocol", icon: "🔥", recipe: "32oz water + ½ tsp pink salt + ¼ tsp No Salt (potassium chloride) + 300mg Mg glycinate capsule alongside", sodium: 1150, potassium: 650, magnesium: 300 },
                { name: "Bone Broth Boost", icon: "🍖", recipe: "1 cup bone broth (~500mg Na) + ¼ tsp added pink salt. Best for breaking long fasts gently.", sodium: 1000, potassium: 300, magnesium: 20 },
              ].map((r, i) => (
                <div key={i} style={{ padding: "12px 0", borderBottom: i < 3 ? "1px solid var(--b1)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 18 }}>{r.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.6, marginBottom: 6 }}>{r.recipe}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {r.sodium > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--org)", background: "rgba(251,146,60,.1)", border: "1px solid rgba(251,146,60,.2)", borderRadius: 6, padding: "2px 7px" }}>Na: {r.sodium}mg</span>}
                    {r.potassium > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--yel)", background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 6, padding: "2px 7px" }}>K: {r.potassium}mg</span>}
                    {r.magnesium > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--pur)", background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 6, padding: "2px 7px" }}>Mg: {r.magnesium}mg</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Safety warnings */}
            <div className="card">
              <div className="clabel">⚠️ SAFETY NOTES</div>
              {[
                "Never take more than 99mg potassium in a single pill (FDA cap). High doses cause heart arrhythmia.",
                "If you feel heart palpitations or muscle weakness during fasting — add sodium and potassium immediately.",
                "Magnesium citrate causes loose stools at high doses. Use glycinate form during fasting.",
                "If fasting beyond 5 days, consult a doctor and consider medical supervision for electrolyte management.",
                "AOD-9604 does not significantly affect electrolyte balance, but staying hydrated maximizes peptide bioavailability.",
              ].map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: i < 4 ? "1px solid var(--b1)" : "none" }}>
                  <span style={{ color: "var(--red)", fontSize: 12, flexShrink: 0, marginTop: 1 }}>•</span>
                  <span style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>{w}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          <>
            {/* 7-Day Grid */}
            <div className="card">
              <div className="clabel">7-DAY COMPLIANCE</div>
              <div className="elec-week-grid">
                {weekDates.map(d => {
                  const log = elecLogs.find(l => l.date === d);
                  const avg = log ? Math.round(((log.sodium / targets.sodium.target) + (log.potassium / targets.potassium.target) + (log.magnesium / targets.magnesium.target)) / 3 * 100) : 0;
                  return (
                    <div key={d} className="elec-week-day">
                      <div className="elec-week-label">{new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}</div>
                      <div className="elec-week-dot" style={{ background: avg === 0 ? "var(--b3)" : avg >= 70 ? "var(--grn)" : avg >= 40 ? "var(--org)" : "var(--red)" }} title={`${avg}%`} />
                      <div style={{ fontSize: 8, color: "var(--t3)", marginTop: 2 }}>{avg > 0 ? `${avg}%` : "—"}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weight Tracking Mode */}
            <div className="card">
              <div className="clabel">WEIGHT LOG FREQUENCY</div>
              <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.6, marginBottom: 12 }}>
                Electrolyte targets scale with your body weight. As you lose fat, your targets decrease. Choose how often to update your weight.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["daily", "weekly", "monthly"].map(m => (
                  <button key={m} onClick={() => setWeightTrackMode(m)} style={{ flex: 1, padding: "10px 8px", borderRadius: "var(--r)", border: `1px solid ${weightTrackMode === m ? "var(--acc)" : "var(--b2)"}`, background: weightTrackMode === m ? "rgba(94,231,223,.08)" : "var(--s2)", color: weightTrackMode === m ? "var(--acc)" : "var(--t3)", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", transition: "all .2s" }}>
                    {m === "daily" ? "📅 Daily" : m === "weekly" ? "📆 Weekly" : "🗓 Monthly"}
                  </button>
                ))}
              </div>
              {currentWeight && (
                <div style={{ marginTop: 10, fontSize: 11, color: "var(--t3)" }}>
                  Current: <strong style={{ color: "var(--acc)" }}>{currentWeight} lbs</strong> · Last logged: {lastWeightDate || "Never"}{lastWeightDate && ` (${daysSinceWeight}d ago)`}
                </div>
              )}
            </div>

            {/* Log history */}
            {elecLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--t3)" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>⚡</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>No electrolyte logs yet</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Tap + Log to start tracking</div>
              </div>
            ) : (
              <div className="card">
                <div className="clabel">LOG HISTORY</div>
                {[...elecLogs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 14).map(l => (
                  <div key={l.date} className="elec-history-row">
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{l.date}</div>
                      <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                        {l.weightUsed ? `${l.weightUsed} lbs` : ""}{l.isFasting ? ` · ${l.fastingHours}h fast` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "var(--fm)" }}>
                      <span style={{ color: "var(--org)" }}>{l.sodium || 0}</span>
                      <span style={{ color: "var(--yel)" }}>{l.potassium || 0}</span>
                      <span style={{ color: "var(--pur)" }}>{l.magnesium || 0}</span>
                      <span style={{ color: "var(--t3)", fontSize: 9 }}>mg</span>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--b1)" }}>
                  <span style={{ fontSize: 9, color: "var(--org)", fontWeight: 700 }}>🧂 Na</span>
                  <span style={{ fontSize: 9, color: "var(--yel)", fontWeight: 700 }}>🍌 K</span>
                  <span style={{ fontSize: 9, color: "var(--pur)", fontWeight: 700 }}>💊 Mg</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── LOG MODAL ── */}
      {showAdd && (
        <div className="mo" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="md">
            <div className="mh" />
            <div className="mt">LOG ELECTROLYTES</div>
            <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r)", padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Current Targets ({currentWeight} lbs{isFasting ? ` · ${fastingHours}h fast` : ""})</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--org)" }}>🧂 Sodium</span>
                <span style={{ fontFamily: "var(--fm)", fontSize: 11 }}>{targets.sodium.target}mg</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--yel)" }}>🍌 Potassium</span>
                <span style={{ fontFamily: "var(--fm)", fontSize: 11 }}>{targets.potassium.target}mg</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--pur)" }}>💊 Magnesium</span>
                <span style={{ fontFamily: "var(--fm)", fontSize: 11 }}>{targets.magnesium.target}mg</span>
              </div>
            </div>

            {[
              { key: "sodium", label: "Sodium (mg)", icon: "🧂", color: "var(--org)", placeholder: `Target: ${targets.sodium.target}mg`, current: todayLog.sodium },
              { key: "potassium", label: "Potassium (mg)", icon: "🍌", color: "var(--yel)", placeholder: `Target: ${targets.potassium.target}mg`, current: todayLog.potassium },
              { key: "magnesium", label: "Magnesium (mg)", icon: "💊", color: "var(--pur)", placeholder: `Target: ${targets.magnesium.target}mg`, current: todayLog.magnesium },
            ].map(f => (
              <div key={f.key} className="ig">
                <label className="il" style={{ color: f.color }}>{f.icon} {f.label}</label>
                <div style={{ position: "relative" }}>
                  <input className="inp" type="number" placeholder={f.placeholder} value={entry[f.key]} onChange={e => setEntry(p => ({ ...p, [f.key]: e.target.value }))} style={{ borderColor: entry[f.key] ? f.color : undefined }} />
                  {f.current > 0 && !entry[f.key] && (
                    <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--t3)" }}>Today so far: {f.current}mg</div>
                  )}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 14, lineHeight: 1.5 }}>
              💡 Entering values replaces today's total. Add partial amounts using quick-add buttons on the Today tab.
            </div>
            <button className="btn pri" style={{ width: "100%" }} onClick={saveLog}>Save Today's Log</button>
          </div>
        </div>
      )}

      {/* ── WEIGHT PROMPT MODAL ── */}
      {showWeightPrompt && (
        <div className="mo" onClick={e => e.target === e.currentTarget && setShowWeightPrompt(false)}>
          <div className="md">
            <div className="mh" />
            <div className="mt">LOG WEIGHT</div>
            <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 16, lineHeight: 1.6 }}>
              Logging your weight recalibrates your electrolyte targets. Current: <strong style={{ color: "var(--acc)" }}>{currentWeight} lbs</strong>.
            </div>
            <div className="ig">
              <label className="il">Current Weight (lbs)</label>
              <input className="inp" type="number" step=".1" placeholder={currentWeight} value={logWeight} onChange={e => setLogWeight(e.target.value)} autoFocus />
            </div>
            {logWeight && (
              <div style={{ background: "rgba(94,231,223,.06)", border: "1px solid rgba(94,231,223,.15)", borderRadius: "var(--r)", padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 6, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>New Targets at {logWeight} lbs</div>
                {(() => { const newTargets = calcElectrolyteTargets(+logWeight, isFasting, fastingHours); return <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, color: "var(--org)" }}>Sodium</span><span style={{ fontFamily: "var(--fm)", fontSize: 11 }}>{newTargets.sodium.target}mg</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, color: "var(--yel)" }}>Potassium</span><span style={{ fontFamily: "var(--fm)", fontSize: 11 }}>{newTargets.potassium.target}mg</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, color: "var(--pur)" }}>Magnesium</span><span style={{ fontFamily: "var(--fm)", fontSize: 11 }}>{newTargets.magnesium.target}mg</span></div>
                </>; })()}
              </div>
            )}
            <button className="btn pri" style={{ width: "100%" }} onClick={() => {
              if (!logWeight) return;
              // This updates via the weightLogs prop in the parent — the parent's setWeightLogs is not passed here
              // The new weight will show up when weightLogs prop updates from the Progress screen
              setToast(`Weight updated to ${logWeight} lbs — log in Progress tab to persist`);
              setShowWeightPrompt(false);
              setLogWeight("");
            }}>
              Got it — I'll log in Progress tab
            </button>
            <div style={{ fontSize: 10, color: "var(--t3)", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
              Full weight logging lives in the Progress tab. This reminder just tells you when it's time to update.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
