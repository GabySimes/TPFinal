"use strict";

const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const NUMBER_COLUMNS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
];
const BET_TYPES = {
  red: { odds: 1, wins: n => RED_NUMBERS.has(n) },
  black: { odds: 1, wins: n => n !== 0 && !RED_NUMBERS.has(n) },
  even: { odds: 1, wins: n => n !== 0 && n % 2 === 0 },
  odd: { odds: 1, wins: n => n % 2 === 1 },
  low: { odds: 1, wins: n => n >= 1 && n <= 18 },
  high: { odds: 1, wins: n => n >= 19 && n <= 36 },
  "dozen-1": { odds: 2, wins: n => n >= 1 && n <= 12 },
  "dozen-2": { odds: 2, wins: n => n >= 13 && n <= 24 },
  "dozen-3": { odds: 2, wins: n => n >= 25 && n <= 36 }
};

const elements = {
  balance: document.querySelector("#balance"),
  totalBet: document.querySelector("#total-bet"),
  lastNumber: document.querySelector("#last-number"),
  lastColor: document.querySelector("#last-color"),
  history: document.querySelector("#history"),
  message: document.querySelector("#result-message"),
  spin: document.querySelector("#spin-button"),
  clear: document.querySelector("#clear-button"),
  recharge: document.querySelector("#recharge-button"),
  bettingGrid: document.querySelector("#betting-grid"),
  wheel: document.querySelector("#wheel")
};
const context = elements.wheel.getContext("2d");
const bets = new Map();
let balance = 1000;
let selectedChip = 25;
let spinning = false;
let wheelRotation = 0;
let history = [];

function colorForNumber(number) {
  if (number === 0) return "green";
  return RED_NUMBERS.has(number) ? "red" : "black";
}

function formatAmount(amount) {
  return new Intl.NumberFormat("es-ES").format(amount);
}

function buildNumberBoard() {
  NUMBER_COLUMNS.forEach((column, rowIndex) => {
    column.forEach((number, columnIndex) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `bet-cell ${colorForNumber(number)}`;
      cell.dataset.bet = `number-${number}`;
      cell.style.gridColumn = String(columnIndex + 2);
      cell.style.gridRow = String(rowIndex + 1);
      cell.innerHTML = `<span class="cell-number">${number}</span>`;
      cell.setAttribute("aria-label", `Apostar al pleno ${number}`);
      elements.bettingGrid.appendChild(cell);
    });
  });
}

function resizeWheel() {
  const bounds = elements.wheel.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  elements.wheel.width = Math.round(bounds.width * ratio);
  elements.wheel.height = Math.round(bounds.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawWheel();
}

function drawWheel() {
  const bounds = elements.wheel.getBoundingClientRect();
  const size = bounds.width;
  if (!size) return;
  const center = size / 2;
  const outerRadius = size * .475;
  const pocketRadius = size * .39;
  const slice = (Math.PI * 2) / WHEEL_ORDER.length;
  context.clearRect(0, 0, size, size);

  context.beginPath();
  context.arc(center, center, outerRadius, 0, Math.PI * 2);
  context.fillStyle = "#795b32";
  context.fill();
  context.beginPath();
  context.arc(center, center, outerRadius * .94, 0, Math.PI * 2);
  context.fillStyle = "#c5a15b";
  context.fill();

  WHEEL_ORDER.forEach((number, index) => {
    const start = wheelRotation + index * slice - Math.PI / 2 - slice / 2;
    const end = start + slice;
    context.beginPath();
    context.moveTo(center, center);
    context.arc(center, center, pocketRadius, start, end);
    context.closePath();
    context.fillStyle = number === 0 ? "#177448" : RED_NUMBERS.has(number) ? "#a53b3d" : "#202522";
    context.fill();
    context.strokeStyle = "#c3a45f";
    context.lineWidth = Math.max(1, size * .004);
    context.stroke();

    const labelAngle = wheelRotation + index * slice - Math.PI / 2;
    const labelRadius = (outerRadius + pocketRadius) / 2;
    context.save();
    context.translate(center + Math.cos(labelAngle) * labelRadius, center + Math.sin(labelAngle) * labelRadius);
    context.rotate(labelAngle + Math.PI / 2);
    context.fillStyle = "#f4e9cd";
    context.font = `700 ${Math.max(9, size * .035)}px "DM Sans", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(number), 0, 0);
    context.restore();
  });

  context.beginPath();
  context.arc(center, center, size * .12, 0, Math.PI * 2);
  context.fillStyle = "#926f38";
  context.fill();
  context.beginPath();
  context.arc(center, center, size * .085, 0, Math.PI * 2);
  context.fillStyle = "#d5b66e";
  context.fill();
  context.beginPath();
  context.arc(center, center, size * .035, 0, Math.PI * 2);
  context.fillStyle = "#28342a";
  context.fill();
}

function getTotalBet() {
  return Array.from(bets.values()).reduce((sum, amount) => sum + amount, 0);
}

function updateUI() {
  elements.balance.textContent = formatAmount(balance);
  elements.totalBet.textContent = formatAmount(getTotalBet());
  elements.clear.disabled = spinning || bets.size === 0;
  elements.spin.disabled = spinning;
  elements.recharge.disabled = spinning || balance !== 0 || bets.size !== 0;
  document.querySelectorAll(".bet-cell").forEach(cell => {
    cell.disabled = spinning;
    cell.querySelectorAll(".bet-count, .chip-marker").forEach(marker => marker.remove());
    const amount = bets.get(cell.dataset.bet);
    if (amount) {
      const marker = document.createElement("span");
      marker.className = "chip-marker";
      marker.setAttribute("aria-hidden", "true");
      const count = document.createElement("span");
      count.className = "bet-count";
      count.textContent = formatAmount(amount);
      cell.append(marker, count);
      cell.setAttribute("aria-label", `${cell.dataset.bet.replace("-", " ")}: ${formatAmount(amount)} fichas apostadas`);
    }
  });
}

function addBet(betId) {
  if (spinning || balance < selectedChip) return;
  balance -= selectedChip;
  bets.set(betId, (bets.get(betId) || 0) + selectedChip);
  elements.message.className = "result-message";
  elements.message.innerHTML = '<span class="message-mark">✦</span><span>Apuesta añadida a la mesa</span>';
  updateUI();
}

function clearBets() {
  if (spinning || bets.size === 0) return;
  balance += getTotalBet();
  bets.clear();
  elements.message.className = "result-message";
  elements.message.innerHTML = '<span class="message-mark">✦</span><span>Apuestas retiradas; fichas devueltas</span>';
  updateUI();
}

function winningNumber(betId, number) {
  if (betId.startsWith("number-")) return Number(betId.slice(7)) === number;
  return BET_TYPES[betId].wins(number);
}

function showResult(number, netResult) {
  const color = colorForNumber(number);
  elements.lastNumber.textContent = String(number);
  elements.lastNumber.className = `number-badge ${color}`;
  elements.lastColor.textContent = color === "green" ? "Verde" : color === "red" ? "Rojo" : "Negro";
  history = [number, ...history].slice(0, 10);
  elements.history.replaceChildren();
  history.forEach(result => {
    const item = document.createElement("span");
    item.className = `history-item ${colorForNumber(result)}`;
    item.textContent = String(result);
    item.title = `${result} · ${colorForNumber(result)}`;
    elements.history.appendChild(item);
  });

  const message = netResult > 0
    ? `¡Ganaste ${formatAmount(netResult)} fichas netas!`
    : netResult === 0
      ? "Recuperaste tus fichas; no hubo ganancia ni pérdida."
      : `Esta vez no hubo premio. Perdiste ${formatAmount(Math.abs(netResult))} fichas.`;
  elements.message.className = `result-message ${netResult > 0 ? "win" : netResult < 0 ? "loss" : ""}`;
  elements.message.innerHTML = `<span class="message-mark">✦</span><span>${number} ${color === "green" ? "verde" : color === "red" ? "rojo" : "negro"} · ${message}</span>`;
}

function spinWheel() {
  if (spinning) return;
  const number = Math.floor(Math.random() * WHEEL_ORDER.length);
  const winningIndex = WHEEL_ORDER.indexOf(number);
  const slice = (Math.PI * 2) / WHEEL_ORDER.length;
  const desiredRotation = -winningIndex * slice;
  const currentNormalized = ((wheelRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const desiredNormalized = ((desiredRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const alignment = (desiredNormalized - currentNormalized + Math.PI * 2) % (Math.PI * 2);
  const startRotation = wheelRotation;
  const endRotation = startRotation + Math.PI * 2 * 6 + alignment;
  const duration = 4600;
  const startedAt = performance.now();
  const totalBet = getTotalBet();
  let payout = 0;

  spinning = true;
  updateUI();
  elements.message.className = "result-message";
  elements.message.innerHTML = '<span class="message-mark">✦</span><span>La ruleta está girando…</span>';

  function animate(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    wheelRotation = startRotation + (endRotation - startRotation) * eased;
    drawWheel();
    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }
    wheelRotation = desiredRotation;
    drawWheel();
    bets.forEach((amount, betId) => {
      if (winningNumber(betId, number)) {
        const odds = betId.startsWith("number-") ? 35 : BET_TYPES[betId].odds;
        payout += amount * (odds + 1);
      }
    });
    balance += payout;
    bets.clear();
    spinning = false;
    showResult(number, payout - totalBet);
    updateUI();
  }
  requestAnimationFrame(animate);
}

buildNumberBoard();
resizeWheel();
window.addEventListener("resize", resizeWheel);
elements.bettingGrid.addEventListener("click", event => {
  const cell = event.target.closest("[data-bet]");
  if (cell) addBet(cell.dataset.bet);
});
document.querySelectorAll(".outside-cell").forEach(cell => {
  cell.addEventListener("click", () => addBet(cell.dataset.bet));
});
document.querySelectorAll(".chip-option").forEach(option => {
  option.addEventListener("click", () => {
    if (spinning) return;
    selectedChip = Number(option.dataset.chip);
    document.querySelectorAll(".chip-option").forEach(chip => {
      const selected = chip === option;
      chip.classList.toggle("selected", selected);
      chip.setAttribute("aria-pressed", String(selected));
    });
  });
});
elements.spin.addEventListener("click", spinWheel);
elements.clear.addEventListener("click", clearBets);
elements.recharge.addEventListener("click", () => {
  if (!spinning && balance === 0 && bets.size === 0) {
    balance = 1000;
    elements.message.className = "result-message";
    elements.message.innerHTML = '<span class="message-mark">✦</span><span>Saldo recargado con 1,000 fichas virtuales</span>';
    updateUI();
  }
});
updateUI();
