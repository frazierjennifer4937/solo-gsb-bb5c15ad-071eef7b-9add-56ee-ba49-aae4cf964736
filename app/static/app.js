"use strict";

const tbody = document.getElementById("region-tbody");
const errorBox = document.getElementById("error-box");
const resultSection = document.getElementById("result-section");
const summaryCard = document.getElementById("summary-card");
const paradoxDetails = document.getElementById("paradox-details");
const overviewWrap = document.getElementById("overview-wrap");

let rowSeq = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renumber() {
  tbody.querySelectorAll("tr").forEach((tr, i) => {
    tr.querySelector(".row-num").textContent = i + 1;
  });
}

function addRegion(name = "", population = "") {
  rowSeq += 1;
  const tr = document.createElement("tr");

  const tdNum = el("td", "row-num center");
  const tdName = document.createElement("td");
  const nameInput = el("input");
  nameInput.type = "text";
  nameInput.className = "region-name";
  nameInput.placeholder = `地区${rowSeq}`;
  nameInput.maxLength = 40;
  nameInput.value = name;
  tdName.appendChild(nameInput);

  const tdPop = document.createElement("td");
  const popInput = el("input");
  popInput.type = "number";
  popInput.className = "region-pop";
  popInput.min = "1";
  popInput.step = "1";
  popInput.value = population;
  tdPop.appendChild(popInput);

  const tdOp = document.createElement("td");
  const delBtn = el("button", "del-btn", "✕");
  delBtn.type = "button";
  delBtn.title = "删除该行";
  delBtn.addEventListener("click", () => {
    tr.remove();
    renumber();
  });
  tdOp.appendChild(delBtn);

  tr.append(tdNum, tdName, tdPop, tdOp);
  tbody.appendChild(tr);
  renumber();
}

function resetRegions() {
  tbody.innerHTML = "";
  addRegion();
  addRegion();
  addRegion();
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function collectInputs() {
  const regions = [];
  tbody.querySelectorAll("tr").forEach((tr, i) => {
    const name = tr.querySelector(".region-name").value.trim() || `地区${i + 1}`;
    const popRaw = tr.querySelector(".region-pop").value.trim();
    regions.push({ name, population: popRaw, row: i + 1 });
  });
  const start = document.getElementById("seat-start").value.trim();
  const end = document.getElementById("seat-end").value.trim();
  return { regions, start, end };
}

function validateInputs({ regions, start, end }) {
  const problems = [];
  if (regions.length < 2) problems.push("至少需要 2 个地区。");
  const names = new Set();
  for (const r of regions) {
    if (!/^\d+$/.test(r.population) || BigInt(r.population) <= 0n) {
      problems.push(`第 ${r.row} 行「${r.name}」的人口必须是正整数。`);
    }
    if (names.has(r.name)) problems.push(`地区名称「${r.name}」重复。`);
    names.add(r.name);
  }
  if (!/^\d+$/.test(start) || Number(start) < 1) problems.push("席位起始值必须是不小于 1 的整数。");
  if (!/^\d+$/.test(end)) problems.push("席位终止值必须是整数。");
  if (problems.length === 0) {
    if (Number(end) <= Number(start)) problems.push("席位终止值必须大于起始值。");
    else if (Number(end) - Number(start) > 500) problems.push("扫描跨度（终止值 − 起始值）不能超过 500。");
  }
  return problems;
}

async function loadExample() {
  clearError();
  try {
    const resp = await fetch("/api/example");
    const data = await resp.json();
    tbody.innerHTML = "";
    data.regions.forEach((r) => addRegion(r.name, r.population));
    document.getElementById("seat-start").value = data.start;
    document.getElementById("seat-end").value = data.end;
  } catch (e) {
    showError("载入示例失败：" + e.message);
  }
}

async function scan() {
  clearError();
  const inputs = collectInputs();
  const problems = validateInputs(inputs);
  if (problems.length > 0) {
    showError(problems.join("\n"));
    return;
  }
  const payload = {
    regions: inputs.regions.map((r) => ({ name: r.name, population: Number(r.population) })),
    start: Number(inputs.start),
    end: Number(inputs.end),
  };
  let data;
  try {
    const resp = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    data = await resp.json();
    if (!resp.ok) {
      showError(extractError(data));
      return;
    }
  } catch (e) {
    showError("请求失败：" + e.message);
    return;
  }
  renderResults(data);
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function extractError(data) {
  if (!data || data.detail === undefined) return "服务器返回了无法识别的错误。";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d) => {
        const loc = Array.isArray(d.loc) ? d.loc.filter((x) => x !== "body").join(".") : "";
        return loc ? `${loc}: ${d.msg}` : d.msg;
      })
      .join("\n");
  }
  return JSON.stringify(data.detail);
}

/* ---------- 结果渲染 ---------- */

function resultBySeats(data, seats) {
  return data.results.find((r) => r.seats_total === seats);
}

function renderResults(data) {
  renderSummary(data);
  renderParadoxes(data);
  renderOverview(data);
}

function renderSummary(data) {
  summaryCard.innerHTML = "";
  summaryCard.appendChild(el("h2", null, "2. 扫描结果"));

  const grid = el("div", "summary-grid");
  const items = [
    ["地区数", data.regions.length],
    ["总人口", data.total_population],
    ["扫描范围", `${data.start} ~ ${data.end}`],
    ["计算档数", data.results.length],
    ["阿拉巴马悖论", data.paradoxes.length],
  ];
  for (const [label, value] of items) {
    const item = el("div", "item");
    item.appendChild(el("div", "label", label));
    item.appendChild(el("div", "value", String(value)));
    grid.appendChild(item);
  }
  summaryCard.appendChild(grid);

  if (data.paradoxes.length === 0) {
    summaryCard.appendChild(
      el("p", "verdict-ok", "✓ 该范围内未发现阿拉巴马悖论：没有任何地区在总席位增加一个后席位减少。")
    );
  } else {
    const box = el("div", "verdict-bad");
    box.appendChild(el("div", null, `⚠ 发现 ${data.paradoxes.length} 次阿拉巴马悖论：`));
    const ul = document.createElement("ul");
    for (const p of data.paradoxes) {
      const losers = p.losers.map((l) => `${l.name}（${l.before} → ${l.after} 席）`).join("、");
      ul.appendChild(el("li", null, `总席位 ${p.from_seats} → ${p.to_seats}：${losers}`));
    }
    box.appendChild(ul);
    summaryCard.appendChild(box);
  }
}

function buildAllocTable(result, counterpart, loserIndexes) {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const cols = [
    ["地区", ""], ["人口", "num"], ["配额（分数）", "num"], ["配额（小数）", "num"],
    ["整数席位", "num"], ["余数（分数）", "num"], ["余数（小数）", "num"],
    ["余数排名", "num"], ["余数席位", "center"], ["最终席位", "num"],
  ];
  for (const [label, cls] of cols) headRow.appendChild(el("th", cls, label));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tb = document.createElement("tbody");
  for (const row of result.rows) {
    const tr = document.createElement("tr");
    if (loserIndexes && loserIndexes.has(row.index)) tr.classList.add("loser");

    const other = counterpart ? counterpart.rows[row.index] : null;
    let seatCls = "num";
    if (other) {
      if (row.seats < other.seats) seatCls += " seat-down";
      else if (row.seats > other.seats) seatCls += " seat-up";
    }

    const cells = [
      [result.names[row.index], ""],
      [row.population, "num"],
      [row.quota_str, "num"],
      [row.quota_decimal, "num"],
      [row.floor, "num"],
      [row.remainder_str, "num"],
      [row.remainder_decimal, "num"],
      [row.remainder_rank, "num"],
      [row.remainder_awarded ? "＋1" : "—", "center" + (row.remainder_awarded ? " awarded" : "")],
      [row.seats, seatCls],
    ];
    for (const [val, cls] of cells) tr.appendChild(el("td", cls || null, String(val)));
    tb.appendChild(tr);
  }
  table.appendChild(tb);
  return table;
}

function renderParadoxes(data) {
  paradoxDetails.innerHTML = "";
  for (const result of data.results) result.names = data.regions.map((r) => r.name);

  data.paradoxes.forEach((p, idx) => {
    const before = resultBySeats(data, p.from_seats);
    const after = resultBySeats(data, p.to_seats);
    const loserIndexes = new Set(p.losers.map((l) => l.index));

    const card = el("div", "paradox-card");
    card.appendChild(
      el("h3", null, `⚠ 悖论 ${idx + 1}：总席位 ${p.from_seats} → ${p.to_seats}`)
    );
    const loserText = p.losers
      .map((l) => `${l.name}：${l.before} 席 → ${l.after} 席`)
      .join("；");
    card.appendChild(el("p", "sub", `总席位增加一个，${loserText}。下表并列展示变化前后的精确配额、余数排序与席位归属。`));

    const compare = el("div", "compare");

    const panelBefore = el("div", "panel");
    const h1 = el("h4", null, "变化前：总席位 ");
    h1.appendChild(el("span", "seats", String(p.from_seats)));
    panelBefore.appendChild(h1);
    panelBefore.appendChild(buildAllocTable(before, after, loserIndexes));

    const arrow = el("div", "arrow", "→");

    const panelAfter = el("div", "panel");
    const h2 = el("h4", null, "变化后：总席位 ");
    h2.appendChild(el("span", "seats", String(p.to_seats)));
    panelAfter.appendChild(h2);
    panelAfter.appendChild(buildAllocTable(after, before, loserIndexes));

    compare.append(panelBefore, arrow, panelAfter);
    card.appendChild(compare);
    paradoxDetails.appendChild(card);
  });
}

function renderOverview(data) {
  overviewWrap.innerHTML = "";
  const paradoxByFrom = new Map(data.paradoxes.map((p) => [p.from_seats, p]));

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(el("th", "num", "总席位"));
  for (const r of data.regions) headRow.appendChild(el("th", "num", r.name));
  headRow.appendChild(el("th", null, "备注"));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tb = document.createElement("tbody");
  for (const result of data.results) {
    const tr = document.createElement("tr");
    const paradox = paradoxByFrom.get(result.seats_total);
    if (paradox) tr.classList.add("paradox-from");

    tr.appendChild(el("td", "num", String(result.seats_total)));
    for (const row of result.rows) tr.appendChild(el("td", "num", String(row.seats)));

    const note = paradox
      ? `⚠ 增至 ${paradox.to_seats} 时：${paradox.losers
          .map((l) => `${l.name} ${l.before}→${l.after}`)
          .join("、")}`
      : "";
    tr.appendChild(el("td", "note", note));
    tb.appendChild(tr);
  }
  table.appendChild(tb);
  overviewWrap.appendChild(table);
}

/* ---------- 事件绑定 ---------- */

document.getElementById("add-region").addEventListener("click", () => addRegion());
document.getElementById("load-example").addEventListener("click", loadExample);
document.getElementById("scan-btn").addEventListener("click", scan);
document.getElementById("reset-btn").addEventListener("click", () => {
  resetRegions();
  resultSection.hidden = true;
  clearError();
});

resetRegions();
