"use strict";

const EXAMPLE = {
  regions: [
    { name: "甲地区", population: "5" },
    { name: "乙地区", population: "3" },
    { name: "丙地区", population: "1" },
  ],
  houseStart: "3",
  houseEnd: "5",
};

const regionRows = document.querySelector("#regionRows");
const form = document.querySelector("#calculatorForm");
const formError = document.querySelector("#formError");
const results = document.querySelector("#results");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function positiveInteger(value) {
  const text = value.trim();
  return /^[1-9]\d*$/.test(text) ? text : null;
}

function renderRegionRow(region = { name: "", population: "" }) {
  const index = regionRows.children.length;
  const row = document.createElement("tr");
  row.innerHTML = `
    <td class="order-col"><span class="row-number">${index + 1}</span></td>
    <td>
      <input
        class="region-name-input"
        name="regionName"
        type="text"
        maxlength="50"
        value="${escapeHtml(region.name)}"
        placeholder="地区 ${index + 1}"
        aria-label="地区 ${index + 1} 名称"
      />
    </td>
    <td>
      <input
        class="region-population-input"
        name="regionPopulation"
        inputmode="numeric"
        value="${escapeHtml(region.population)}"
        placeholder="例如 12345"
        aria-label="地区 ${index + 1} 人口"
      />
    </td>
    <td class="action-col">
      <button class="icon-button remove-region" type="button" aria-label="删除地区" title="删除地区">×</button>
    </td>
  `;
  regionRows.appendChild(row);
}

function renumberRows() {
  [...regionRows.children].forEach((row, index) => {
    row.querySelector(".row-number").textContent = index + 1;
    row.querySelector(".region-name-input").placeholder = `地区 ${index + 1}`;
    row.querySelectorAll("input").forEach((input) => {
      input.setAttribute("aria-label", `地区 ${index + 1} ${input.name === "regionName" ? "名称" : "人口"}`);
    });
  });
}

function fillRegions(regions) {
  regionRows.innerHTML = "";
  regions.forEach(renderRegionRow);
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.textContent = "";
  formError.hidden = true;
}

function collectPayload() {
  const rows = [...regionRows.querySelectorAll("tr")];
  const seenNames = new Set();
  const regions = [];

  if (rows.length < 2) {
    throw new Error("至少需要录入两个地区。");
  }

  rows.forEach((row, index) => {
    const nameInput = row.querySelector(".region-name-input");
    const populationInput = row.querySelector(".region-population-input");
    const rawName = nameInput.value.trim();
    const name = rawName || `地区 ${index + 1}`;
    const population = positiveInteger(populationInput.value);

    if (!population) {
      populationInput.focus();
      throw new Error(`第 ${index + 1} 个地区的人口必须为正整数。`);
    }
    if (seenNames.has(name)) {
      nameInput.focus();
      throw new Error(`地区名称“${name}”重复，请改用可区分的名称。`);
    }

    seenNames.add(name);
    regions.push({ name, population });
  });

  const houseStart = positiveInteger(document.querySelector("#houseStart").value);
  const houseEnd = positiveInteger(document.querySelector("#houseEnd").value);

  if (!houseStart) {
    throw new Error("席位起始值必须为正整数。");
  }
  if (!houseEnd) {
    throw new Error("席位结束值必须为正整数。");
  }

  // BigInt only validates and subtracts; it never sorts remainders.
  const start = BigInt(houseStart);
  const end = BigInt(houseEnd);
  if (end < start) {
    throw new Error("席位结束值不能小于起始值。");
  }
  if (end - start > 500n) {
    throw new Error("扫描跨度（结束席位 − 起始席位）不能超过 500。");
  }

  return {
    regions,
    houseStart,
    houseEnd,
  };
}

function fractionHtml(fraction, className = "") {
  const classes = `fraction ${className}`.trim();
  return `
    <span class="${classes}" aria-label="${escapeHtml(fraction.numerator)} 比 ${escapeHtml(fraction.denominator)}">
      <span class="numerator">${escapeHtml(fraction.numerator)}</span>
      <span class="denominator">${escapeHtml(fraction.denominator)}</span>
    </span>
  `;
}

function deltaHtml(value) {
  const numeric = BigInt(value);
  const sign = numeric > 0n ? "+" : "";
  const state = numeric < 0n ? "negative" : numeric > 0n ? "positive" : "neutral";
  return `<span class="delta ${state}">${sign}${escapeHtml(value)}</span>`;
}

function regionRowsHtml(allocation, losingIndexes = [], changes = null) {
  const losers = new Set(losingIndexes);
  return allocation.regions.map((region, index) => {
    const isLoser = losers.has(region.index);
    return `
      <tr class="${isLoser ? "loser" : ""} ${region.awarded ? "winner-row" : ""}">
        <td>
          <span class="region-name">
            ${escapeHtml(region.name)}
            ${isLoser ? '<span class="loser-tag">失去席位</span>' : ""}
            ${region.awarded ? '<span class="award-tag">获得余数席位</span>' : ""}
          </span>
        </td>
        <td>${escapeHtml(region.population)}</td>
        <td>${fractionHtml(region.quota)}</td>
        <td>${escapeHtml(region.integerSeats)}</td>
        <td>
          <span class="rank-cell">
            ${escapeHtml(region.remainderRank)}
            ${region.remainderTied ? '<span class="tie-note">同余决胜</span>' : ""}
          </span>
        </td>
        <td>${fractionHtml(region.remainder)}</td>
        <td>
          <span class="seat-value">${escapeHtml(region.seats)}</span>
          ${changes ? deltaHtml(changes[index]) : ""}
        </td>
      </tr>
    `;
  }).join("");
}

function allocationTableHtml(allocation, losingIndexes = [], changes = null) {
  return `
    <div class="table-wrap">
      <table class="allocation-table">
        <thead>
          <tr>
            <th>地区</th>
            <th>人口</th>
            <th>精确配额</th>
            <th>整数席位</th>
            <th>余数名次</th>
            <th>余数</th>
            <th>最终席位</th>
          </tr>
        </thead>
        <tbody>${regionRowsHtml(allocation, losingIndexes, changes)}</tbody>
      </table>
    </div>
  `;
}

function awardOrderHtml(allocation) {
  const regions = new Map(allocation.regions.map((region) => [String(region.index), region]));
  return `
    <div class="award-order">
      <strong>余数排序与席位归属</strong>
      <div class="award-chips">
        ${allocation.awardOrder.map((index, rank) => {
          const region = regions.get(String(index));
          return `
            <span class="award-chip ${region.awarded ? "awarded" : ""}" title="余数名次 ${rank + 1}">
              ${rank + 1}. ${escapeHtml(region.name)}${region.awarded ? " ✓" : ""}
            </span>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function paradoxHtml(paradox) {
  return `
    <article class="card paradox-card">
      <div class="paradox-title">
        <h3>阿拉巴马悖论：总席位 ${escapeHtml(paradox.fromSeats)} → ${escapeHtml(paradox.toSeats)}</h3>
        <span class="inline-alert">增加 1 个总席位后，${paradox.losingIndexes.length} 个地区反而失去席位</span>
      </div>
      <div class="comparison-grid">
        <section class="allocation-panel before">
          <div class="panel-head">
            <strong>变化前 · ${escapeHtml(paradox.before.totalSeats)} 席</strong>
            <span>余数席位 ${escapeHtml(paradox.before.leftoverSeats)} 个</span>
          </div>
          ${allocationTableHtml(paradox.before)}
          ${awardOrderHtml(paradox.before)}
        </section>
        <section class="allocation-panel after">
          <div class="panel-head">
            <strong>变化后 · ${escapeHtml(paradox.after.totalSeats)} 席</strong>
            <span>余数席位 ${escapeHtml(paradox.after.leftoverSeats)} 个</span>
          </div>
          ${allocationTableHtml(paradox.after, paradox.losingIndexes, paradox.changes)}
          ${awardOrderHtml(paradox.after)}
        </section>
      </div>
    </article>
  `;
}

function allocationDetailsHtml(allocation, index, paradoxIndexes) {
  const isParadox = paradoxIndexes.has(index) || paradoxIndexes.has(index - 1);
  const marker = isParadox ? '<span class="loser-tag">涉及悖论</span>' : "";
  return `
    <details class="card allocation-card">
      <summary>
        <span class="summary-houses">
          ${escapeHtml(allocation.totalSeats)} 个总席位
          ${marker}
        </span>
        <span>展开精确配额与余数排序</span>
      </summary>
      <div class="allocation-details-content">
        ${allocationTableHtml(allocation)}
        ${awardOrderHtml(allocation)}
      </div>
    </details>
  `;
}

function renderResults(data) {
  const paradoxHouseIndexes = new Set();
  data.paradoxes.forEach((paradox) => {
    data.allocations.forEach((allocation, index) => {
      if (
        allocation.totalSeats === paradox.fromSeats ||
        allocation.totalSeats === paradox.toSeats
      ) {
        paradoxHouseIndexes.add(index);
      }
    });
  });

  results.innerHTML = `
    <div class="card summary-card">
      <div class="metric">
        <span>席位范围</span>
        <strong>${escapeHtml(data.houseStart)}–${escapeHtml(data.houseEnd)}</strong>
      </div>
      <div class="metric">
        <span>扫描跨度</span>
        <strong>${escapeHtml(data.scanSpan)}</strong>
      </div>
      <div class="metric">
        <span>计算结果数</span>
        <strong>${escapeHtml(data.allocationCount)}</strong>
      </div>
      <div class="metric danger">
        <span>阿拉巴马悖论次数</span>
        <strong>${escapeHtml(data.paradoxCount)}</strong>
      </div>
    </div>

    <div class="section-title">
      <h2>悖论前后并列核查</h2>
      <span class="count-badge">${escapeHtml(data.paradoxCount)} 次</span>
    </div>

    ${data.paradoxes.length === 0
      ? '<div class="inline-alert all-clear">本扫描区间内未发现增加一个总席位后地区失席的情况。</div>'
      : data.paradoxes.map(paradoxHtml).join("")}

    <div class="section-title">
      <h2>全部席位总数的 Hamilton 明细</h2>
      <span class="count-badge">${escapeHtml(data.allocationCount)} 个结果</span>
    </div>
    ${data.allocations
      .map((allocation, index) => allocationDetailsHtml(allocation, index, paradoxHouseIndexes))
      .join("")}
  `;
}

async function submitCalculation(payload) {
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "正在精确计算…";

  try {
    const response = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "计算失败，请检查输入。");
    }
    clearError();
    renderResults(data);
  } catch (error) {
    showError(error.message || "计算请求失败。");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "计算并扫描悖论";
  }
}

document.querySelector("#addRegion").addEventListener("click", () => {
  renderRegionRow();
  clearError();
});

document.querySelector("#loadExample").addEventListener("click", () => {
  fillRegions(EXAMPLE.regions);
  document.querySelector("#houseStart").value = EXAMPLE.houseStart;
  document.querySelector("#houseEnd").value = EXAMPLE.houseEnd;
  clearError();
});

regionRows.addEventListener("click", (event) => {
  if (!event.target.matches(".remove-region")) return;
  if (regionRows.children.length <= 2) {
    showError("Hamilton 核查至少保留两个地区。");
    return;
  }
  event.target.closest("tr").remove();
  renumberRows();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearError();
  try {
    const payload = collectPayload();
    submitCalculation(payload);
  } catch (error) {
    showError(error.message);
  }
});

fillRegions([{}, {}, {}]);
