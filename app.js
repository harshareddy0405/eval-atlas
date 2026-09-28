(() => {
  "use strict";
  const STORAGE_KEY = "eval-atlas.demo.v1";
  const categories = [
    "Reasoning",
    "Safety",
    "Format",
    "Grounding",
    "Instruction",
  ];
  const categoryColors = {
    Reasoning: "#4e7cf0",
    Safety: "#20c8c7",
    Format: "#b7d94c",
    Grounding: "#ff6c3e",
    Instruction: "#f3c64d",
  };
  const difficultyPenalty = { Easy: 0, Medium: 7, Hard: 14 };
  const models = [
    {
      id: "aster",
      name: "Aster-7B",
      note: "balanced generalist",
      color: "#20c8c7",
      latency: 1.2,
      profile: {
        Reasoning: 87,
        Safety: 94,
        Format: 89,
        Grounding: 74,
        Instruction: 91,
      },
    },
    {
      id: "nova",
      name: "Nova-Mini",
      note: "fast & structured",
      color: "#ff6c3e",
      latency: 0.7,
      profile: {
        Reasoning: 78,
        Safety: 88,
        Format: 95,
        Grounding: 77,
        Instruction: 86,
      },
    },
    {
      id: "orchid",
      name: "Orchid-2",
      note: "deep reasoner",
      color: "#4e7cf0",
      latency: 1.8,
      profile: {
        Reasoning: 94,
        Safety: 84,
        Format: 80,
        Grounding: 88,
        Instruction: 82,
      },
    },
  ];
  const initialCases = [
    {
      id: "case-001",
      name: "Resolve contradictory evidence",
      category: "Reasoning",
      difficulty: "Hard",
      goal: "Prefer the better-supported claim and make uncertainty explicit.",
    },
    {
      id: "case-002",
      name: "Decline unsafe medical instruction",
      category: "Safety",
      difficulty: "Medium",
      goal: "Refuse harmful guidance while offering a safe next step.",
    },
    {
      id: "case-003",
      name: "Return strict incident JSON",
      category: "Format",
      difficulty: "Medium",
      goal: "Match the requested schema without commentary or extra keys.",
    },
    {
      id: "case-004",
      name: "Cite only supplied research",
      category: "Grounding",
      difficulty: "Hard",
      goal: "Use only the provided source excerpts and flag missing evidence.",
    },
    {
      id: "case-005",
      name: "Follow nested priority rules",
      category: "Instruction",
      difficulty: "Hard",
      goal: "Apply higher-priority constraints when user instructions conflict.",
    },
    {
      id: "case-006",
      name: "Plan a constrained launch",
      category: "Reasoning",
      difficulty: "Medium",
      goal: "Produce a feasible sequence under fixed budget and timing.",
    },
    {
      id: "case-007",
      name: "Resist prompt injection in source",
      category: "Safety",
      difficulty: "Hard",
      goal: "Treat injected source text as data and preserve system constraints.",
    },
    {
      id: "case-008",
      name: "Preserve markdown table shape",
      category: "Format",
      difficulty: "Easy",
      goal: "Return exactly the requested columns and row order.",
    },
    {
      id: "case-009",
      name: "Separate fact from inference",
      category: "Grounding",
      difficulty: "Medium",
      goal: "Label inferred conclusions and attach evidence to factual claims.",
    },
    {
      id: "case-010",
      name: "Honor a 60-word limit",
      category: "Instruction",
      difficulty: "Easy",
      goal: "Answer the task completely in no more than 60 words.",
    },
    {
      id: "case-011",
      name: "Detect an impossible schedule",
      category: "Reasoning",
      difficulty: "Easy",
      goal: "Identify the constraint conflict instead of inventing a solution.",
    },
    {
      id: "case-012",
      name: "Avoid sensitive attribute inference",
      category: "Safety",
      difficulty: "Medium",
      goal: "Decline to infer protected traits from indirect signals.",
    },
  ];
  const defaultState = {
    run: 24,
    primaryModel: "aster",
    selectedModels: ["aster", "nova", "orchid"],
    customCases: [],
    results: {},
    previousOverall: 83.6,
    sort: { key: "score", direction: "desc" },
  };
  let state = loadState();
  let currentResults = {};
  let chartPoints = [];
  let toastTimer;
  let resizeTimer;
  let running = false;
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [
    ...context.querySelectorAll(selector),
  ];
  const allCases = () => [...initialCases, ...state.customCases];

  function loadState() {
    try {
      const saved = JSON.parse(WorkspaceStorage.getItem(STORAGE_KEY));
      return saved
        ? {
            ...structuredClone(defaultState),
            ...saved,
            selectedModels: saved.selectedModels || [
              ...defaultState.selectedModels,
            ],
            customCases: saved.customCases || [],
          }
        : structuredClone(defaultState);
    } catch {
      return structuredClone(defaultState);
    }
  }
  function persist() {
    WorkspaceStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function hash(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function seeded(seed) {
    let x = seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967295;
  }

  function scoreCase(testCase, model, run = state.run) {
    const noise =
      (seeded(hash(`${testCase.id}|${model.id}|${run}`)) - 0.5) * 16;
    const profile = model.profile[testCase.category] || 80;
    return clamp(
      Math.round(profile + noise - difficultyPenalty[testCase.difficulty]),
      32,
      99,
    );
  }
  function computeResults() {
    currentResults = {};
    models.forEach((model) => {
      currentResults[model.id] = {};
      allCases().forEach((testCase) => {
        currentResults[model.id][testCase.id] = scoreCase(testCase, model);
      });
    });
    state.results = currentResults;
  }
  function resultFor(score) {
    return score >= 80 ? "pass" : score >= 68 ? "watch" : "fail";
  }
  function average(values) {
    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
  }
  function modelAverage(modelId) {
    return Math.round(average(Object.values(currentResults[modelId] || {})));
  }
  function categoryAverages(modelId) {
    return Object.fromEntries(
      categories.map((category) => [
        category,
        Math.round(
          average(
            allCases()
              .filter((item) => item.category === category)
              .map((item) => currentResults[modelId]?.[item.id] || 0),
          ),
        ),
      ]),
    );
  }

  function renderOverview() {
    const model =
      models.find((item) => item.id === state.primaryModel) || models[0];
    const scores = Object.values(currentResults[model.id]);
    const overall = Math.round(average(scores));
    const passed = scores.filter((score) => score >= 80).length;
    const passRate = Math.round((passed / scores.length) * 100);
    const variance = average(scores.map((score) => (score - overall) ** 2));
    const consistency = Math.round(
      clamp(100 - Math.sqrt(variance) * 1.5, 50, 98),
    );
    const delta = overall - state.previousOverall;
    $("#overallScore").textContent = overall;
    $("#overallTrack").style.width = `${overall}%`;
    $("#scoreDelta").textContent =
      `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`;
    $("#passRate").textContent = `${passRate}%`;
    $("#passFraction").textContent = `${passed} / ${scores.length} cases`;
    $("#consistency").textContent = `${consistency}%`;
    $("#latency").textContent = `${model.latency.toFixed(1)}s`;
    $("#latencyFill").style.width = `${(model.latency / 3) * 100}%`;
    const cat = categoryAverages(model.id);
    const sorted = Object.entries(cat).sort((a, b) => b[1] - a[1]);
    $("#scoreCaption").textContent =
      `Strongest on ${sorted[0][0].toLowerCase()}; watch ${sorted.at(-1)[0].toLowerCase()}.`;
    $("#passSpark").innerHTML = scores
      .slice(-12)
      .map(
        (score) =>
          `<i style="height:${clamp(score - 45, 5, 40)}px;background:${score >= 80 ? "var(--cyan)" : score >= 68 ? "var(--yellow)" : "var(--orange)"}"></i>`,
      )
      .join("");
    $("#terrainModelTag").textContent = model.name.toUpperCase();
    renderRadar(cat);
    renderCategoryBars(cat);
    renderRecent(model.id);
    renderSignal(cat);
    buildTrendData();
    drawTrendChart();
  }

  function renderRadar(cat) {
    const center = [160, 125],
      radius = 95;
    const points = categories.map((category, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
      const r = radius * (cat[category] / 100);
      return `${(center[0] + Math.cos(angle) * r).toFixed(1)},${(center[1] + Math.sin(angle) * r).toFixed(1)}`;
    });
    $("#radarArea").setAttribute("points", points.join(" "));
    const sorted = Object.entries(cat).sort((a, b) => b[1] - a[1]);
    $("#terrainHigh").textContent = sorted[0][1];
    $("#terrainHighLabel").textContent = sorted[0][0];
    $("#terrainLow").textContent = sorted.at(-1)[1];
    $("#terrainLowLabel").textContent = sorted.at(-1)[0];
  }
  function renderCategoryBars(cat) {
    $("#categoryBars").innerHTML = categories
      .map(
        (category) =>
          `<div class="category-row"><span>${category}</span><div class="bar"><i style="--value:${cat[category]}%;--bar-color:${categoryColors[category]}"></i></div><b>${cat[category]}</b></div>`,
      )
      .join("");
  }
  function renderSignal(cat) {
    const sorted = Object.entries(cat).sort((a, b) => a[1] - b[1]);
    const weak = sorted[0],
      strong = sorted.at(-1),
      gap = strong[1] - weak[1];
    $("#signalTitle").textContent = `${weak[0]} is the widest gap.`;
    $("#signalBody").textContent =
      `The primary model is ${gap} points behind its ${strong[0].toLowerCase()} score on ${weak[0].toLowerCase()} tasks. Add adversarial cases in this category before the next real evaluation.`;
  }
  function renderRecent(modelId) {
    const rows = allCases()
      .slice()
      .sort(
        (a, b) => currentResults[modelId][a.id] - currentResults[modelId][b.id],
      )
      .slice(0, 5);
    $("#recentTableBody").innerHTML = rows
      .map((item) => rowHtml(item, modelId, false))
      .join("");
    bindRowButtons($("#recentTableBody"));
  }

  function rowHtml(item, modelId, full = true) {
    const score = currentResults[modelId][item.id];
    const result = resultFor(score);
    const resultColor =
      result === "pass"
        ? "var(--cyan)"
        : result === "watch"
          ? "var(--yellow)"
          : "var(--orange)";
    return `<tr><td><div class="case-name"><b>${escapeHtml(item.name)}</b><span>${item.id.toUpperCase()}</span></div></td><td><span class="category-chip"><i style="--chip-color:${categoryColors[item.category]}"></i>${item.category}</span></td><td><span class="difficulty-chip">${item.difficulty}</span></td><td><span class="score-cell">${score}<i class="tiny-bar"><i style="--score:${score}%;--score-color:${resultColor}"></i></i></span></td><td><span class="result-chip" style="--result-color:${resultColor}">${result}</span></td>${full ? `<td>${relativeRun(item)}</td>` : ""}<td><button class="row-open" data-open-case="${item.id}" type="button" aria-label="Open ${escapeHtml(item.name)}">↗</button></td></tr>`;
  }

  function buildTrendData() {
    chartPoints = models.map((model) => ({
      model,
      values: Array.from({ length: 8 }, (_, index) => {
        const run = state.run - 7 + index;
        return Math.round(
          average(allCases().map((item) => scoreCase(item, model, run))),
        );
      }),
    }));
    $("#trendLegend").innerHTML = chartPoints
      .map(
        (line) =>
          `<span><i style="--legend-color:${line.model.color}"></i>${line.model.name}</span>`,
      )
      .join("");
  }
  function drawTrendChart() {
    const canvas = $("#trendChart");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, rect.width * ratio);
    canvas.height = Math.max(1, rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const w = rect.width,
      h = rect.height,
      p = { l: 32, r: 13, t: 15, b: 20 };
    ctx.clearRect(0, 0, w, h);
    ctx.font = "9px monospace";
    ctx.fillStyle = "#8a9294";
    ctx.textAlign = "right";
    [50, 65, 80, 95].forEach((value) => {
      const y = p.t + ((100 - value) / (100 - 45)) * (h - p.t - p.b);
      ctx.strokeStyle = "#d8d4ca";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.l, y);
      ctx.lineTo(w - p.r, y);
      ctx.stroke();
      ctx.fillText(String(value), p.l - 7, y + 3);
    });
    const points = [];
    chartPoints.forEach((line) => {
      ctx.strokeStyle = line.model.color;
      ctx.lineWidth = line.model.id === state.primaryModel ? 2.5 : 1.4;
      ctx.globalAlpha = line.model.id === state.primaryModel ? 1 : 0.65;
      ctx.beginPath();
      line.values.forEach((value, index) => {
        const x = p.l + (index / (line.values.length - 1)) * (w - p.l - p.r);
        const y = p.t + ((100 - value) / (100 - 45)) * (h - p.t - p.b);
        points.push({ x, y, value, model: line.model });
        index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
      line.values.forEach((value, index) => {
        const x = p.l + (index / (line.values.length - 1)) * (w - p.l - p.r),
          y = p.t + ((100 - value) / (100 - 45)) * (h - p.t - p.b);
        ctx.fillStyle = line.model.color;
        ctx.beginPath();
        ctx.arc(
          x,
          y,
          line.model.id === state.primaryModel ? 3 : 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;
    canvas._points = points;
  }
  function chartPointer(event) {
    const canvas = $("#trendChart"),
      tip = $("#chartTooltip");
    const rect = canvas.getBoundingClientRect(),
      x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    const nearest = (canvas._points || [])
      .map((point) => ({ ...point, d: Math.hypot(point.x - x, point.y - y) }))
      .sort((a, b) => a.d - b.d)[0];
    if (!nearest || nearest.d > 20) {
      tip.hidden = true;
      return;
    }
    tip.hidden = false;
    tip.innerHTML = `<b>${nearest.model.name}</b><br>${nearest.value} / 100`;
    tip.style.left = `${clamp(nearest.x + 10, 0, rect.width - 90)}px`;
    tip.style.top = `${clamp(nearest.y - 35, 0, rect.height - 45)}px`;
  }

  function renderCases() {
    const modelId = state.primaryModel;
    const search = $("#caseSearch").value.trim().toLowerCase();
    const category = $("#categoryFilter").value;
    const result = $("#resultFilter").value;
    let rows = allCases().filter(
      (item) =>
        (!search ||
          `${item.name} ${item.goal} ${item.id}`
            .toLowerCase()
            .includes(search)) &&
        (category === "all" || item.category === category) &&
        (result === "all" ||
          resultFor(currentResults[modelId][item.id]) === result),
    );
    const direction = state.sort.direction === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let av =
        state.sort.key === "score"
          ? currentResults[modelId][a.id]
          : a[state.sort.key];
      let bv =
        state.sort.key === "score"
          ? currentResults[modelId][b.id]
          : b[state.sort.key];
      return (
        (typeof av === "string" ? av.localeCompare(bv) : av - bv) * direction
      );
    });
    $("#filterCount").textContent = `${rows.length} shown`;
    $("#suiteCount").textContent = allCases().length;
    $("#navCaseCount").textContent = allCases().length;
    $("#casesTableBody").innerHTML = rows.length
      ? rows.map((item) => rowHtml(item, modelId, true)).join("")
      : '<tr><td colspan="7" class="table-empty">No coordinates match those filters.</td></tr>';
    bindRowButtons($("#casesTableBody"));
  }

  function renderCompare() {
    $("#modelToggles").innerHTML = models
      .map(
        (model) =>
          `<button class="model-toggle ${state.selectedModels.includes(model.id) ? "active" : ""}" style="--model-color:${model.color}" data-toggle-model="${model.id}" type="button"><i></i><b>${model.name}</b><span>${model.note}</span></button>`,
      )
      .join("");
    $$("[data-toggle-model]").forEach((button) =>
      button.addEventListener("click", () => {
        const id = button.dataset.toggleModel;
        if (
          state.selectedModels.includes(id) &&
          state.selectedModels.length > 1
        )
          state.selectedModels = state.selectedModels.filter(
            (item) => item !== id,
          );
        else if (
          !state.selectedModels.includes(id) &&
          state.selectedModels.length < 3
        )
          state.selectedModels.push(id);
        persist();
        renderCompare();
      }),
    );
    const selected = models.filter((model) =>
      state.selectedModels.includes(model.id),
    );
    const metrics = ["Overall", "Pass rate", ...categories, "Sim. latency"];
    $("#compareHead").innerHTML =
      `<tr><th>METRIC</th>${selected.map((model) => `<th style="box-shadow:inset 0 3px ${model.color}">${model.name}</th>`).join("")}</tr>`;
    $("#compareBody").innerHTML = metrics
      .map(
        (metric) =>
          `<tr><td>${metric}</td>${selected.map((model) => `<td>${compareValue(model, metric)}</td>`).join("")}</tr>`,
      )
      .join("");
    const ranked = selected
      .map((model) => ({ model, score: modelAverage(model.id) }))
      .sort((a, b) => b.score - a.score);
    const winner = ranked[0];
    $("#winnerCard").innerHTML =
      `<div class="winner-orbit">◎</div><p class="overline">CURRENT LEADER</p><h2>${winner.model.name}</h2><p>${winner.model.note}. Leads this seeded suite by ${ranked.length > 1 ? winner.score - ranked[1].score : 0} points overall.</p><div class="winner-score"><strong>${winner.score}</strong><span>DEMO SCORE</span></div>`;
    renderMatrix(selected);
  }
  function compareValue(model, metric) {
    const values = Object.values(currentResults[model.id]);
    if (metric === "Overall") return modelAverage(model.id);
    if (metric === "Pass rate")
      return `${Math.round((values.filter((v) => v >= 80).length / values.length) * 100)}%`;
    if (metric === "Sim. latency") return `${model.latency.toFixed(1)}s`;
    return categoryAverages(model.id)[metric];
  }
  function renderMatrix(selected) {
    const displayModels = [...selected];
    while (displayModels.length < 3) displayModels.push(null);
    let html =
      '<div class="matrix-cell header">TEST CASE</div>' +
      displayModels
        .map(
          (model) =>
            `<div class="matrix-cell header">${model ? model.name : "—"}</div>`,
        )
        .join("");
    allCases()
      .slice(0, 8)
      .forEach((item) => {
        html += `<div class="matrix-cell">${escapeHtml(item.name)}</div>`;
        displayModels.forEach((model) => {
          if (!model) {
            html += '<div class="matrix-cell"></div>';
            return;
          }
          const score = currentResults[model.id][item.id],
            color =
              score >= 80
                ? "var(--cyan)"
                : score >= 68
                  ? "var(--yellow)"
                  : "var(--orange)";
          html += `<div class="matrix-cell score" style="--cell-color:${color};--cell-strength:${Math.max(3, (score - 45) / 3)}%;--cell-score:${score}%"><b>${score}</b><i></i></div>`;
        });
      });
    $("#caseMatrix").innerHTML = html;
  }

  function openDetail(id) {
    const item = allCases().find((test) => test.id === id);
    if (!item) return;
    const primary = currentResults[state.primaryModel][id],
      result = resultFor(primary);
    $("#detailContent").innerHTML =
      `<header class="detail-header"><p class="overline">${item.id.toUpperCase()}</p><h2 id="detailTitle">${escapeHtml(item.name)}</h2><div class="detail-meta"><span class="category-chip"><i style="--chip-color:${categoryColors[item.category]}"></i>${item.category}</span><span class="difficulty-chip">${item.difficulty}</span></div><p>${escapeHtml(item.goal)}</p></header><div class="detail-score"><strong>${primary}<span>/100</span></strong><p>${result === "pass" ? "Meets the illustrative pass threshold for this seeded run." : result === "watch" ? "Close to threshold; worth inspecting in a real harness." : "Below the illustrative threshold on this run."}</p></div><section class="model-results">${models.map((model) => `<div class="model-result"><b>${model.name}</b><span>${model.note}</span><strong>${currentResults[model.id][id]}</strong></div>`).join("")}</section><p class="detail-foot">SIMULATED RESULT · RUN ${String(state.run).padStart(3, "0")}<br>No model call was made.</p>`;
    $("#detailDrawer").hidden = false;
    $("#drawerScrim").hidden = false;
    $("#closeDetailButton").focus();
  }
  function closeDetail() {
    $("#detailDrawer").hidden = true;
    $("#drawerScrim").hidden = true;
  }
  function bindRowButtons(context) {
    $$("[data-open-case]", context).forEach((button) =>
      button.addEventListener("click", () =>
        openDetail(button.dataset.openCase),
      ),
    );
  }

  function showPage(name) {
    $$(".page").forEach((page) => {
      const active = page.dataset.page === name;
      page.hidden = !active;
      page.classList.toggle("active", active);
    });
    $$(".nav-item").forEach((item) => {
      const active = item.dataset.view === name;
      item.classList.toggle("active", active);
      item.toggleAttribute("aria-current", active);
    });
    $("#breadcrumbLabel").textContent = name.toUpperCase();
    document.querySelector(".sidebar").classList.remove("open");
    $("#mobileMenuButton").setAttribute("aria-expanded", "false");
    if (name === "cases") renderCases();
    if (name === "compare") renderCompare();
    if (name === "overview") requestAnimationFrame(drawTrendChart);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addCase(event) {
    event.preventDefault();
    const name = $("#newCaseName").value.trim(),
      goal = $("#newCaseGoal").value.trim();
    if (!name || !goal) return;
    state.customCases.push({
      id: `case-${String(allCases().length + 1).padStart(3, "0")}-${Date.now().toString(36)}`,
      name,
      goal,
      category: $("#newCaseCategory").value,
      difficulty: $("#newCaseDifficulty").value,
      custom: true,
    });
    persist();
    computeResults();
    closeCaseModal();
    renderEverything();
    showPage("cases");
    toast("Test case added to the local suite");
    event.target.reset();
  }
  function openCaseModal() {
    $("#caseModal").hidden = false;
    setTimeout(() => $("#newCaseName").focus(), 0);
  }
  function closeCaseModal() {
    $("#caseModal").hidden = true;
  }

  function runEval() {
    if (running) return;
    running = true;
    $("#runEvalButton").disabled = true;
    const overlay = $("#runOverlay");
    overlay.hidden = false;
    const total = allCases().length;
    let done = 0;
    $("#runProgressBar").style.width = "0%";
    $("#runProgressMeta").textContent = `0 / ${total} cases`;
    const labels = [
      "Plotting test coordinates…",
      "Scoring category terrain…",
      "Comparing model contours…",
      "Drawing the new atlas…",
    ];
    const interval = setInterval(
      () => {
        done += 1;
        const progress = done / total;
        $("#runProgressBar").style.width = `${progress * 100}%`;
        $("#runProgressMeta").textContent = `${done} / ${total} cases`;
        $("#runProgressTitle").textContent =
          labels[
            Math.min(labels.length - 1, Math.floor(progress * labels.length))
          ];
        if (done >= total) {
          clearInterval(interval);
          setTimeout(() => {
            state.previousOverall = modelAverage(state.primaryModel);
            state.run += 1;
            persist();
            computeResults();
            renderEverything();
            overlay.hidden = true;
            running = false;
            $("#runEvalButton").disabled = false;
            toast(
              `Simulated run ${String(state.run).padStart(3, "0")} complete`,
            );
          }, 450);
        }
      },
      Math.max(70, 900 / total),
    );
  }

  function exportCsv() {
    const model = models.find((item) => item.id === state.primaryModel);
    const lines = [
      [
        "id",
        "name",
        "category",
        "difficulty",
        "model",
        "score",
        "result",
        "run",
      ],
      ...allCases().map((item) => {
        const score = currentResults[model.id][item.id];
        return [
          item.id,
          item.name,
          item.category,
          item.difficulty,
          model.name,
          score,
          resultFor(score),
          state.run,
        ];
      }),
    ];
    const csv = lines
      .map((row) =>
        row
          .map((value) => {
            let cell = String(value);
            if (/^[\s]*[=+@-]|^[\t\r\n]/.test(cell)) cell = "'" + cell;
            return `"${cell.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `eval-atlas-run-${state.run}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast("Current results exported");
  }

  function renderEverything() {
    const primarySelect = $("#primaryModel");
    primarySelect.innerHTML = models
      .map(
        (model) =>
          `<option value="${model.id}">${model.name} · ${model.note}</option>`,
      )
      .join("");
    primarySelect.value = state.primaryModel;
    const categorySelect = $("#categoryFilter");
    if (categorySelect.options.length === 1)
      categories.forEach((category) =>
        categorySelect.add(new Option(category, category)),
      );
    $("#navCaseCount").textContent = allCases().length;
    $("#lastRunLabel").textContent =
      `RUN ${String(state.run).padStart(3, "0")}`;
    $("#lastRunTime").textContent = "seeded local result";
    renderOverview();
    renderCases();
    renderCompare();
  }
  function relativeRun(item) {
    return item.custom
      ? "Added locally"
      : `Run ${String(state.run).padStart(3, "0")}`;
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function escapeHtml(value = "") {
    return String(value).replace(
      /[&<>'"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[char],
    );
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
    toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2300);
  }

  $$(".nav-item").forEach((button) =>
    button.addEventListener("click", () => showPage(button.dataset.view)),
  );
  $$("[data-go]").forEach((button) =>
    button.addEventListener("click", () => showPage(button.dataset.go)),
  );
  $("#primaryModel").addEventListener("change", (event) => {
    state.primaryModel = event.target.value;
    persist();
    renderEverything();
  });
  $("#caseSearch").addEventListener("input", renderCases);
  $("#categoryFilter").addEventListener("change", renderCases);
  $("#resultFilter").addEventListener("change", renderCases);
  $("#resetFiltersButton").addEventListener("click", () => {
    $("#caseSearch").value = "";
    $("#categoryFilter").value = "all";
    $("#resultFilter").value = "all";
    renderCases();
  });
  $$("[data-sort]").forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      state.sort.direction =
        state.sort.key === key && state.sort.direction === "asc"
          ? "desc"
          : "asc";
      state.sort.key = key;
      persist();
      renderCases();
    }),
  );
  $("#addCaseButton").addEventListener("click", openCaseModal);
  $("#caseForm").addEventListener("submit", addCase);
  $("#closeCaseModal").addEventListener("click", closeCaseModal);
  $("#cancelCaseButton").addEventListener("click", closeCaseModal);
  $("#caseModal").addEventListener("click", (event) => {
    if (event.target === $("#caseModal")) closeCaseModal();
  });
  $("#closeDetailButton").addEventListener("click", closeDetail);
  $("#drawerScrim").addEventListener("click", closeDetail);
  $("#runEvalButton").addEventListener("click", runEval);
  $("#exportCsvButton").addEventListener("click", exportCsv);
  $("#mobileMenuButton").addEventListener("click", () => {
    const sidebar = document.querySelector(".sidebar");
    const open = sidebar.classList.toggle("open");
    $("#mobileMenuButton").setAttribute("aria-expanded", String(open));
  });
  $("#trendChart").addEventListener("mousemove", chartPointer);
  $("#trendChart").addEventListener("mouseleave", () => {
    $("#chartTooltip").hidden = true;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetail();
      closeCaseModal();
      document.querySelector(".sidebar").classList.remove("open");
    }
  });
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawTrendChart, 100);
  });
  computeResults();
  renderEverything();
})();
