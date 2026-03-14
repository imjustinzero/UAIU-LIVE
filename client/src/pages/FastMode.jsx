import { useState, useEffect, useRef } from "react";

// ─── BLUEPRINT DATA ───────────────────────────────────────────────────────────
const BLUEPRINT_MEALS = [
  {
    id: "super-veggie",
    name: "Super Veggie",
    category: "blueprint",
    calories: 379,
    protein: 22,
    carbs: 45,
    fat: 12,
    fiber: 18,
    description: "Bryan Johnson's cornerstone longevity meal",
    ingredients: [
      { name: "Broccoli", amount: "250g", store: { amazon: null, sprouts: "$2.99/head", walmart: "$1.98/head" } },
      { name: "Cauliflower", amount: "150g", store: { amazon: null, sprouts: "$3.49/head", walmart: "$2.98/head" } },
      { name: "Shiitake/Maitake Mushrooms", amount: "50g", store: { amazon: "$12.99/oz dried", sprouts: "$5.99/8oz", walmart: "$3.98/8oz" } },
      { name: "Spinach", amount: "50g", store: { amazon: null, sprouts: "$3.99/5oz", walmart: "$2.98/5oz" } },
      { name: "Carrots", amount: "30g", store: { amazon: null, sprouts: "$1.49/lb", walmart: "$0.88/lb" } },
      { name: "Black Lentils", amount: "300g", store: { amazon: "$8.99/2lb", sprouts: "$4.99/1lb", walmart: "$2.98/1lb" } },
      { name: "Hemp Seeds", amount: "1 tbsp", store: { amazon: "$14.99/1lb", sprouts: "$9.99/8oz", walmart: "$7.98/8oz" } },
      { name: "Garlic", amount: "1 clove", store: { amazon: null, sprouts: "$0.79/head", walmart: "$0.58/head" } },
      { name: "Ginger Root", amount: "3g", store: { amazon: null, sprouts: "$3.99/lb", walmart: "$2.98/lb" } },
      { name: "Apple Cider Vinegar", amount: "1 tbsp", store: { amazon: "$9.99/32oz", sprouts: "$5.99/32oz", walmart: "$3.96/32oz" } },
      { name: "Extra Virgin Olive Oil", amount: "1 tbsp", store: { amazon: "$18.99/16oz", sprouts: "$12.99/16oz", walmart: "$8.98/16oz" } },
    ],
    instructions: "1. Weigh and wash all veggies. 2. Boil broccoli, cauliflower, ginger, garlic until tender (7-9 min). 3. Steam carrots separately 5 min. 4. Cook black lentils 18-20 min until al dente. 5. Blend cooked broccoli/cauliflower with mushrooms, spinach. 6. Pour into bowl, top with lentils, steamed carrots, hemp seeds. 7. Drizzle with EVOO and ACV.",
    tags: ["anti-aging", "fiber", "longevity", "gut-health"],
    longevityScore: 98,
  },
  {
    id: "nutty-pudding",
    name: "Nutty Pudding",
    category: "blueprint",
    calories: 415,
    protein: 33,
    carbs: 36,
    fat: 22,
    fiber: 25,
    description: "Omega-3 powerhouse with 26g+ protein — Bryan's favorite meal",
    ingredients: [
      { name: "Macadamia Nuts (ground)", amount: "3 tbsp", store: { amazon: "$16.99/1lb", sprouts: "$11.99/8oz", walmart: "$9.98/8oz" } },
      { name: "Walnuts (ground)", amount: "2 tsp", store: { amazon: "$10.99/1lb", sprouts: "$7.99/8oz", walmart: "$5.98/8oz" } },
      { name: "Chia Seeds", amount: "2 tbsp", store: { amazon: "$12.99/2lb", sprouts: "$7.99/12oz", walmart: "$5.98/12oz" } },
      { name: "Ground Flaxseed", amount: "1 tsp", store: { amazon: "$8.99/2lb", sprouts: "$5.99/14oz", walmart: "$4.46/32oz" } },
      { name: "Mixed Berries", amount: "½ cup", store: { amazon: "$14.99/2lb frozen", sprouts: "$5.99/12oz frozen", walmart: "$3.98/12oz frozen" } },
      { name: "Dark Cherries", amount: "3 cherries", store: { amazon: "$12.99/2lb frozen", sprouts: "$6.99/1lb frozen", walmart: "$4.98/1lb frozen" } },
      { name: "Pomegranate Juice", amount: "60ml", store: { amazon: "$15.99/32oz", sprouts: "$8.99/16oz", walmart: "$6.98/16oz" } },
      { name: "Macadamia Nut Milk", amount: "100ml", store: { amazon: "$24.99/6-pack", sprouts: "$4.99/32oz", walmart: "$3.78/32oz" } },
      { name: "Pea Protein Powder", amount: "30-60g", store: { amazon: "$29.99/2lb", sprouts: "$34.99/2lb", walmart: "$21.98/2lb" } },
      { name: "Cacao Powder", amount: "1 tsp", store: { amazon: "$13.99/1lb", sprouts: "$9.99/8oz", walmart: "$6.98/8oz" } },
      { name: "Sunflower Lecithin", amount: "1 tsp", store: { amazon: "$16.99/1lb", sprouts: "$12.99/8oz", walmart: "Not available" } },
      { name: "Ceylon Cinnamon", amount: "½ tsp", store: { amazon: "$11.99/1lb", sprouts: "$7.99/2oz", walmart: "$4.98/2.37oz" } },
      { name: "Brazil Nut", amount: "¼ nut", store: { amazon: "$10.99/1lb", sprouts: "$8.99/8oz", walmart: "$6.98/8oz" } },
    ],
    instructions: "1. Grind macadamia nuts and walnuts to fine powder. 2. Blend ground nuts, berries (save ¼ cup), pomegranate juice, nut milk, cacao, lecithin, cinnamon. 3. Blend 3-4 min until smooth. 4. Pour into bowl. 5. Stir in pea protein, chia seeds, remaining berries. 6. Let sit 15 min to thicken.",
    tags: ["omega-3", "anti-aging", "protein", "brain-health"],
    longevityScore: 96,
  },
  {
    id: "green-giant",
    name: "Green Giant Drink",
    category: "blueprint",
    calories: 150,
    protein: 8,
    carbs: 18,
    fat: 5,
    fiber: 6,
    description: "Bryan's morning microbiome primer — starts every day",
    ingredients: [
      { name: "Collagen Protein", amount: "1 scoop", store: { amazon: "$34.99/30 servings", sprouts: "$29.99/20 servings", walmart: "$19.98/16oz" } },
      { name: "Creatine Monohydrate", amount: "5g", store: { amazon: "$19.99/500g", sprouts: "$24.99/300g", walmart: "$14.98/400g" } },
      { name: "Inulin (Prebiotic Fiber)", amount: "1 tbsp", store: { amazon: "$14.99/1lb", sprouts: "$11.99/8oz", walmart: "$9.98/8oz" } },
      { name: "Spirulina", amount: "1 tsp", store: { amazon: "$18.99/1lb", sprouts: "$14.99/4oz", walmart: "$11.98/4oz" } },
      { name: "Ashwagandha", amount: "300mg", store: { amazon: "$16.99/90 caps", sprouts: "$19.99/60 caps", walmart: "$9.98/60 caps" } },
      { name: "Banana (optional)", amount: "½", store: { amazon: null, sprouts: "$0.29/each", walmart: "$0.19/each" } },
    ],
    instructions: "1. Add all powders to blender. 2. Add 12oz cold water or macadamia milk. 3. Optional: add half banana for sweetness. 4. Blend 60 seconds. 5. Consume immediately after waking.",
    tags: ["morning", "gut-health", "energy", "longevity"],
    longevityScore: 92,
  },
  {
    id: "blueprint-bowl",
    name: "Blueprint Buddha Bowl",
    category: "blueprint",
    calories: 500,
    protein: 24,
    carbs: 62,
    fat: 18,
    fiber: 14,
    description: "Anti-inflammatory whole food bowl — Blueprint dinner rotation",
    ingredients: [
      { name: "Japanese Sweet Potato", amount: "1 medium", store: { amazon: null, sprouts: "$2.99/lb", walmart: "$1.98/lb" } },
      { name: "Asparagus", amount: "½ head", store: { amazon: null, sprouts: "$3.99/bunch", walmart: "$2.98/bunch" } },
      { name: "Kale", amount: "5-6 leaves", store: { amazon: null, sprouts: "$2.49/bunch", walmart: "$1.98/bunch" } },
      { name: "Red Bell Pepper", amount: "1", store: { amazon: null, sprouts: "$1.99/each", walmart: "$1.48/each" } },
      { name: "White Beans", amount: "½ cup", store: { amazon: "$6.99/6-pack cans", sprouts: "$1.99/can", walmart: "$0.98/can" } },
      { name: "Walnuts", amount: "¼ cup", store: { amazon: "$10.99/1lb", sprouts: "$7.99/8oz", walmart: "$5.98/8oz" } },
      { name: "Avocado", amount: "½", store: { amazon: null, sprouts: "$1.49/each", walmart: "$0.98/each" } },
      { name: "EVOO", amount: "½ tsp", store: { amazon: "$18.99/16oz", sprouts: "$12.99/16oz", walmart: "$8.98/16oz" } },
      { name: "Lemon", amount: "½", store: { amazon: null, sprouts: "$0.79/each", walmart: "$0.58/each" } },
      { name: "Apple Cider Vinegar", amount: "1 tbsp", store: { amazon: "$9.99/32oz", sprouts: "$5.99/32oz", walmart: "$3.96/32oz" } },
    ],
    instructions: "1. Roast sweet potato 45-60 min at 400°F with EVOO. 2. Roast red pepper 25-30 min. 3. Boil asparagus 2-5 min. 4. Massage kale with EVOO. 5. Rinse and drain white beans, add lemon juice and dill. 6. Assemble bowl with all ingredients. 7. Top with walnut halves and ACV drizzle.",
    tags: ["anti-inflammatory", "fiber", "plant-based", "longevity"],
    longevityScore: 94,
  },
];

// Store nutrition database for common Blueprint-friendly foods
const STORE_FOODS = [
  // Amazon
  { id: "az1", name: "Blueprint Longevity Protein (Nutty Pudding)", store: "amazon", calories: 160, protein: 26, carbs: 9, fat: 5, fiber: 4, price: "$79.99/30 servings", url: "amazon.com", category: "protein" },
  { id: "az2", name: "Thorne Creatine Monohydrate", store: "amazon", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, price: "$24.99/450g", url: "amazon.com", category: "supplement" },
  { id: "az3", name: "Navitas Organics Hemp Seeds", store: "amazon", calories: 166, protein: 10, carbs: 3, fat: 15, fiber: 2, price: "$14.99/16oz", url: "amazon.com", category: "seeds" },
  { id: "az4", name: "Anthony's Organic Chia Seeds", store: "amazon", calories: 138, protein: 5, carbs: 12, fat: 9, fiber: 10, price: "$12.99/2lb", url: "amazon.com", category: "seeds" },
  { id: "az5", name: "Vital Proteins Collagen Peptides", store: "amazon", calories: 70, protein: 18, carbs: 0, fat: 0, fiber: 0, price: "$34.99/10oz", url: "amazon.com", category: "protein" },
  { id: "az6", name: "NOW Foods Black Lentils", store: "amazon", calories: 170, protein: 13, carbs: 29, fat: 0, fiber: 9, price: "$8.99/2lb", url: "amazon.com", category: "legumes" },
  { id: "az7", name: "Terrasoul Organic Cacao Powder", store: "amazon", calories: 20, protein: 2, carbs: 4, fat: 1, fiber: 2, price: "$13.99/1lb", url: "amazon.com", category: "pantry" },
  { id: "az8", name: "Kate Farms Organic Pea Protein", store: "amazon", calories: 120, protein: 28, carbs: 4, fat: 2, fiber: 1, price: "$29.99/2lb", url: "amazon.com", category: "protein" },
  // Sprouts
  { id: "sp1", name: "Sprouts Organic Broccoli Florets", store: "sprouts", calories: 31, protein: 3, carbs: 6, fat: 0, fiber: 2, price: "$3.99/12oz bag", url: "sprouts.com", category: "produce" },
  { id: "sp2", name: "Sprouts Organic Shiitake Mushrooms", store: "sprouts", calories: 34, protein: 2, carbs: 7, fat: 0, fiber: 2, price: "$5.99/8oz", url: "sprouts.com", category: "produce" },
  { id: "sp3", name: "Sprouts Organic Frozen Mixed Berries", store: "sprouts", calories: 60, protein: 1, carbs: 14, fat: 0, fiber: 3, price: "$5.99/12oz", url: "sprouts.com", category: "frozen" },
  { id: "sp4", name: "Sprouts Macadamia Nut Milk", store: "sprouts", calories: 50, protein: 0, carbs: 1, fat: 5, fiber: 0, price: "$4.99/32oz", url: "sprouts.com", category: "dairy-alt" },
  { id: "sp5", name: "Sprouts Organic Baby Spinach", store: "sprouts", calories: 20, protein: 2, carbs: 3, fat: 0, fiber: 2, price: "$3.99/5oz", url: "sprouts.com", category: "produce" },
  { id: "sp6", name: "Sprouts Organic Black Lentils", store: "sprouts", calories: 180, protein: 14, carbs: 30, fat: 1, fiber: 10, price: "$4.99/1lb", url: "sprouts.com", category: "legumes" },
  { id: "sp7", name: "Sprouts Organic Ground Flaxseed", store: "sprouts", calories: 60, protein: 3, carbs: 4, fat: 5, fiber: 4, price: "$5.99/14oz", url: "sprouts.com", category: "seeds" },
  { id: "sp8", name: "Sprouts Raw Macadamia Nuts", store: "sprouts", calories: 204, protein: 2, carbs: 4, fat: 21, fiber: 2, price: "$11.99/8oz", url: "sprouts.com", category: "nuts" },
  // Walmart
  { id: "wm1", name: "Great Value Frozen Broccoli", store: "walmart", calories: 30, protein: 2, carbs: 5, fat: 0, fiber: 2, price: "$1.98/12oz", url: "walmart.com", category: "frozen" },
  { id: "wm2", name: "Sam's Choice Organic EVOO", store: "walmart", calories: 120, protein: 0, carbs: 0, fat: 14, fiber: 0, price: "$8.98/16oz", url: "walmart.com", category: "oils" },
  { id: "wm3", name: "Great Value Chia Seeds", store: "walmart", calories: 138, protein: 5, carbs: 12, fat: 9, fiber: 10, price: "$5.98/12oz", url: "walmart.com", category: "seeds" },
  { id: "wm4", name: "Great Value Frozen Mixed Berries", store: "walmart", calories: 60, protein: 1, carbs: 14, fat: 0, fiber: 3, price: "$3.98/12oz", url: "walmart.com", category: "frozen" },
  { id: "wm5", name: "Marketside Organic Baby Spinach", store: "walmart", calories: 20, protein: 2, carbs: 3, fat: 0, fiber: 2, price: "$2.98/5oz", url: "walmart.com", category: "produce" },
  { id: "wm6", name: "Iberia Black Lentils", store: "walmart", calories: 170, protein: 13, carbs: 29, fat: 0, fiber: 9, price: "$2.98/1lb", url: "walmart.com", category: "legumes" },
  { id: "wm7", name: "Nutiva Organic Hemp Seeds", store: "walmart", calories: 166, protein: 10, carbs: 3, fat: 15, fiber: 2, price: "$7.98/8oz", url: "walmart.com", category: "seeds" },
  { id: "wm8", name: "Orgain Organic Pea Protein", store: "walmart", calories: 150, protein: 21, carbs: 12, fat: 4, fiber: 2, price: "$21.98/2lb", url: "walmart.com", category: "protein" },
];

const BLUEPRINT_PRINCIPLES = [
  { icon: "⏰", title: "Time-Restricted Eating", desc: "All meals within 6-8hr window. Final meal 4hrs before bed for optimal RHR and sleep." },
  { icon: "🌿", title: "Nutrient Density Over Calories", desc: "Every calorie must earn its place. Prioritize micronutrients, polyphenols, and fiber above all." },
  { icon: "🧬", title: "No Added Sugar or Seed Oils", desc: "Zero processed sugar, zero canola/vegetable oil. EVOO and macadamia oil only." },
  { icon: "🫀", title: "Anti-Inflammatory Stack", desc: "EVOO, ACV, fermented foods, turmeric, omega-3s daily to reduce systemic inflammation." },
  { icon: "💤", title: "Sleep as #1 Priority", desc: "In bed by 8:30pm. Last meal 4hrs before sleep. No screens 1hr before bed." },
  { icon: "📊", title: "Measure Everything", desc: "Test biomarkers every 90 days. Track weight, body fat, glucose, and inflammation markers." },
];

// ─── UTILS ────────────────────────────────────────────────────────────────────
function calcBMR(weight, heightIn, age, sex) {
  const kg = weight * 0.453592, cm = heightIn * 2.54;
  return sex === "male" ? 10 * kg + 6.25 * cm - 5 * age + 5 : 10 * kg + 6.25 * cm - 5 * age - 161;
}
function calcTDEE(bmr) { return Math.round(bmr * 1.2); }
function calcMacros(cal, split) {
  const s = { "high-protein": { p: .40, f: .30, c: .30 }, "balanced": { p: .30, f: .30, c: .40 }, "keto": { p: .30, f: .65, c: .05 }, "blueprint": { p: .25, f: .40, c: .35 } }[split] || { p: .35, f: .35, c: .30 };
  return { protein: Math.round((cal * s.p) / 4), fat: Math.round((cal * s.f) / 9), carbs: Math.round((cal * s.c) / 4) };
}
function formatTime(s) { return `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
function today() { return new Date().toISOString().split("T")[0]; }
function useLS(key, init) {
  const [v, sv] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, sv];
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Ic = ({ n, size = 20, color = "currentColor" }) => {
  const d = {
    home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    timer: <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></>,
    food: <><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    blueprint: <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>,
    profile: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    fire: <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    syringe: <><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    droplet: <><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></>,
    brain: <><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></>,
    chevRight: <><polyline points="9 18 15 12 9 6"/></>,
    amazon: null, sprouts: null, walmart: null,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d[n]}</svg>;
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600;700&display=swap');
.fastmode-root,.fastmode-root *,.fastmode-root *::before,.fastmode-root *::after{box-sizing:border-box;margin:0;padding:0}
.fastmode-root{
  --bg:#04040a;--s1:#0a0a14;--s2:#10101c;--s3:#181828;
  --b1:#1c1c2e;--b2:#252538;--b3:#2e2e45;
  --t1:#f0f0f8;--t2:#a0a0c0;--t3:#606080;
  --acc:#5ee7df;--acc2:#b490ca;--acc3:#3dd6f5;
  --grn:#4ade80;--grn2:#16a34a;
  --red:#f87171;--red2:#dc2626;
  --org:#fb923c;--yel:#fbbf24;
  --pur:#a78bfa;--blu:#60a5fa;
  --bp:#10b981;--bp2:#059669;
  --fn:'Syne',sans-serif;--fb:'Instrument Sans',sans-serif;--fm:'JetBrains Mono',monospace;
  --r:10px;--rl:18px;--rx:24px;
  background:var(--bg);color:var(--t1);font-family:var(--fb);min-height:100vh;overflow-x:hidden;
}
.fastmode-root .fastmode-container{max-width:430px;margin:0 auto;min-height:100vh;position:relative}
.fastmode-root .app{padding-bottom:84px;min-height:100vh}
.fastmode-root ::-webkit-scrollbar{width:3px}.fastmode-root ::-webkit-scrollbar-track{background:var(--bg)}.fastmode-root ::-webkit-scrollbar-thumb{background:var(--b3);border-radius:2px}

/* NAV */
.fastmode-root .nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(10,10,20,0.96);backdrop-filter:blur(24px);border-top:1px solid var(--b2);display:flex;z-index:100;padding:8px 0 calc(8px + env(safe-area-inset-bottom))}
.fastmode-root .nb{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 2px;background:none;border:none;cursor:pointer;color:var(--t3);font-family:var(--fb);font-size:9px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;transition:color .2s}
.fastmode-root .nb.on{color:var(--acc)}
.fastmode-root .nb:active{transform:scale(.93)}

/* HEADER */
.fastmode-root .hdr{padding:52px 18px 12px;display:flex;align-items:flex-start;justify-content:space-between}
.fastmode-root .htitle{font-family:var(--fn);font-size:26px;font-weight:800;letter-spacing:-.5px;background:linear-gradient(135deg,var(--t1) 0%,var(--t2) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.fastmode-root .hsub{font-size:11px;color:var(--t3);margin-top:3px;letter-spacing:.5px}

/* CARDS */
.fastmode-root .card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--rl);padding:18px;margin:0 14px 10px;position:relative;overflow:hidden}
.fastmode-root .card::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none}
.fastmode-root .card.gblue::before{background:radial-gradient(ellipse at 50% -20%,rgba(94,231,223,.07) 0%,transparent 65%)}
.fastmode-root .card.ggreen::before{background:radial-gradient(ellipse at 50% -20%,rgba(74,222,128,.07) 0%,transparent 65%)}
.fastmode-root .card.gbp::before{background:radial-gradient(ellipse at 50% -20%,rgba(16,185,129,.1) 0%,transparent 65%)}
.fastmode-root .card.gpur::before{background:radial-gradient(ellipse at 50% -20%,rgba(167,139,250,.07) 0%,transparent 65%)}
.fastmode-root .clabel{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:8px}

/* BUTTONS */
.fastmode-root .btn{padding:13px 18px;border-radius:var(--r);border:none;cursor:pointer;font-family:var(--fb);font-size:13px;font-weight:600;letter-spacing:.3px;transition:all .2s;flex:1}
.fastmode-root .btn:active{transform:scale(.96)}
.fastmode-root .btn.pri{background:var(--acc);color:#000}
.fastmode-root .btn.pri:hover{background:#7eeee8}
.fastmode-root .btn.dan{background:var(--red);color:#fff}
.fastmode-root .btn.suc{background:var(--grn);color:#000}
.fastmode-root .btn.gho{background:var(--s2);color:var(--t1);border:1px solid var(--b2)}
.fastmode-root .btn.gho:hover{border-color:var(--acc);color:var(--acc)}
.fastmode-root .btn.bp{background:var(--bp);color:#000}
.fastmode-root .btn.bp:hover{background:#34d399}
.fastmode-root .btn.sm{padding:7px 12px;font-size:11px;flex:unset}
.fastmode-root .btn.ico{padding:9px;border-radius:8px;display:flex;align-items:center;justify-content:center}
.fastmode-root .brow{display:flex;gap:10px;margin-top:16px}

/* TIMER */
.fastmode-root .tring{position:relative;width:210px;height:210px;margin:16px auto}
.fastmode-root .tsvg{transform:rotate(-90deg)}
.fastmode-root .trbg{fill:none;stroke:var(--b2);stroke-width:7}
.fastmode-root .trprog{fill:none;stroke-width:7;stroke-linecap:round;transition:stroke-dashoffset 1s linear,stroke .5s}
.fastmode-root .tinner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.fastmode-root .ttime{font-family:var(--fm);font-size:30px;font-weight:700;letter-spacing:1px}
.fastmode-root .tphase{font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-top:4px}

/* PROGRESS */
.fastmode-root .pbar{height:6px;background:var(--b2);border-radius:3px;overflow:hidden}
.fastmode-root .pfill{height:100%;border-radius:3px;transition:width .6s ease}

/* MACROS */
.fastmode-root .mrow{display:flex;gap:6px;margin-top:10px}
.fastmode-root .mp{flex:1;background:var(--s2);border-radius:8px;padding:9px;text-align:center;border:1px solid var(--b1)}
.fastmode-root .mpv{font-family:var(--fm);font-size:14px;font-weight:700}
.fastmode-root .mpl{font-size:9px;color:var(--t3);margin-top:1px;letter-spacing:1px;text-transform:uppercase}

/* INPUT */
.fastmode-root .ig{margin-bottom:14px}
.fastmode-root .il{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:5px;display:block}
.fastmode-root .inp{width:100%;background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:11px 13px;color:var(--t1);font-family:var(--fb);font-size:14px;outline:none;transition:border-color .2s}
.fastmode-root .inp:focus{border-color:var(--acc)}
.fastmode-root .inp::placeholder{color:var(--t3)}
select.inp{cursor:pointer}
.fastmode-root .irow{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* FOOD ITEM */
.fastmode-root .fi{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--b1)}
.fastmode-root .fi:last-child{border-bottom:none}
.fastmode-root .fn2{font-size:13px;font-weight:500}
.fastmode-root .fm2{font-size:10px;color:var(--t3);margin-top:1px}
.fastmode-root .fcal{font-family:var(--fm);font-size:13px;font-weight:700;color:var(--acc)}

/* MODAL */
.fastmode-root .mo{position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:flex-end;justify-content:center;animation:fi .2s}
.fastmode-root .md{background:var(--s1);border:1px solid var(--b2);border-radius:22px 22px 0 0;width:100%;max-width:430px;padding:22px 18px 44px;max-height:92vh;overflow-y:auto;animation:su .3s ease}
.fastmode-root .mh{width:36px;height:4px;background:var(--b3);border-radius:2px;margin:0 auto 20px}
.fastmode-root .mt{font-family:var(--fn);font-size:22px;font-weight:800;letter-spacing:-.5px;margin-bottom:18px}
@keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes fi{from{opacity:0}to{opacity:1}}

/* SCROLL ROW */
.fastmode-root .scr{display:flex;gap:8px;overflow-x:auto;padding:0 14px 8px;scrollbar-width:none}
.fastmode-root .scr::-webkit-scrollbar{display:none}
.fastmode-root .sb{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:12px 14px;flex-shrink:0}
.fastmode-root .sbv{font-family:var(--fm);font-size:18px;font-weight:700}
.fastmode-root .sbl{font-size:9px;color:var(--t3);margin-top:2px;letter-spacing:1px;text-transform:uppercase}

/* STREAK */
.fastmode-root .streak{display:inline-flex;align-items:center;gap:5px;background:rgba(251,146,60,.12);border:1px solid rgba(251,146,60,.25);border-radius:16px;padding:5px 12px;font-size:12px;font-weight:700;color:var(--org)}

/* BLUEPRINT MEAL */
.fastmode-root .bpcard{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:14px;margin-bottom:8px;cursor:pointer;transition:border-color .2s}
.fastmode-root .bpcard:hover{border-color:var(--bp)}
.fastmode-root .bptag{display:inline-flex;align-items:center;gap:3px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);border-radius:10px;padding:3px 8px;font-size:9px;font-weight:700;letter-spacing:1px;color:var(--bp);text-transform:uppercase;margin-right:4px}
.fastmode-root .lscore{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--bp)}

/* STORE BADGE */
.fastmode-root .store-az{background:rgba(255,153,0,.1);border:1px solid rgba(255,153,0,.25);color:#ff9900;border-radius:6px;padding:2px 7px;font-size:9px;font-weight:700}
.fastmode-root .store-sp{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);color:var(--grn);border-radius:6px;padding:2px 7px;font-size:9px;font-weight:700}
.fastmode-root .store-wm{background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.25);color:var(--blu);border-radius:6px;padding:2px 7px;font-size:9px;font-weight:700}

/* TABS */
.fastmode-root .tabrow{display:flex;gap:6px;padding:0 14px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none}
.fastmode-root .tabrow::-webkit-scrollbar{display:none}
.fastmode-root .tab{padding:7px 14px;border-radius:20px;border:1px solid var(--b2);background:var(--s2);color:var(--t3);font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .2s}
.fastmode-root .tab.on{background:var(--acc);color:#000;border-color:var(--acc)}

/* AI */
.fastmode-root .aibubble{background:linear-gradient(135deg,rgba(94,231,223,.08),rgba(180,144,202,.08));border:1px solid rgba(94,231,223,.2);border-radius:var(--r) var(--r) var(--r) 0;padding:12px 14px;font-size:13px;line-height:1.6;color:var(--t1);margin-bottom:10px}
.fastmode-root .aibubble.loading{color:var(--t3)}
.fastmode-root .aidot{display:inline-block;width:6px;height:6px;border-radius:3px;background:var(--acc);margin-right:4px;animation:pulse 1.2s infinite}
.fastmode-root .aidot:nth-child(2){animation-delay:.2s}
.fastmode-root .aidot:nth-child(3){animation-delay:.4s}
@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}

/* BADGE */
.fastmode-root .bgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.fastmode-root .bi{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:5px}
.fastmode-root .biicon{font-size:22px;filter:grayscale(1);opacity:.25;transition:all .3s}
.fastmode-root .bi.on .biicon{filter:none;opacity:1}
.fastmode-root .biname{font-size:9px;color:var(--t3);text-align:center;font-weight:600;letter-spacing:.5px}
.fastmode-root .bi.on .biname{color:var(--t2)}

/* PHASE */
.fastmode-root .phitem{display:flex;gap:12px;padding:10px 0}
.fastmode-root .phdot{width:10px;height:10px;border-radius:5px;background:var(--b3);flex-shrink:0;margin-top:3px}
.fastmode-root .phdot.act{background:var(--acc);box-shadow:0 0 8px var(--acc)}
.fastmode-root .phdot.done{background:var(--grn)}
.fastmode-root .phconn{width:2px;flex:1;background:var(--b2);margin-top:4px}

/* SEARCH RESULT */
.fastmode-root .sr{padding:9px 12px;border-bottom:1px solid var(--b1);cursor:pointer;transition:background .15s}
.fastmode-root .sr:hover{background:var(--b1)}
.fastmode-root .sr:last-child{border-bottom:none}

/* MISC */
.fastmode-root .flex{display:flex}.fastmode-root .fdc{flex-direction:column}.fastmode-root .ac{align-items:center}.fastmode-root .jb{justify-content:space-between}.fastmode-root .gap6{gap:6px}.fastmode-root .gap8{gap:8px}.fastmode-root .gap12{gap:12px}.fastmode-root .f1{flex:1}
.fastmode-root .tacc{color:var(--acc)}.fastmode-root .tgrn{color:var(--grn)}.fastmode-root .tred{color:var(--red)}.fastmode-root .torg{color:var(--org)}.fastmode-root .tmut{color:var(--t3)}.fastmode-root .tbp{color:var(--bp)}.fastmode-root .tpur{color:var(--pur)}
.fastmode-root .sm{font-size:12px}.fastmode-root .xs{font-size:10px}.fastmode-root .fw6{font-weight:600}.fastmode-root .fn3{font-family:var(--fn)}.fastmode-root .fm3{font-family:var(--fm)}
.fastmode-root .mt4{margin-top:4px}.fastmode-root .mt8{margin-top:8px}.fastmode-root .mt12{margin-top:12px}.fastmode-root .mt16{margin-top:16px}
.fastmode-root .shdr{padding:14px 18px 4px;display:flex;align-items:center;justify-content:space-between}
.fastmode-root .stitle{font-size:11px;font-weight:700;letter-spacing:2px;color:var(--t3);text-transform:uppercase}
.fastmode-root .grad{background:linear-gradient(135deg,var(--acc),var(--pur));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.fastmode-root .gradbp{background:linear-gradient(135deg,var(--bp),var(--acc));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.fastmode-root .toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);background:var(--s1);border:1px solid var(--grn);color:var(--grn);padding:10px 18px;border-radius:18px;font-size:12px;font-weight:700;z-index:500;animation:tfi .3s ease;white-space:nowrap}
@keyframes tfi{from{opacity:0;top:6px}to{opacity:1;top:18px}}
.fastmode-root .onboard{min-height:100vh;display:flex;flex-direction:column;padding:44px 20px 28px}
.fastmode-root .ologo{font-family:var(--fn);font-size:52px;font-weight:800;letter-spacing:-1px;text-align:center;line-height:1}
.fastmode-root .otagline{text-align:center;color:var(--t3);font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:6px;margin-bottom:36px}
.fastmode-root .sdot{width:6px;height:6px;border-radius:3px;background:var(--b3);transition:all .3s}
.fastmode-root .sdot.act{width:20px;background:var(--acc)}
.fastmode-root .sdot.done{background:var(--grn)}
.fastmode-root .prcard{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:var(--r);border:1px solid var(--b2);background:var(--s2);cursor:pointer;margin-bottom:7px;transition:all .2s}
.fastmode-root .prcard.sel{border-color:var(--acc);background:rgba(94,231,223,.05)}
.fastmode-root .togbtn{padding:8px 14px;border-radius:7px;border:1px solid var(--b2);background:var(--s2);color:var(--t3);font-family:var(--fb);font-size:12px;cursor:pointer;transition:all .2s}
.fastmode-root .togbtn.sel{border-color:var(--acc);color:var(--acc);background:rgba(94,231,223,.07)}
.fastmode-root .inglist{max-height:240px;overflow-y:auto;margin:10px 0}
.fastmode-root .ing{display:flex;align-items:flex-start;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b1);gap:10px}
.fastmode-root .ing:last-child{border-bottom:none}
`;

// ─── TOAST ───────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

// ─── AI COACH ────────────────────────────────────────────────────────────────
async function askAI(prompt) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: "You are FASTMODE AI Coach — an expert in intermittent fasting, fat loss, longevity nutrition (Bryan Johnson Blueprint protocol), and peptide optimization. Give concise, actionable, science-backed advice in 2-4 sentences. Be direct and motivating. No fluff. Format with line breaks for readability.",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || "Unable to connect. Please try again.";
  } catch {
    return "AI Coach offline. Check connection.";
  }
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [d, sd] = useState({
    name: "", age: 30, sex: "male", weight: 200, height: 70, goalWeight: 160,
    calTarget: 0, macroSplit: "high-protein", protocol: "custom",
    usePeptides: true, useBlueprint: false,
    phases: [
      { name: "Extended Fast", type: "fast", days: 5, label: "Water + electrolytes only" },
      { name: "20:4 Aggressive", type: "window", hours: 20, eatHours: 4, weeks: 2, label: "20hr fast / 4hr eat" },
      { name: "18:6 Sustain", type: "window", hours: 18, eatHours: 6, weeks: 999, label: "18hr fast / 6hr eat" },
    ],
    currentPhaseIdx: 0, phaseStart: today(),
    peptides: [{ id: 1, name: "AOD-9604", dose: "300mcg", schedule: "morning", cycleStart: today(), cycleDays: 90 }],
  });
  const set = (k, v) => sd(p => ({ ...p, [k]: v }));
  const bmr = calcBMR(d.weight, d.height, d.age, d.sex);
  const target = Math.round(calcTDEE(bmr) - 500);
  const macros = calcMacros(d.calTarget || target, d.macroSplit);
  const hFt = Math.floor(d.height / 12), hIn = d.height % 12;
  const STEPS = 5;

  return (
    <div className="onboard">
      <div className="ologo"><span className="grad">FAST</span>MODE</div>
      <div className="otagline">Fast hard. Live lean. Live long.</div>
      <div className="flex ac" style={{ gap: 5, justifyContent: "center", marginBottom: 28 }}>
        {Array.from({ length: STEPS }).map((_, i) => <div key={i} className={`sdot ${i < step ? "done" : i === step ? "act" : ""}`} />)}
      </div>

      {step === 0 && <>
        <div className="fn3" style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>WHO ARE YOU?</div>
        <div className="tmut sm mt4" style={{ marginBottom: 22, lineHeight: 1.5 }}>Your stats power every calculation.</div>
        <div className="ig"><label className="il">First Name</label><input className="inp" placeholder="Your name" value={d.name} onChange={e => set("name", e.target.value)} /></div>
        <div className="irow"><div className="ig"><label className="il">Age</label><input className="inp" type="number" value={d.age} onChange={e => set("age", +e.target.value)} /></div><div className="ig"><label className="il">Sex</label><select className="inp" value={d.sex} onChange={e => set("sex", e.target.value)}><option value="male">Male</option><option value="female">Female</option></select></div></div>
        <div className="irow"><div className="ig"><label className="il">Weight (lbs)</label><input className="inp" type="number" value={d.weight} onChange={e => set("weight", +e.target.value)} /></div><div className="ig"><label className="il">Goal (lbs)</label><input className="inp" type="number" value={d.goalWeight} onChange={e => set("goalWeight", +e.target.value)} /></div></div>
        <div className="irow"><div className="ig"><label className="il">Height ft</label><input className="inp" type="number" value={hFt} onChange={e => set("height", +e.target.value * 12 + hIn)} /></div><div className="ig"><label className="il">Height in</label><input className="inp" type="number" value={hIn} onChange={e => set("height", hFt * 12 + +e.target.value)} /></div></div>
      </>}

      {step === 1 && <>
        <div className="fn3" style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>YOUR PROTOCOL</div>
        <div className="tmut sm" style={{ marginBottom: 20, lineHeight: 1.5 }}>Custom lets you chain phases — extended fast → eating windows.</div>
        {[
          { id: "16:8", icon: "⏱", name: "16:8", desc: "Fast 16hrs, eat 8hrs" },
          { id: "18:6", icon: "🔥", name: "18:6", desc: "Fast 18hrs, eat 6hrs" },
          { id: "20:4", icon: "⚡", name: "20:4", desc: "Fast 20hrs, eat 4hrs" },
          { id: "omad", icon: "💀", name: "OMAD", desc: "One meal a day — Bryan Johnson style" },
          { id: "custom", icon: "🎯", name: "Custom Phases", desc: "Extended fast → phased windows (recommended)" },
        ].map(p => (
          <div key={p.id} className={`prcard ${d.protocol === p.id ? "sel" : ""}`} onClick={() => set("protocol", p.id)}>
            <span style={{ fontSize: 22 }}>{p.icon}</span>
            <div className="f1"><div className="fw6" style={{ fontSize: 14 }}>{p.name}</div><div className="xs tmut mt4">{p.desc}</div></div>
            {d.protocol === p.id && <span className="tacc" style={{ fontSize: 16 }}>✓</span>}
          </div>
        ))}
      </>}

      {step === 2 && <>
        <div className="fn3" style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>BLUEPRINT MODE?</div>
        <div className="tmut sm" style={{ marginBottom: 18, lineHeight: 1.5 }}>Layer Bryan Johnson's Blueprint longevity protocol on top of your fasting — anti-aging meal plans, polyphenol targets, and longevity scoring.</div>
        <div className="flex gap8" style={{ marginBottom: 20 }}>
          <button className={`togbtn ${d.useBlueprint ? "sel" : ""}`} onClick={() => set("useBlueprint", true)}>✓ Enable Blueprint Mode</button>
          <button className={`togbtn ${!d.useBlueprint ? "sel" : ""}`} onClick={() => set("useBlueprint", false)}>Skip for now</button>
        </div>
        {d.useBlueprint && <div style={{ background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.2)", borderRadius: "var(--r)", padding: 14, marginBottom: 16 }}>
          <div className="flex ac gap8 mb" style={{ marginBottom: 10 }}><span>🌿</span><span className="fw6 tbp sm">Blueprint Principles Enabled</span></div>
          {["Super Veggie & Nutty Pudding meal templates", "Store shopping guide (Amazon, Sprouts, Walmart)", "Longevity score for every meal", "Anti-inflammatory food recommendations", "No added sugar / seed oil tracking"].map((t, i) => (
            <div key={i} className="flex ac gap8" style={{ padding: "5px 0", borderBottom: i < 4 ? "1px solid rgba(16,185,129,.1)" : "none" }}>
              <span className="tbp" style={{ fontSize: 11 }}>✓</span><span className="xs" style={{ color: "var(--t2)" }}>{t}</span>
            </div>
          ))}
        </div>}
        <div className="ig"><label className="il">Macro Split</label>
          <select className="inp" value={d.macroSplit} onChange={e => set("macroSplit", e.target.value)}>
            <option value="high-protein">High Protein (40P/30F/30C)</option>
            <option value="balanced">Balanced (30P/30F/40C)</option>
            <option value="keto">Keto (30P/65F/5C)</option>
            <option value="blueprint">Blueprint (25P/40F/35C)</option>
          </select>
        </div>
        <div style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--r)", padding: 14 }}>
          <div className="flex jb" style={{ marginBottom: 6 }}><span className="tmut xs">Maintenance (TDEE)</span><span className="fm3 fw6">{calcTDEE(bmr)} kcal</span></div>
          <div className="flex jb" style={{ marginBottom: 6 }}><span className="tmut xs">Fat Loss Target</span><span className="fm3 fw6 tacc">{target} kcal</span></div>
          <div className="mrow"><div className="mp"><div className="mpv tacc">{macros.protein}g</div><div className="mpl">Protein</div></div><div className="mp"><div className="mpv torg">{macros.fat}g</div><div className="mpl">Fat</div></div><div className="mp"><div className="mpv tgrn">{macros.carbs}g</div><div className="mpl">Carbs</div></div></div>
        </div>
      </>}

      {step === 3 && <>
        <div className="fn3" style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>PEPTIDES</div>
        <div className="tmut sm" style={{ marginBottom: 18, lineHeight: 1.5 }}>Track peptide cycles, compliance, and injection schedules.</div>
        <div className="flex gap8" style={{ marginBottom: 14 }}>
          <button className={`togbtn ${d.usePeptides ? "sel" : ""}`} onClick={() => set("usePeptides", true)}>Yes, I use peptides</button>
          <button className={`togbtn ${!d.usePeptides ? "sel" : ""}`} onClick={() => set("usePeptides", false)}>No</button>
        </div>
        {d.usePeptides && d.peptides.map((p, i) => (
          <div key={p.id} style={{ background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "var(--r)", padding: 12, marginBottom: 8 }}>
            <div className="irow" style={{ marginBottom: 8 }}>
              <div className="ig" style={{ marginBottom: 0 }}><label className="il">Name</label><input className="inp" value={p.name} onChange={e => { const a = [...d.peptides]; a[i] = { ...a[i], name: e.target.value }; set("peptides", a); }} /></div>
              <div className="ig" style={{ marginBottom: 0 }}><label className="il">Dose</label><input className="inp" value={p.dose} onChange={e => { const a = [...d.peptides]; a[i] = { ...a[i], dose: e.target.value }; set("peptides", a); }} placeholder="300mcg" /></div>
            </div>
            <div className="irow">
              <div className="ig" style={{ marginBottom: 0 }}><label className="il">Schedule</label><select className="inp" value={p.schedule} onChange={e => { const a = [...d.peptides]; a[i] = { ...a[i], schedule: e.target.value }; set("peptides", a); }}><option value="morning">Morning</option><option value="evening">Evening</option><option value="both">Both</option></select></div>
              <div className="ig" style={{ marginBottom: 0 }}><label className="il">Cycle Days</label><input className="inp" type="number" value={p.cycleDays} onChange={e => { const a = [...d.peptides]; a[i] = { ...a[i], cycleDays: +e.target.value }; set("peptides", a); }} /></div>
            </div>
          </div>
        ))}
        {d.usePeptides && <button className="btn gho sm" onClick={() => set("peptides", [...d.peptides, { id: Date.now(), name: "", dose: "", schedule: "morning", cycleStart: today(), cycleDays: 90 }])}>+ Add Peptide</button>}
      </>}

      {step === 4 && <>
        <div className="fn3" style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>YOU'RE SET{d.name ? `, ${d.name.toUpperCase()}` : ""}.</div>
        <div className="tmut sm" style={{ marginBottom: 18 }}>Your protocol is ready. Time to get lean.</div>
        <div className="card gblue" style={{ margin: "0 0 10px" }}>
          <div className="flex jb mt4" style={{ marginBottom: 7 }}><span className="tmut xs">Weight to lose</span><span className="fm3 fw6 torg">{d.weight - d.goalWeight} lbs</span></div>
          <div className="flex jb" style={{ marginBottom: 7 }}><span className="tmut xs">Daily Calories</span><span className="fm3 fw6 tacc">{target} kcal</span></div>
          <div className="flex jb"><span className="tmut xs">Protocol</span><span className="fm3 fw6">{d.phases[0].name}</span></div>
        </div>
        {d.useBlueprint && <div className="card gbp" style={{ margin: "0 0 10px" }}>
          <div className="clabel">Blueprint Mode Active 🌿</div>
          <div className="xs" style={{ color: "var(--t2)", lineHeight: 1.6 }}>Super Veggie, Nutty Pudding, Green Giant, and Blueprint Buddha Bowl are loaded as meal templates. Store shopping guides for Amazon, Sprouts, and Walmart are ready.</div>
        </div>}
        <div className="card" style={{ margin: "0 0 16px" }}>
          <div className="clabel">Est. Timeline</div>
          <div className="fn3" style={{ fontSize: 18 }}>~{Math.round((d.weight - d.goalWeight) / 1.5)} weeks</div>
          <div className="xs tmut mt4">At 1.5 lbs/week average fat loss</div>
        </div>
      </>}

      <div style={{ marginTop: "auto", display: "flex", gap: 10 }}>
        {step > 0 && <button className="btn gho" style={{ flex: "0 0 auto", padding: "13px 18px" }} onClick={() => setStep(s => s - 1)}>Back</button>}
        <button className="btn pri" onClick={() => step < STEPS - 1 ? setStep(s => s + 1) : onDone({ ...d, calTarget: d.calTarget || target, macros, setup: true, phaseStart: today(), currentPhaseIdx: 0 })}>
          {step < STEPS - 1 ? "Continue →" : "Launch FASTMODE 🚀"}
        </button>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ profile, fastState, foodLogs, weightLogs, peptideLogs, waterLogs, onNav }) {
  const [aiMsg, setAiMsg] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const todayLogs = foodLogs.filter(f => f.date === today());
  const calsEaten = todayLogs.reduce((s, f) => s + f.calories, 0);
  const phase = profile.phases?.[profile.currentPhaseIdx] || profile.phases?.[0];
  const latestW = weightLogs.length ? weightLogs[weightLogs.length - 1].weight : profile.weight;
  const lost = profile.weight - latestW;
  const waterToday = waterLogs.filter(w => w.date === today()).reduce((s, w) => s + w.cups, 0);
  const waterGoal = profile.waterGoal || Math.round((profile.weight || 200) * 0.5 / 8);
  const protein = todayLogs.reduce((s, f) => s + (f.protein || 0), 0);

  const getCoach = async () => {
    setAiLoading(true);
    const fastHours = fastState.active && fastState.startTime ? Math.floor((Date.now() - fastState.startTime) / 3600000) : 0;
    const msg = await askAI(`User stats: ${profile.weight}lbs, goal ${profile.goalWeight}lbs, ${profile.age}yo ${profile.sex}. Currently ${fastState.active ? `${fastHours} hours into a fast` : "in eating window"}. Calories today: ${calsEaten}/${profile.calTarget}. Protein: ${protein}g. Phase: ${phase?.name}. ${profile.peptides?.[0] ? `Using ${profile.peptides[0].name} ${profile.peptides[0].dose}.` : ""} ${profile.useBlueprint ? "Following Blueprint protocol." : ""} Give a quick coaching tip for right now.`);
    setAiMsg(msg);
    setAiLoading(false);
  };

  useEffect(() => { getCoach(); }, []);

  return (
    <div>
      <div className="hdr">
        <div><div className="htitle">HEY, {(profile.name || "CHAMP").toUpperCase()} 👋</div><div className="hsub">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div></div>
        <div className="streak"><Ic n="fire" size={13} color="var(--org)" /> {fastState.streak || 0} days</div>
      </div>

      {/* AI Coach */}
      <div className="card gpur" style={{ cursor: "pointer" }} onClick={getCoach}>
        <div className="flex ac jb" style={{ marginBottom: 8 }}>
          <div className="flex ac gap6"><Ic n="brain" size={14} color="var(--pur)" /><span className="xs fw6 tpur" style={{ letterSpacing: 1 }}>AI COACH</span></div>
          <span className="xs tmut">tap to refresh</span>
        </div>
        {aiLoading ? <div className="aibubble loading"><span className="aidot" /><span className="aidot" /><span className="aidot" /></div>
          : <div className="aibubble">{aiMsg || "Loading your coaching tip..."}</div>}
      </div>

      {/* Phase + Timer */}
      <div className="card gblue" style={{ cursor: "pointer" }} onClick={() => onNav("timer")}>
        <div className="flex ac jb">
          <div><div className="clabel">PHASE</div><div className="fn3" style={{ fontSize: 18, fontWeight: 800, letterSpacing: -.5 }}>{phase?.name}</div><div className="xs tmut mt4">{phase?.label}</div></div>
          <div className="flex fdc ac gap6">
            <div style={{ width: 10, height: 10, borderRadius: 5, background: fastState.active ? "var(--red)" : "var(--grn)", boxShadow: fastState.active ? "0 0 8px var(--red)" : "0 0 8px var(--grn)" }} />
            <span className="xs fw6" style={{ color: fastState.active ? "var(--red)" : "var(--grn)" }}>{fastState.active ? "FASTING" : "EATING"}</span>
            <Ic n="chevRight" size={14} color="var(--t3)" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="scr">
        <div className="sb"><div className="sbv tacc">{Math.max(0, (profile.calTarget || 1800) - calsEaten)}</div><div className="sbl">Cals Left</div></div>
        <div className="sb"><div className="sbv tgrn">{lost > 0 ? lost.toFixed(1) : "0"} lbs</div><div className="sbl">Lost</div></div>
        <div className="sb"><div className="sbv torg">{waterToday}/{waterGoal}</div><div className="sbl">Water</div></div>
        <div className="sb"><div className="sbv">{latestW}</div><div className="sbl">lbs now</div></div>
        {profile.useBlueprint && <div className="sb"><div className="sbv tbp">ON</div><div className="sbl">Blueprint</div></div>}
      </div>

      {/* Calories */}
      <div className="card">
        <div className="flex ac jb" style={{ marginBottom: 10 }}>
          <div className="clabel" style={{ marginBottom: 0 }}>TODAY'S CALORIES</div>
          <button className="btn gho sm" onClick={() => onNav("food")}>+ Log Food</button>
        </div>
        <div className="flex ac jb" style={{ marginBottom: 8 }}><span className="fm3" style={{ fontSize: 26, fontWeight: 700, color: calsEaten > (profile.calTarget || 1800) ? "var(--red)" : "var(--acc)" }}>{calsEaten}</span><span className="tmut sm">/ {profile.calTarget || 1800} kcal</span></div>
        <div className="pbar"><div className="pfill" style={{ width: `${Math.min(100, (calsEaten / (profile.calTarget || 1800)) * 100)}%`, background: calsEaten > (profile.calTarget || 1800) ? "var(--red)" : "linear-gradient(90deg,var(--acc),var(--grn))" }} /></div>
        <div className="mrow">
          <div className="mp"><div className="mpv tacc">{todayLogs.reduce((s, f) => s + (f.protein || 0), 0)}g</div><div className="mpl">Protein</div></div>
          <div className="mp"><div className="mpv torg">{todayLogs.reduce((s, f) => s + (f.fat || 0), 0)}g</div><div className="mpl">Fat</div></div>
          <div className="mp"><div className="mpv tgrn">{todayLogs.reduce((s, f) => s + (f.carbs || 0), 0)}g</div><div className="mpl">Carbs</div></div>
          {profile.useBlueprint && <div className="mp"><div className="mpv tbp">{todayLogs.reduce((s, f) => s + (f.fiber || 0), 0)}g</div><div className="mpl">Fiber</div></div>}
        </div>
      </div>

      {/* Blueprint Today */}
      {profile.useBlueprint && (
        <div className="card gbp" style={{ cursor: "pointer" }} onClick={() => onNav("blueprint")}>
          <div className="flex ac jb">
            <div><div className="clabel">BLUEPRINT TODAY</div><div className="sm fw6 tbp">View meal templates & shopping</div></div>
            <Ic n="leaf" size={18} color="var(--bp)" />
          </div>
        </div>
      )}

      {/* Peptide checklist */}
      {profile.usePeptides && profile.peptides?.length > 0 && (
        <div className="card gblue">
          <div className="flex ac jb" style={{ marginBottom: 10 }}><div className="clabel" style={{ marginBottom: 0 }}>PEPTIDES TODAY</div><button className="btn gho sm" onClick={() => onNav("peptide")}>View</button></div>
          {profile.peptides.map(p => {
            const done = peptideLogs.some(l => l.date === today() && l.peptideId === p.id);
            return <div key={p.id} className="flex ac gap8" style={{ padding: "7px 0", borderBottom: "1px solid var(--b1)" }}>
              <Ic n="syringe" size={13} color="var(--pur)" />
              <div className="f1"><div className="xs fw6">{p.name}</div><div className="xs tmut">{p.dose} · {p.schedule}</div></div>
              <span className="xs fw6" style={{ color: done ? "var(--grn)" : "var(--t3)" }}>{done ? "✓" : "·"}</span>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function TimerScreen({ profile, fastState, setFastState }) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef(null);
  const phase = profile.phases?.[profile.currentPhaseIdx] || profile.phases?.[0];
  const fastH = phase?.type === "fast" ? (phase.days || 1) * 24 : (phase?.hours || 18);
  const eatH = phase?.eatHours || 6;
  const fastSec = fastH * 3600;
  const cycleSec = (fastH + eatH) * 3600;
  const isFasting = elapsed < fastSec;
  const remaining = Math.max(0, isFasting ? fastSec - elapsed : cycleSec - elapsed);
  const prog = isFasting ? elapsed / fastSec : (elapsed - fastSec) / (eatH * 3600);
  const R = 88, circ = 2 * Math.PI * R;

  useEffect(() => {
    if (fastState.active && fastState.startTime) {
      const tick = () => setElapsed(Math.floor((Date.now() - fastState.startTime) / 1000));
      tick();
      ref.current = setInterval(tick, 1000);
    } else setElapsed(0);
    return () => clearInterval(ref.current);
  }, [fastState.active, fastState.startTime]);

  const fasting_stages = [
    { h: 0, icon: "🍽", label: "Digestion", desc: "Body processing last meal" },
    { h: 4, icon: "🔋", label: "Glycogen Depletion", desc: "Liver glycogen running low" },
    { h: 8, icon: "⚡", label: "Fat Burning Begins", desc: "Ketone production starting" },
    { h: 14, icon: "🧬", label: "Autophagy Activating", desc: "Cellular cleanup underway" },
    { h: 18, icon: "🔥", label: "Deep Ketosis", desc: "Peak fat oxidation" },
    { h: 24, icon: "🧪", label: "Full Autophagy", desc: "Maximum cellular regeneration" },
    { h: 48, icon: "💎", label: "Stem Cell Boost", desc: "Stem cell production surges" },
    { h: 72, icon: "👑", label: "Deep Renewal", desc: "Immune system reset" },
  ];
  const currentHour = Math.floor(elapsed / 3600);
  const activeStage = fasting_stages.filter(s => s.h <= currentHour).pop() || fasting_stages[0];

  return (
    <div>
      <div className="hdr"><div><div className="htitle">FAST TIMER</div><div className="hsub">{phase?.name}</div></div><div className="streak"><Ic n="fire" size={13} color="var(--org)" /> {fastState.streak || 0} days</div></div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 18px 16px" }}>
        <div className="tring">
          <svg className="tsvg" width="210" height="210" viewBox="0 0 210 210">
            <circle className="trbg" cx="105" cy="105" r={R} />
            <circle className="trprog" cx="105" cy="105" r={R} strokeDasharray={circ} strokeDashoffset={circ - Math.min(1, prog) * circ} stroke={fastState.active ? (isFasting ? "var(--red)" : "var(--grn)") : "var(--b3)"} />
          </svg>
          <div className="tinner">
            <div className="ttime" style={{ color: fastState.active ? (isFasting ? "var(--red)" : "var(--grn)") : "var(--t3)" }}>{formatTime(remaining)}</div>
            <div className="tphase" style={{ color: fastState.active ? (isFasting ? "var(--red)" : "var(--grn)") : "var(--t3)" }}>{fastState.active ? (isFasting ? "FASTING" : "EATING") : "PAUSED"}</div>
            {fastState.active && isFasting && <div className="xs tmut" style={{ marginTop: 5 }}>{currentHour}h elapsed</div>}
          </div>
        </div>

        {/* Fasting Stage */}
        {fastState.active && isFasting && (
          <div style={{ background: "rgba(94,231,223,.06)", border: "1px solid rgba(94,231,223,.15)", borderRadius: "var(--r)", padding: "10px 16px", width: "100%", marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{activeStage.icon}</div>
            <div className="fw6 sm tacc">{activeStage.label}</div>
            <div className="xs tmut mt4">{activeStage.desc}</div>
          </div>
        )}

        <div className="brow" style={{ width: "100%", maxWidth: 280 }}>
          {!fastState.active
            ? <button className="btn dan" onClick={() => setFastState(p => ({ ...p, active: true, startTime: Date.now(), streak: (p.streak || 0) + (p.lastFastDate !== today() ? 1 : 0), lastFastDate: today() }))}>START FAST</button>
            : <><button className="btn suc" onClick={() => setFastState(p => ({ ...p, active: false, startTime: null }))}>PAUSE</button><button className="btn gho" onClick={() => setFastState(p => ({ ...p, active: false, startTime: null }))}>END</button></>}
        </div>

        {/* Fast stats */}
        <div className="card" style={{ width: "100%", margin: "14px 0 0" }}>
          <div className="flex jb" style={{ marginBottom: 8 }}><span className="tmut xs">Fast Window</span><span className="fm3 fw6 tred">{fastH}h</span></div>
          {phase?.type !== "fast" && <div className="flex jb" style={{ marginBottom: 8 }}><span className="tmut xs">Eating Window</span><span className="fm3 fw6 tgrn">{eatH}h</span></div>}
          <div className="flex jb"><span className="tmut xs">Phase</span><span className="fm3 fw6 tacc">{phase?.name}</span></div>
        </div>
      </div>

      {/* Fasting Stages Timeline */}
      <div className="shdr"><div className="stitle">Fasting Stages</div></div>
      <div className="card" style={{ paddingTop: 10 }}>
        {fasting_stages.map((s, i) => {
          const reached = currentHour >= s.h && fastState.active;
          return <div key={i} className="flex ac gap8" style={{ padding: "8px 0", borderBottom: i < fasting_stages.length - 1 ? "1px solid var(--b1)" : "none", opacity: reached ? 1 : 0.4 }}>
            <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{s.icon}</span>
            <div className="f1"><div className="xs fw6" style={{ color: reached ? "var(--acc)" : "var(--t2)" }}>{s.label}</div><div className="xs tmut mt4">{s.desc}</div></div>
            <span className="xs tmut">{s.h}h+</span>
          </div>;
        })}
      </div>

      {/* Phase Timeline */}
      <div className="shdr"><div className="stitle">Your Protocol</div></div>
      <div className="card">
        {(profile.phases || []).map((ph, i) => {
          const isAct = i === (profile.currentPhaseIdx || 0), isDone = i < (profile.currentPhaseIdx || 0);
          return <div key={i} className="phitem">
            <div className="flex fdc ac"><div className={`phdot ${isAct ? "act" : isDone ? "done" : ""}`} />{i < profile.phases.length - 1 && <div className="phconn" />}</div>
            <div style={{ paddingBottom: 10 }}>
              <div className="fw6 sm" style={{ color: isAct ? "var(--acc)" : isDone ? "var(--t3)" : "var(--t1)" }}>{ph.name}</div>
              <div className="xs tmut mt4">{ph.label}</div>
              {isAct && <span className="xs tacc fw6" style={{ letterSpacing: 1 }}>● ACTIVE</span>}
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

// ─── FOOD SCREEN ──────────────────────────────────────────────────────────────
function FoodScreen({ profile, foodLogs, setFoodLogs, waterLogs, setWaterLogs }) {
  const [showAdd, setShowAdd] = useState(false);
  const [q, setQ] = useState(""); const [res, setRes] = useState([]); const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", meal: "Lunch" });
  const [storeFilter, setStoreFilter] = useState("all");
  const todayLogs = foodLogs.filter(f => f.date === today());
  const cals = todayLogs.reduce((s, f) => s + f.calories, 0);
  const cal = profile.calTarget || 1800;
  const macros = calcMacros(cal, profile.macroSplit || "high-protein");
  const waterToday = waterLogs.filter(w => w.date === today()).reduce((s, w) => s + w.cups, 0);
  const waterGoal = profile.waterGoal || Math.round((profile.weight || 200) * 0.5 / 8);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    // Search store foods first
    const storeResults = STORE_FOODS.filter(f =>
      f.name.toLowerCase().includes(q.toLowerCase()) &&
      (storeFilter === "all" || f.store === storeFilter)
    );
    // Also search Open Food Facts
    try {
      const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=4`);
      const data = await r.json();
      const off = (data.products || []).filter(p => p.product_name && p.nutriments?.["energy-kcal_100g"]).map(p => ({
        id: `off-${p.id}`, name: p.product_name, calories: Math.round(p.nutriments?.["energy-kcal_100g"] || 0),
        protein: Math.round(p.nutriments?.proteins_100g || 0), carbs: Math.round(p.nutriments?.carbohydrates_100g || 0),
        fat: Math.round(p.nutriments?.fat_100g || 0), fiber: Math.round(p.nutriments?.fiber_100g || 0), store: "openfoodfacts", price: "Per 100g"
      }));
      setRes([...storeResults, ...off]);
    } catch { setRes(storeResults); }
    setLoading(false);
  };

  const pick = (item) => {
    setEntry(e => ({ ...e, name: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, fiber: item.fiber || 0 }));
    setRes([]); setQ("");
  };

  const addBP = (meal) => {
    setFoodLogs(p => [...p, { ...meal, date: today(), id: Date.now(), meal: "Lunch", source: "blueprint" }]);
  };

  const add = () => {
    if (!entry.name || !entry.calories) return;
    setFoodLogs(p => [...p, { ...entry, calories: +entry.calories, protein: +entry.protein || 0, carbs: +entry.carbs || 0, fat: +entry.fat || 0, fiber: +entry.fiber || 0, date: today(), id: Date.now() }]);
    setEntry({ name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", meal: "Lunch" });
    setShowAdd(false);
  };

  const storeBadge = (store) => {
    if (store === "amazon") return <span className="store-az">Amazon</span>;
    if (store === "sprouts") return <span className="store-sp">Sprouts</span>;
    if (store === "walmart") return <span className="store-wm">Walmart</span>;
    return null;
  };

  const meals = ["Breakfast", "Lunch", "Dinner", "Snack"];
  const proteinEat = todayLogs.reduce((s, f) => s + (f.protein || 0), 0);
  const fatEat = todayLogs.reduce((s, f) => s + (f.fat || 0), 0);
  const carbsEat = todayLogs.reduce((s, f) => s + (f.carbs || 0), 0);
  const fiberEat = todayLogs.reduce((s, f) => s + (f.fiber || 0), 0);

  return (
    <div>
      <div className="hdr"><div><div className="htitle">FOOD LOG</div><div className="hsub">{today()}</div></div><button className="btn pri sm" onClick={() => setShowAdd(true)}><Ic n="plus" size={13} /> Add</button></div>

      <div className="card gblue">
        <div className="flex ac jb" style={{ marginBottom: 10 }}>
          <div><div className="clabel" style={{ marginBottom: 0 }}>CALORIES</div><div className="fm3" style={{ fontSize: 28, fontWeight: 700, color: cals > cal ? "var(--red)" : "var(--acc)", marginTop: 4 }}>{cals}<span className="tmut sm" style={{ fontFamily: "var(--fb)" }}> / {cal}</span></div></div>
          <div className="flex fdc ac" style={{ gap: 2 }}><span className="xs tmut">Remaining</span><span className="fm3 fw6" style={{ fontSize: 18, color: "var(--grn)" }}>{Math.max(0, cal - cals)}</span></div>
        </div>
        <div className="pbar" style={{ height: 8 }}><div className="pfill" style={{ width: `${Math.min(100, (cals / cal) * 100)}%`, background: cals > cal ? "var(--red)" : "linear-gradient(90deg,var(--acc),var(--grn))" }} /></div>
        <div className="mrow">
          <div className="mp"><div className="mpv tacc">{proteinEat}<span style={{ fontSize: 9 }}>/{macros.protein}g</span></div><div className="mpl">Protein</div></div>
          <div className="mp"><div className="mpv torg">{fatEat}<span style={{ fontSize: 9 }}>/{macros.fat}g</span></div><div className="mpl">Fat</div></div>
          <div className="mp"><div className="mpv tgrn">{carbsEat}<span style={{ fontSize: 9 }}>/{macros.carbs}g</span></div><div className="mpl">Carbs</div></div>
          {profile.useBlueprint && <div className="mp"><div className="mpv tbp">{fiberEat}g</div><div className="mpl">Fiber</div></div>}
        </div>
      </div>

      {/* Blueprint Quick Add */}
      {profile.useBlueprint && (
        <div className="card gbp">
          <div className="clabel">BLUEPRINT QUICK ADD</div>
          <div className="scr" style={{ padding: "4px 0 8px", margin: "0 -18px", paddingLeft: 0 }}>
            {BLUEPRINT_MEALS.map(m => (
              <div key={m.id} style={{ background: "var(--s3)", border: "1px solid var(--b2)", borderRadius: "var(--r)", padding: "10px 12px", flexShrink: 0, minWidth: 140, cursor: "pointer" }} onClick={() => addBP(m)}>
                <div className="xs fw6 tbp">{m.name}</div>
                <div className="xs tmut mt4">{m.calories} kcal · {m.protein}g P</div>
                <div style={{ marginTop: 6 }}><span className="lscore">🌿 {m.longevityScore}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Water */}
      <div className="card">
        <div className="flex ac jb" style={{ marginBottom: 8 }}>
          <div className="clabel" style={{ marginBottom: 0 }}>WATER</div>
          <div className="flex gap8"><button className="btn gho sm ico" onClick={() => { const t = waterLogs.filter(w => w.date === today()); if (t.length) { const idx = waterLogs.map((w, i) => w.date === today() ? i : -1).filter(i => i >= 0).pop(); setWaterLogs(p => p.filter((_, i) => i !== idx)); } }}><Ic n="x" size={11} /></button><button className="btn pri sm ico" onClick={() => setWaterLogs(p => [...p, { date: today(), cups: 1, id: Date.now() }])}><Ic n="plus" size={11} /></button></div>
        </div>
        <div className="flex ac gap8"><Ic n="droplet" size={14} color="var(--acc)" /><span className="fm3 fw6">{waterToday}</span><span className="tmut xs">/ {waterGoal} cups</span></div>
        <div className="flex gap6" style={{ flexWrap: "wrap", marginTop: 8 }}>
          {Array.from({ length: waterGoal }).map((_, i) => (
            <div key={i} onClick={i < waterToday ? () => { const idx = waterLogs.map((w, j) => w.date === today() ? j : -1).filter(j => j >= 0).pop(); setWaterLogs(p => p.filter((_, j) => j !== idx)); } : () => setWaterLogs(p => [...p, { date: today(), cups: 1, id: Date.now() }])} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${i < waterToday ? "var(--acc)" : "var(--b2)"}`, background: i < waterToday ? "rgba(94,231,223,.12)" : "var(--s2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
              {i < waterToday ? "💧" : "○"}
            </div>
          ))}
        </div>
      </div>

      {/* Logs */}
      {meals.map(meal => {
        const items = todayLogs.filter(f => f.meal === meal);
        if (!items.length) return null;
        return <div key={meal}>
          <div className="shdr"><div className="stitle">{meal}</div><span className="fm3 xs tmut">{items.reduce((s, f) => s + f.calories, 0)} kcal</span></div>
          <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {items.map(f => <div key={f.id} className="fi">
              <div className="f1">
                <div className="fn2 flex ac gap6">{f.name}{f.source === "blueprint" && <span className="bptag">BP</span>}</div>
                <div className="fm2">P: {f.protein}g · C: {f.carbs}g · F: {f.fat}g{f.fiber ? ` · Fiber: ${f.fiber}g` : ""}</div>
              </div>
              <div className="flex ac gap8"><div className="fcal">{f.calories}</div><button className="btn gho sm ico" onClick={() => setFoodLogs(p => p.filter(x => x.id !== f.id))}><Ic n="trash" size={11} color="var(--red)" /></button></div>
            </div>)}
          </div>
        </div>;
      })}
      {todayLogs.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--t3)" }}><div style={{ fontSize: 40, marginBottom: 10 }}>🍽</div><div className="fw6 sm">No food logged yet</div></div>}

      {/* Modal */}
      {showAdd && <div className="mo" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
        <div className="md">
          <div className="mh" />
          <div className="mt">ADD FOOD</div>
          <div className="tabrow" style={{ marginBottom: 14, padding: 0 }}>
            {["all", "amazon", "sprouts", "walmart"].map(s => <button key={s} className={`tab ${storeFilter === s ? "on" : ""}`} onClick={() => setStoreFilter(s)}>{s === "all" ? "All Sources" : s.charAt(0).toUpperCase() + s.slice(1)}</button>)}
          </div>
          <div className="ig">
            <label className="il">Search Food</label>
            <div className="flex gap8"><input className="inp f1" placeholder="Search foods..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} /><button className="btn pri sm" onClick={search}>{loading ? "..." : <Ic n="search" size={13} />}</button></div>
          </div>
          {res.length > 0 && <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: "var(--r)", marginBottom: 14, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
            {res.map((r, i) => <div key={r.id || i} className="sr" onClick={() => pick(r)}>
              <div className="flex ac jb"><span className="xs fw6">{r.name}</span><div className="flex ac gap6">{storeBadge(r.store)}<span className="xs tmut">{r.calories} kcal</span></div></div>
              {r.price && <div className="xs tmut mt4">{r.price}</div>}
            </div>)}
          </div>}
          <div className="ig"><label className="il">Food Name</label><input className="inp" placeholder="Name" value={entry.name} onChange={e => setEntry(p => ({ ...p, name: e.target.value }))} /></div>
          <div className="irow">
            <div className="ig"><label className="il">Calories</label><input className="inp" type="number" value={entry.calories} onChange={e => setEntry(p => ({ ...p, calories: e.target.value }))} /></div>
            <div className="ig"><label className="il">Meal</label><select className="inp" value={entry.meal} onChange={e => setEntry(p => ({ ...p, meal: e.target.value }))}>{["Breakfast","Lunch","Dinner","Snack"].map(m => <option key={m}>{m}</option>)}</select></div>
          </div>
          <div className="irow">
            <div className="ig"><label className="il">Protein (g)</label><input className="inp" type="number" value={entry.protein} onChange={e => setEntry(p => ({ ...p, protein: e.target.value }))} /></div>
            <div className="ig"><label className="il">Carbs (g)</label><input className="inp" type="number" value={entry.carbs} onChange={e => setEntry(p => ({ ...p, carbs: e.target.value }))} /></div>
          </div>
          <div className="irow">
            <div className="ig"><label className="il">Fat (g)</label><input className="inp" type="number" value={entry.fat} onChange={e => setEntry(p => ({ ...p, fat: e.target.value }))} /></div>
            <div className="ig"><label className="il">Fiber (g)</label><input className="inp" type="number" value={entry.fiber} onChange={e => setEntry(p => ({ ...p, fiber: e.target.value }))} /></div>
          </div>
          <button className="btn pri" style={{ width: "100%" }} onClick={add}>Add to Log</button>
        </div>
      </div>}
    </div>
  );
}

// ─── BLUEPRINT SCREEN ─────────────────────────────────────────────────────────
function BlueprintScreen({ profile, foodLogs, setFoodLogs }) {
  const [selected, setSelected] = useState(null);
  const [storeView, setStoreView] = useState("all");
  const [aiTip, setAiTip] = useState(""); const [aiLoading, setAiLoading] = useState(false);
  const [tab, setTab] = useState("meals");
  const [toast, setToast] = useState("");

  const getAIBP = async () => {
    setAiLoading(true);
    const msg = await askAI(`User is following Bryan Johnson's Blueprint protocol while fasting. Weight: ${profile.weight}lbs, goal: ${profile.goalWeight}lbs. Macro split: ${profile.macroSplit}. Peptides: ${profile.peptides?.map(p => p.name).join(", ") || "none"}. Give one specific Blueprint protocol tip that synergizes with their fasting and peptide stack today. Be specific and actionable.`);
    setAiTip(msg);
    setAiLoading(false);
  };
  useEffect(() => { if (tab === "meals") getAIBP(); }, [tab]);

  const addMeal = (meal) => {
    setFoodLogs(p => [...p, { ...meal, date: today(), id: Date.now(), meal: "Lunch", source: "blueprint" }]);
    setToast(`${meal.name} logged ✓`);
    setSelected(null);
  };

  const filteredStore = storeView === "all" ? STORE_FOODS : STORE_FOODS.filter(f => f.store === storeView);

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
      <div className="hdr"><div><div className="htitle">BLUEPRINT</div><div className="hsub">Bryan Johnson Protocol</div></div><Ic n="leaf" size={20} color="var(--bp)" /></div>

      <div className="tabrow">
        {["meals", "principles", "store"].map(t => <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
      </div>

      {tab === "meals" && <>
        {/* AI Blueprint Tip */}
        <div className="card gbp" style={{ cursor: "pointer" }} onClick={getAIBP}>
          <div className="flex ac jb" style={{ marginBottom: 8 }}><div className="flex ac gap6"><Ic n="brain" size={14} color="var(--bp)" /><span className="xs fw6 tbp" style={{ letterSpacing: 1 }}>BLUEPRINT AI TIP</span></div><span className="xs tmut">tap to refresh</span></div>
          {aiLoading ? <div className="aibubble loading"><span className="aidot" /><span className="aidot" /><span className="aidot" /></div> : <div className="aibubble" style={{ borderColor: "rgba(16,185,129,.2)" }}>{aiTip || "Loading..."}</div>}
        </div>

        {/* Meals */}
        {BLUEPRINT_MEALS.map(m => (
          <div key={m.id}>
            <div className="bpcard" onClick={() => setSelected(selected?.id === m.id ? null : m)}>
              <div className="flex ac jb" style={{ marginBottom: 8 }}>
                <div className="fw6 sm">{m.name}</div>
                <div className="lscore">🌿 {m.longevityScore}</div>
              </div>
              <div className="xs tmut" style={{ marginBottom: 8 }}>{m.description}</div>
              <div className="flex ac jb">
                <div className="flex ac gap6">
                  {m.tags.slice(0, 2).map(t => <span key={t} className="bptag">{t}</span>)}
                </div>
                <div className="flex ac gap8">
                  <span className="xs fm3 tacc">{m.calories} kcal</span>
                  <span className="xs fm3 tbp">{m.protein}g P</span>
                  <span className="xs fm3" style={{ color: "var(--org)" }}>{m.fiber}g F</span>
                </div>
              </div>
            </div>
            {selected?.id === m.id && (
              <div className="card gbp" style={{ margin: "-2px 14px 10px", borderTop: "none", borderRadius: "0 0 var(--rl) var(--rl)" }}>
                <div className="mrow" style={{ marginTop: 0, marginBottom: 12 }}>
                  <div className="mp"><div className="mpv tacc">{m.protein}g</div><div className="mpl">Protein</div></div>
                  <div className="mp"><div className="mpv torg">{m.fat}g</div><div className="mpl">Fat</div></div>
                  <div className="mp"><div className="mpv tgrn">{m.carbs}g</div><div className="mpl">Carbs</div></div>
                  <div className="mp"><div className="mpv tbp">{m.fiber}g</div><div className="mpl">Fiber</div></div>
                </div>
                <div className="clabel">Ingredients</div>
                <div className="inglist">
                  {m.ingredients.map((ing, i) => (
                    <div key={i} className="ing">
                      <div><div className="xs fw6">{ing.name}</div><div className="xs tmut mt4">{ing.amount}</div></div>
                      <div style={{ textAlign: "right" }}>
                        {ing.store.walmart !== "Not available" && <div className="xs tmut mt4">🛒 Walmart: {ing.store.walmart}</div>}
                        {ing.store.sprouts && <div className="xs tmut mt4">🌿 Sprouts: {ing.store.sprouts}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="clabel mt8">Instructions</div>
                <div className="xs" style={{ color: "var(--t2)", lineHeight: 1.7, marginBottom: 12 }}>{m.instructions}</div>
                <button className="btn bp" style={{ width: "100%" }} onClick={() => addMeal(m)}>+ Log This Meal</button>
              </div>
            )}
          </div>
        ))}
      </>}

      {tab === "principles" && <>
        <div className="card gbp" style={{ marginBottom: 10 }}>
          <div className="clabel">BRYAN JOHNSON BLUEPRINT</div>
          <div className="xs" style={{ color: "var(--t2)", lineHeight: 1.7 }}>
            All meals consumed between 6am–11am, designed to sync with the body's natural rhythms. Blueprint targets ~2,250 calories with 25% protein, 35% carbs, and 40% fat — structured to support muscle repair, energy production, and hormone balance.
          </div>
        </div>
        {BLUEPRINT_PRINCIPLES.map((p, i) => (
          <div key={i} className="card" style={{ paddingTop: 14, paddingBottom: 14 }}>
            <div className="flex ac gap12">
              <span style={{ fontSize: 24, flexShrink: 0 }}>{p.icon}</span>
              <div><div className="fw6 sm tbp">{p.title}</div><div className="xs tmut mt4" style={{ lineHeight: 1.6 }}>{p.desc}</div></div>
            </div>
          </div>
        ))}
        <div className="card">
          <div className="clabel">BLUEPRINT vs YOUR PROTOCOL</div>
          <div className="flex jb" style={{ marginBottom: 7 }}><span className="xs tmut">Blueprint Calories</span><span className="fm3 xs fw6">~2,250 kcal</span></div>
          <div className="flex jb" style={{ marginBottom: 7 }}><span className="xs tmut">Your Target</span><span className="fm3 xs fw6 tacc">{profile.calTarget} kcal</span></div>
          <div className="flex jb" style={{ marginBottom: 7 }}><span className="xs tmut">Blueprint Macro Split</span><span className="fm3 xs fw6">25P/40F/35C</span></div>
          <div className="flex jb"><span className="xs tmut">Your Split</span><span className="fm3 xs fw6 tacc">{profile.macroSplit}</span></div>
        </div>
      </>}

      {tab === "store" && <>
        <div className="card">
          <div className="clabel">SHOPPING GUIDE</div>
          <div className="xs tmut" style={{ lineHeight: 1.6 }}>Blueprint-approved foods from Amazon, Sprouts, and Walmart. All prices approximate.</div>
        </div>
        <div className="tabrow">
          {["all", "amazon", "sprouts", "walmart"].map(s => (
            <button key={s} className={`tab ${storeView === s ? "on" : ""}`} onClick={() => setStoreView(s)}>
              {s === "all" ? "All" : s === "amazon" ? "🛒 Amazon" : s === "sprouts" ? "🌿 Sprouts" : "🏪 Walmart"}
            </button>
          ))}
        </div>
        {["produce", "protein", "seeds", "nuts", "legumes", "frozen", "pantry", "oils", "dairy-alt", "supplement"].filter(cat => filteredStore.some(f => f.category === cat)).map(cat => (
          <div key={cat}>
            <div className="shdr"><div className="stitle">{cat}</div></div>
            <div className="card" style={{ paddingTop: 8, paddingBottom: 8 }}>
              {filteredStore.filter(f => f.category === cat).map(f => (
                <div key={f.id} className="fi">
                  <div className="f1">
                    <div className="fn2 flex ac gap6">{f.name} {f.store === "amazon" ? <span className="store-az">Amazon</span> : f.store === "sprouts" ? <span className="store-sp">Sprouts</span> : <span className="store-wm">Walmart</span>}</div>
                    <div className="fm2">{f.calories} kcal · {f.protein}g P · {f.price}</div>
                  </div>
                  <div className="fcal">{f.calories}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </>}
    </div>
  );
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
function ProgressScreen({ profile, weightLogs, setWeightLogs, fastState, foodLogs }) {
  const [showAdd, setShowAdd] = useState(false);
  const [nw, setNw] = useState(""); const [nb, setNb] = useState("");
  const [aiProjection, setAiProjection] = useState(""); const [aiLoading, setAiLoading] = useState(false);

  const sorted = [...weightLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = sorted.length ? sorted[sorted.length - 1].weight : profile.weight;
  const lost = profile.weight - latest;
  const toGoal = latest - profile.goalWeight;
  const weekRate = sorted.length >= 2 ? Math.abs((sorted[sorted.length - 1].weight - sorted[0].weight) / (sorted.length)) : 0;
  const weeksLeft = weekRate > 0 ? Math.round(toGoal / weekRate) : null;
  const last14 = sorted.slice(-14);
  const chartMax = last14.length ? Math.max(...last14.map(l => l.weight)) + 3 : profile.weight + 5;
  const chartMin = last14.length ? Math.min(...last14.map(l => l.weight)) - 3 : profile.goalWeight;

  const getProjection = async () => {
    setAiLoading(true);
    const avgCals = foodLogs.length ? Math.round(foodLogs.reduce((s, f) => s + f.calories, 0) / Math.max(1, [...new Set(foodLogs.map(f => f.date))].length)) : profile.calTarget;
    const msg = await askAI(`Fat loss projection: Current ${latest}lbs, goal ${profile.goalWeight}lbs, starting ${profile.weight}lbs. Streak: ${fastState.streak || 0} days. Avg daily calories: ${avgCals}. Peptides: ${profile.peptides?.map(p => p.name).join(", ") || "none"}. ${profile.useBlueprint ? "Following Blueprint protocol." : ""} Give a realistic 4-week milestone projection with specific weight targets. Format as Week 1: X, Week 2: Y, etc.`);
    setAiProjection(msg);
    setAiLoading(false);
  };
  useEffect(() => { getProjection(); }, []);

  const badges = [
    { icon: "🔥", name: "First Fast", earned: (fastState.streak || 0) >= 1 },
    { icon: "💧", name: "Hydrated", earned: true },
    { icon: "⚖️", name: "First Log", earned: weightLogs.length > 0 },
    { icon: "🎯", name: "3 Day Streak", earned: (fastState.streak || 0) >= 3 },
    { icon: "💪", name: "5 lbs Lost", earned: lost >= 5 },
    { icon: "🏆", name: "10 lbs Lost", earned: lost >= 10 },
    { icon: "🌿", name: "Blueprint Meal", earned: foodLogs.some(f => f.source === "blueprint") },
    { icon: "⚡", name: "25 lbs Lost", earned: lost >= 25 },
    { icon: "🧬", name: "50 lbs Lost", earned: lost >= 50 },
    { icon: "🔑", name: "7 Day Streak", earned: (fastState.streak || 0) >= 7 },
    { icon: "👑", name: "Goal Weight", earned: latest <= profile.goalWeight },
    { icon: "💎", name: "100 lbs Lost", earned: lost >= 100 },
  ];

  return (
    <div>
      <div className="hdr"><div><div className="htitle">PROGRESS</div><div className="hsub">Your transformation</div></div><button className="btn pri sm" onClick={() => setShowAdd(true)}>Log Weight</button></div>

      {/* AI Projection */}
      <div className="card gpur" style={{ cursor: "pointer" }} onClick={getProjection}>
        <div className="flex ac jb" style={{ marginBottom: 8 }}><div className="flex ac gap6"><Ic n="brain" size={14} color="var(--pur)" /><span className="xs fw6 tpur" style={{ letterSpacing: 1 }}>AI PROJECTION</span></div><span className="xs tmut">tap to refresh</span></div>
        {aiLoading ? <div className="aibubble loading"><span className="aidot" /><span className="aidot" /><span className="aidot" /></div> : <div className="aibubble">{aiProjection || "Calculating..."}</div>}
      </div>

      {/* Big Number */}
      <div className="card ggreen">
        <div className="clabel">TOTAL FAT LOST</div>
        <div className="fn3" style={{ fontSize: 44, fontWeight: 800, background: "linear-gradient(135deg,var(--red),var(--org))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{lost > 0 ? lost.toFixed(1) : "0.0"} lbs</div>
        <div className="xs tmut mt4">Started at {profile.weight} lbs</div>
        <div style={{ marginTop: 12 }}>
          <div className="flex jb" style={{ marginBottom: 5 }}><span className="xs tmut">Goal Progress</span><span className="fm3 xs">{latest} → {profile.goalWeight} lbs</span></div>
          <div className="pbar" style={{ height: 8 }}><div className="pfill" style={{ width: `${Math.min(100, Math.max(0, lost / (profile.weight - profile.goalWeight) * 100))}%`, background: "linear-gradient(90deg,var(--red),var(--org),var(--grn))" }} /></div>
          {weeksLeft !== null && <div className="xs tmut mt4">~{weeksLeft} weeks to goal at current pace</div>}
        </div>
      </div>

      {/* Stats */}
      <div className="scr">
        <div className="sb"><div className="sbv tgrn">{latest} lbs</div><div className="sbl">Current</div></div>
        <div className="sb"><div className="sbv tred">{profile.goalWeight} lbs</div><div className="sbl">Goal</div></div>
        <div className="sb"><div className="sbv torg">{toGoal > 0 ? toGoal.toFixed(1) : "0"}</div><div className="sbl">To Go</div></div>
        <div className="sb"><div className="sbv tacc">{weekRate > 0 ? weekRate.toFixed(1) : "—"}</div><div className="sbl">lbs/wk</div></div>
      </div>

      {/* Chart */}
      {last14.length > 1 && <div className="card">
        <div className="clabel">WEIGHT TREND</div>
        <div style={{ height: 110, display: "flex", alignItems: "flex-end", gap: 3, paddingTop: 6 }}>
          {last14.map((l, i) => {
            const h = ((l.weight - chartMin) / (chartMax - chartMin)) * 100;
            const down = i > 0 && l.weight < last14[i - 1].weight;
            return <div key={l.id} title={`${l.weight} lbs — ${l.date}`} style={{ flex: 1, height: `${Math.max(4, h)}%`, background: down ? "var(--grn)" : "var(--red)", borderRadius: "3px 3px 0 0", opacity: 0.6 + (i / last14.length * 0.4) }} />;
          })}
        </div>
        <div className="flex jb mt4"><span className="xs tmut">{last14[0]?.date}</span><span className="xs tmut">{last14[last14.length - 1]?.date}</span></div>
      </div>}

      {/* Weight History */}
      {sorted.length > 0 && <div className="card">
        <div className="clabel">HISTORY</div>
        {sorted.slice(-6).reverse().map(l => <div key={l.id} className="flex ac jb" style={{ padding: "7px 0", borderBottom: "1px solid var(--b1)" }}>
          <span className="xs tmut">{l.date}</span>
          <div className="flex ac gap12">{l.bf && <span className="xs tmut">{l.bf}% BF</span>}<span className="fm3 fw6">{l.weight} lbs</span></div>
        </div>)}
      </div>}

      {/* Badges */}
      <div className="shdr"><div className="stitle">Achievements</div><span className="xs tmut">{badges.filter(b => b.earned).length}/{badges.length}</span></div>
      <div style={{ padding: "0 14px 14px" }}>
        <div className="bgrid">
          {badges.map((b, i) => <div key={i} className={`bi ${b.earned ? "on" : ""}`}><div className="biicon">{b.icon}</div><div className="biname">{b.name}</div></div>)}
        </div>
      </div>

      {showAdd && <div className="mo" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
        <div className="md">
          <div className="mh" /><div className="mt">LOG WEIGHT</div>
          <div className="ig"><label className="il">Weight (lbs)</label><input className="inp" type="number" step=".1" placeholder={latest} value={nw} onChange={e => setNw(e.target.value)} autoFocus /></div>
          <div className="ig"><label className="il">Body Fat % (optional)</label><input className="inp" type="number" step=".1" placeholder="e.g. 28.5" value={nb} onChange={e => setNb(e.target.value)} /></div>
          <button className="btn pri" style={{ width: "100%" }} onClick={() => { if (!nw) return; setWeightLogs(p => [...p, { date: today(), weight: +nw, bf: nb ? +nb : null, id: Date.now() }]); setNw(""); setNb(""); setShowAdd(false); }}>Save</button>
        </div>
      </div>}
    </div>
  );
}

// ─── PEPTIDE SCREEN ───────────────────────────────────────────────────────────
function PeptideScreen({ profile, setProfile, peptideLogs, setPeptideLogs }) {
  const [showAdd, setShowAdd] = useState(false);
  const [np, setNp] = useState({ name: "", dose: "", schedule: "morning", cycleStart: today(), cycleDays: 90 });
  const [toast, setToast] = useState("");
  const [aiAdvice, setAiAdvice] = useState(""); const [aiLoading, setAiLoading] = useState(false);

  const getAI = async () => {
    setAiLoading(true);
    const msg = await askAI(`Peptide optimization advice for: ${profile.peptides?.map(p => `${p.name} ${p.dose} ${p.schedule}`).join(", ") || "none yet"}. User is fasting (${profile.phases?.[0]?.name}), weighs ${profile.weight}lbs, goal ${profile.goalWeight}lbs. ${profile.useBlueprint ? "Following Blueprint protocol." : ""} Give specific synergy tips — what peptides pair well, optimal injection timing with fasting windows, and what to stack with AOD-9604 for maximum fat loss.`);
    setAiAdvice(msg);
    setAiLoading(false);
  };
  useEffect(() => { getAI(); }, []);

  const toggle = (id) => {
    const done = peptideLogs.some(l => l.date === today() && l.peptideId === id);
    if (done) setPeptideLogs(p => p.filter(l => !(l.date === today() && l.peptideId === id)));
    else { setPeptideLogs(p => [...p, { date: today(), peptideId: id, taken: true, id: Date.now() }]); setToast("Logged ✓"); }
  };

  const compliance = (id) => {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().split("T")[0]; });
    return Math.round(days.filter(d => peptideLogs.some(l => l.date === d && l.peptideId === id)).length / 7 * 100);
  };

  const daysIn = (start) => Math.floor((new Date() - new Date(start)) / 86400000);

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
      <div className="hdr"><div><div className="htitle">PEPTIDES</div><div className="hsub">Cycle tracking & compliance</div></div><button className="btn pri sm" onClick={() => setShowAdd(true)}><Ic n="plus" size={13} /> Add</button></div>

      {/* AI Peptide Advice */}
      <div className="card gpur" style={{ cursor: "pointer" }} onClick={getAI}>
        <div className="flex ac jb" style={{ marginBottom: 8 }}><div className="flex ac gap6"><Ic n="brain" size={14} color="var(--pur)" /><span className="xs fw6 tpur" style={{ letterSpacing: 1 }}>AI PEPTIDE COACH</span></div><span className="xs tmut">tap to refresh</span></div>
        {aiLoading ? <div className="aibubble loading"><span className="aidot" /><span className="aidot" /><span className="aidot" /></div> : <div className="aibubble">{aiAdvice || "Loading peptide advice..."}</div>}
      </div>

      {(!profile.peptides || !profile.peptides.length) && <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--t3)" }}><div style={{ fontSize: 44, marginBottom: 10 }}>💉</div><div className="fw6 sm">No peptides tracked yet</div><div className="xs mt4">Tap + Add to start logging</div></div>}

      {(profile.peptides || []).map(p => {
        const done = peptideLogs.some(l => l.date === today() && l.peptideId === p.id);
        const comp = compliance(p.id);
        const di = daysIn(p.cycleStart);
        const dl = Math.max(0, p.cycleDays - di);
        return <div key={p.id} className="card gblue">
          <div className="flex ac jb" style={{ marginBottom: 12 }}>
            <div className="flex ac gap8"><Ic n="syringe" size={16} color="var(--pur)" /><div><div className="fw6" style={{ fontSize: 15 }}>{p.name}</div><div className="xs tmut">{p.dose} · {p.schedule}</div></div></div>
            <button className="btn gho sm ico" onClick={() => setProfile(pr => ({ ...pr, peptides: pr.peptides.filter(x => x.id !== p.id) }))}><Ic n="trash" size={11} color="var(--red)" /></button>
          </div>
          <div className="flex jb" style={{ marginBottom: 5 }}><span className="xs tmut">Cycle Day</span><span className="fm3 xs">{di} / {p.cycleDays}</span></div>
          <div className="pbar"><div className="pfill" style={{ width: `${Math.min(100, di / p.cycleDays * 100)}%`, background: "linear-gradient(90deg,var(--pur),var(--acc))" }} /></div>
          <div className="flex jb mt4">
            <span className="xs tmut">{dl} days left</span>
            <span className="xs fw6" style={{ color: comp > 80 ? "var(--grn)" : comp > 60 ? "var(--org)" : "var(--red)" }}>{comp}% compliance</span>
          </div>
          <div className="flex ac jb" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
            <span className="sm fw6">Today's Dose</span>
            <button onClick={() => toggle(p.id)} style={{ background: "none", border: `2px solid ${done ? "var(--grn)" : "var(--b2)"}`, borderRadius: 8, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: done ? "var(--grn)" : "transparent", transition: "all .2s" }}>
              {done && <Ic n="check" size={16} color="#000" />}
            </button>
          </div>
        </div>;
      })}

      {showAdd && <div className="mo" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
        <div className="md">
          <div className="mh" /><div className="mt">ADD PEPTIDE</div>
          <div className="ig"><label className="il">Peptide Name</label><input className="inp" placeholder="AOD-9604, BPC-157, TB-500..." value={np.name} onChange={e => setNp(p => ({ ...p, name: e.target.value }))} /></div>
          <div className="irow">
            <div className="ig"><label className="il">Dose</label><input className="inp" placeholder="300mcg" value={np.dose} onChange={e => setNp(p => ({ ...p, dose: e.target.value }))} /></div>
            <div className="ig"><label className="il">Schedule</label><select className="inp" value={np.schedule} onChange={e => setNp(p => ({ ...p, schedule: e.target.value }))}><option value="morning">Morning</option><option value="evening">Evening</option><option value="both">Both</option></select></div>
          </div>
          <div className="ig"><label className="il">Cycle Length (days)</label><input className="inp" type="number" value={np.cycleDays} onChange={e => setNp(p => ({ ...p, cycleDays: +e.target.value }))} /></div>
          <button className="btn pri" style={{ width: "100%" }} onClick={() => { if (!np.name) return; setProfile(pr => ({ ...pr, peptides: [...(pr.peptides || []), { ...np, id: Date.now(), cycleStart: today() }] })); setShowAdd(false); setNp({ name: "", dose: "", schedule: "morning", cycleStart: today(), cycleDays: 90 }); }}>Add Peptide</button>
        </div>
      </div>}
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfileScreen({ profile, setProfile, onReset }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...profile });
  const bmr = calcBMR(profile.weight, profile.height, profile.age, profile.sex);
  const save = () => { setProfile(draft); setEditing(false); };

  return (
    <div>
      <div className="hdr"><div><div className="htitle">PROFILE</div><div className="hsub">{profile.name || "Your account"}</div></div><button className="btn gho sm" onClick={() => setEditing(!editing)}><Ic n="edit" size={13} /> {editing ? "Cancel" : "Edit"}</button></div>

      {editing ? <div style={{ padding: "0 14px" }}>
        <div className="ig"><label className="il">Name</label><input className="inp" value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} /></div>
        <div className="irow"><div className="ig"><label className="il">Age</label><input className="inp" type="number" value={draft.age} onChange={e => setDraft(p => ({ ...p, age: +e.target.value }))} /></div><div className="ig"><label className="il">Sex</label><select className="inp" value={draft.sex} onChange={e => setDraft(p => ({ ...p, sex: e.target.value }))}><option value="male">Male</option><option value="female">Female</option></select></div></div>
        <div className="irow"><div className="ig"><label className="il">Weight (lbs)</label><input className="inp" type="number" value={draft.weight} onChange={e => setDraft(p => ({ ...p, weight: +e.target.value }))} /></div><div className="ig"><label className="il">Goal (lbs)</label><input className="inp" type="number" value={draft.goalWeight} onChange={e => setDraft(p => ({ ...p, goalWeight: +e.target.value }))} /></div></div>
        <div className="ig"><label className="il">Daily Calories</label><input className="inp" type="number" value={draft.calTarget} onChange={e => setDraft(p => ({ ...p, calTarget: +e.target.value }))} /></div>
        <div className="ig"><label className="il">Macro Split</label><select className="inp" value={draft.macroSplit} onChange={e => setDraft(p => ({ ...p, macroSplit: e.target.value }))}><option value="high-protein">High Protein</option><option value="balanced">Balanced</option><option value="keto">Keto</option><option value="blueprint">Blueprint</option></select></div>
        <div className="ig"><label className="il">Blueprint Mode</label><select className="inp" value={draft.useBlueprint ? "yes" : "no"} onChange={e => setDraft(p => ({ ...p, useBlueprint: e.target.value === "yes" }))}><option value="yes">Enabled</option><option value="no">Disabled</option></select></div>
        <button className="btn pri" style={{ width: "100%", marginBottom: 12 }} onClick={save}>Save Changes</button>
      </div> : <>
        <div className="card gblue">
          <div className="flex ac gap12" style={{ marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,var(--acc),var(--pur))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, fontFamily: "var(--fn)", color: "#000" }}>{(profile.name || "?")[0].toUpperCase()}</div>
            <div><div className="fn3" style={{ fontSize: 20, fontWeight: 800 }}>{profile.name || "Set your name"}</div><div className="xs tmut">{profile.age} years · {profile.sex}</div></div>
          </div>
          <div className="flex jb" style={{ marginBottom: 7 }}><span className="xs tmut">Height</span><span className="fm3 fw6">{Math.floor(profile.height / 12)}'{profile.height % 12}"</span></div>
          <div className="flex jb" style={{ marginBottom: 7 }}><span className="xs tmut">Weight</span><span className="fm3 fw6">{profile.weight} lbs</span></div>
          <div className="flex jb"><span className="xs tmut">Goal</span><span className="fm3 fw6 tgrn">{profile.goalWeight} lbs</span></div>
        </div>
        <div className="card">
          <div className="clabel">NUTRITION</div>
          <div className="flex jb" style={{ marginBottom: 7 }}><span className="xs tmut">BMR</span><span className="fm3 xs fw6">{Math.round(bmr)} kcal</span></div>
          <div className="flex jb" style={{ marginBottom: 7 }}><span className="xs tmut">Target</span><span className="fm3 xs fw6 tacc">{profile.calTarget} kcal</span></div>
          <div className="flex jb"><span className="xs tmut">Macro Split</span><span className="fm3 xs fw6">{profile.macroSplit}</span></div>
        </div>
        <div className="card">
          <div className="clabel">FEATURES</div>
          <div className="flex jb" style={{ marginBottom: 7 }}><span className="xs tmut">Blueprint Mode</span><span className="xs fw6" style={{ color: profile.useBlueprint ? "var(--bp)" : "var(--t3)" }}>{profile.useBlueprint ? "🌿 ON" : "OFF"}</span></div>
          <div className="flex jb"><span className="xs tmut">Peptide Tracking</span><span className="xs fw6" style={{ color: profile.usePeptides ? "var(--pur)" : "var(--t3)" }}>{profile.usePeptides ? "💉 ON" : "OFF"}</span></div>
        </div>
      </>}

      <div style={{ padding: "8px 14px 20px" }}>
        <button className="btn gho" style={{ width: "100%", color: "var(--red)", borderColor: "rgba(248,113,113,.25)" }} onClick={onReset}>Reset All Data</button>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function FastMode() {
  const [profile, setProfile] = useLS("fm2_profile", { setup: false });
  const [fastState, setFastState] = useLS("fm2_fast", { active: false, startTime: null, streak: 0, lastFastDate: null });
  const [foodLogs, setFoodLogs] = useLS("fm2_food", []);
  const [waterLogs, setWaterLogs] = useLS("fm2_water", []);
  const [weightLogs, setWeightLogs] = useLS("fm2_weight", []);
  const [peptideLogs, setPeptideLogs] = useLS("fm2_plogs", []);
  const [tab, setTab] = useLS("fm2_tab", "home");

  const reset = () => { if (window.confirm("Reset all data?")) { setProfile({ setup: false }); setFastState({ active: false, startTime: null, streak: 0, lastFastDate: null }); setFoodLogs([]); setWaterLogs([]); setWeightLogs([]); setPeptideLogs([]); setTab("home"); } };

  if (!profile.setup) return <div className="fastmode-root"><style>{CSS}</style><div className="fastmode-container"><Onboarding onDone={p => setProfile(p)} /></div></div>;

  const tabs = [
    { id: "home", icon: "home", label: "Home" },
    { id: "timer", icon: "timer", label: "Fast" },
    { id: "food", icon: "food", label: "Food" },
    ...(profile.useBlueprint ? [{ id: "blueprint", icon: "blueprint", label: "Blueprint" }] : []),
    { id: "progress", icon: "chart", label: "Progress" },
  ];

  return (
    <div className="fastmode-root">
      <style>{CSS}</style>
      <div className="fastmode-container">
        <div className="app">
          {tab === "home" && <Dashboard profile={profile} fastState={fastState} foodLogs={foodLogs} weightLogs={weightLogs} peptideLogs={peptideLogs} waterLogs={waterLogs} onNav={setTab} />}
          {tab === "timer" && <TimerScreen profile={profile} fastState={fastState} setFastState={setFastState} />}
          {tab === "food" && <FoodScreen profile={profile} foodLogs={foodLogs} setFoodLogs={setFoodLogs} waterLogs={waterLogs} setWaterLogs={setWaterLogs} />}
          {tab === "blueprint" && <BlueprintScreen profile={profile} foodLogs={foodLogs} setFoodLogs={setFoodLogs} />}
          {tab === "progress" && <ProgressScreen profile={profile} weightLogs={weightLogs} setWeightLogs={setWeightLogs} fastState={fastState} foodLogs={foodLogs} />}
          {tab === "peptide" && <PeptideScreen profile={profile} setProfile={setProfile} peptideLogs={peptideLogs} setPeptideLogs={setPeptideLogs} />}
          {tab === "profile" && <ProfileScreen profile={profile} setProfile={setProfile} onReset={reset} />}
        </div>
        <nav className="nav">
          {tabs.map(t => <button key={t.id} className={`nb ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)} data-testid={`button-fastmode-tab-${t.id}`}><Ic n={t.icon} size={19} />{t.label}</button>)}
          <button className={`nb ${tab === "peptide" ? "on" : ""}`} onClick={() => setTab("peptide")} data-testid="button-fastmode-tab-peptide"><Ic n="syringe" size={19} />Peptide</button>
          <button className={`nb ${tab === "profile" ? "on" : ""}`} onClick={() => setTab("profile")} data-testid="button-fastmode-tab-profile"><Ic n="profile" size={19} />Me</button>
        </nav>
      </div>
    </div>
  );
}
