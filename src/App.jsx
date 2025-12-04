import { useEffect, useMemo, useState, useRef } from "react";
import "./App.css";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const STORAGE_KEY = "personal-expense-app";

const CATEGORY_KEYS = [
  "All",
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Rent",
  "Other",
];

const CATEGORY_LABELS = {
  All: "All categories",
  Food: "🍽️ Food",
  Transport: "🚗 Transport",
  Shopping: "🛒 Shopping",
  Bills: "🧾 Bills",
  Entertainment: "🎮 Entertainment",
  Rent: "🏠 Rent",
  Other: "💡 Other",
};

const DONUT_COLORS = [
  "#f97316",
  "#22c55e",
  "#6366f1",
  "#eab308",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
];

const RADIAN = Math.PI / 180;
const renderDonutLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  index,
}) => {
  if (!percent || percent < 0.06) return null;

  const radius = innerRadius + (outerRadius - innerRadius) * 0.2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const pct = (percent * 100).toFixed(0);
  if (pct === "0") return null;

  return (
    <text
      x={x}
      y={y}
      fill="#020617"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${pct}%`}
    </text>
  );
};

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getPrevMonthKey(currentKey) {
  const [y, m] = currentKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function getTodayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function MultiCategorySelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAll = value.includes("All") || value.length === 0;

  const displayLabel = (opt) =>
    opt === "All" ? "All categories" : CATEGORY_LABELS[opt] || opt;

  const displayText = isAll
    ? "All categories"
    : value.length === 1
      ? displayLabel(value[0])
      : `${value.length} categories selected`;

  const toggleOption = (opt) => {
    let next = value;
    const currentlyAll = value.includes("All");

    if (opt === "All") {
      if (currentlyAll && value.length === 1) {
        next = [];
      } else {
        next = ["All"];
      }
    } else {
      let base = currentlyAll ? [] : value.filter((v) => v !== "All");
      const has = base.includes(opt);
      if (has) {
        base = base.filter((v) => v !== opt);
      } else {
        base = base.concat(opt);
      }
      next = base;
    }

    onChange(next);
  };

  return (
    <div className="multi-select" ref={ref}>
      <div
        className="multi-select-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="multi-select-value">{displayText}</span>
        <span className="multi-select-arrow">▾</span>
      </div>

      {open && (
        <div className="multi-select-dropdown">
          <div className="multi-select-dropdown-child">
            {options.map((opt) => {
              const checked = isAll ? opt === "All" : value.includes(opt);
              return (
                <label key={opt} className="multi-select-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(opt)}
                  />
                  <span>{displayLabel(opt)}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem("expenso-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch (e) {
    }
    return "dark";
  });

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installAvailable, setInstallAvailable] = useState(false);

  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { incomes: {}, expenses: [] };
      }
      const parsed = JSON.parse(raw);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray(parsed.expenses) &&
        typeof parsed.incomes === "object"
      ) {
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse saved data", e);
    }
    return { incomes: {}, expenses: [] };
  });

  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amount: "",
    date: getTodayDateStr(),
    category: "Other",
  });

  const [incomeInput, setIncomeInput] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState(
    getMonthKey(getTodayDateStr())
  );
  const [categoryFilter, setCategoryFilter] = useState(["All"]);
  const [isEditingIncome, setIsEditingIncome] = useState(false);

  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const editFormRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem("expenso-theme", theme);
    } catch (e) {
    }
  }, [theme]);

  useEffect(() => {
    const handleButtonHaptics = (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;

      if (window.navigator && "vibrate" in window.navigator) {
        window.navigator.vibrate(15);
      }

      button.classList.add("btn-haptic");
      setTimeout(() => {
        button.classList.remove("btn-haptic");
      }, 100);
    };

    document.addEventListener("click", handleButtonHaptics);
    return () => document.removeEventListener("click", handleButtonHaptics);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallAvailable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch (e) {
    }
    setDeferredPrompt(null);
    setInstallAvailable(false);
  };

  const currentMonthKey = getMonthKey(getTodayDateStr());
  const prevMonthKey = getPrevMonthKey(currentMonthKey);
  const currentMonthIncome = data.incomes[currentMonthKey] || 0;
  const prevMonthIncome = data.incomes[prevMonthKey] || 0;

  const currentMonthExpenses = useMemo(
    () => data.expenses.filter((e) => e.monthKey === currentMonthKey),
    [data.expenses, currentMonthKey]
  );

  const prevMonthExpenses = useMemo(
    () => data.expenses.filter((e) => e.monthKey === prevMonthKey),
    [data.expenses, prevMonthKey]
  );

  const currentMonthTotal = useMemo(
    () => currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0),
    [currentMonthExpenses]
  );

  const prevMonthTotal = useMemo(
    () => prevMonthExpenses.reduce((sum, e) => sum + e.amount, 0),
    [prevMonthExpenses]
  );

  const weeklyTotal = useMemo(() => {
    const today = new Date(getTodayDateStr());
    const sevenDaysAgo = new Date(getTodayDateStr());
    sevenDaysAgo.setDate(today.getDate() - 6);

    return currentMonthExpenses.reduce((sum, e) => {
      const d = new Date(e.date);
      if (d >= sevenDaysAgo && d <= today) {
        return sum + e.amount;
      }
      return sum;
    }, 0);
  }, [currentMonthExpenses]);

  const weeklyLimit = currentMonthIncome / 4;
  const showWarning = weeklyLimit > 0 && weeklyTotal > weeklyLimit * 0.8;

  const handleIncomeSave = (e) => {
    e.preventDefault();
    const income = Number(incomeInput);
    if (!income || income <= 0) return;
    setData((prev) => ({
      ...prev,
      incomes: { ...prev.incomes, [currentMonthKey]: income },
    }));
    setIncomeInput("");
    setIsEditingIncome(false);
  };

  const handleExpenseChange = (e) => {
    const { name, value } = e.target;
    setExpenseForm((prev) => ({
      ...prev,
      [name]: name === "amount" ? value.replace(/[^\d.]/g, "") : value,
    }));
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    const title = expenseForm.title.trim();
    const amountNum = Number(expenseForm.amount);
    const dateStr = expenseForm.date || getTodayDateStr();

    if (!title || !amountNum || amountNum <= 0) return;

    const monthKey = getMonthKey(dateStr);

    if (editingExpenseId) {
      setData((prev) => ({
        ...prev,
        expenses: prev.expenses.map((exp) =>
          exp.id === editingExpenseId
            ? {
              ...exp,
              title,
              amount: amountNum,
              date: dateStr,
              monthKey,
              category: expenseForm.category || "Other",
            }
            : exp
        ),
      }));
    } else {
      const newExpense = {
        id: Date.now().toString(),
        title,
        amount: amountNum,
        date: dateStr,
        monthKey,
        category: expenseForm.category || "Other",
      };

      setData((prev) => ({
        ...prev,
        expenses: [newExpense, ...prev.expenses],
      }));
    }

    setExpenseForm({
      title: "",
      amount: "",
      date: getTodayDateStr(),
      category: "Other",
    });
    setEditingExpenseId(null);
  };

  const handleDeleteExpense = (id) => {
    const ok = window.confirm("Delete this expense?");
    if (!ok) return;

    setData((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
  };

  const handleEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      title: expense.title,
      amount: String(expense.amount),
      date: expense.date,
      category: expense.category || "Other",
    });

    setTimeout(() => {
      if (editFormRef.current) {
        editFormRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);
  };

  const selectedMonthExpenses = useMemo(
    () => data.expenses.filter((e) => e.monthKey === selectedMonthKey),
    [data.expenses, selectedMonthKey]
  );

  const selectedMonthTotal = useMemo(
    () => selectedMonthExpenses.reduce((s, e) => s + e.amount, 0),
    [selectedMonthExpenses]
  );

  const selectedMonthIncome = data.incomes[selectedMonthKey] || 0;

  const filteredMonthExpenses = useMemo(() => {
    if (categoryFilter.includes("All") || categoryFilter.length === 0) {
      return selectedMonthExpenses;
    }
    return selectedMonthExpenses.filter((e) =>
      categoryFilter.includes(e.category || "Other")
    );
  }, [selectedMonthExpenses, categoryFilter]);

  const filteredMonthTotal = useMemo(
    () => filteredMonthExpenses.reduce((s, e) => s + e.amount, 0),
    [filteredMonthExpenses]
  );

  const hasData =
    data.expenses.length > 0 || Object.keys(data.incomes).length > 0;

  const handleBackupDownload = () => {
    if (!hasData) return;

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    const fileName = `expenso-backup_${y}-${m}-${d}_${hh}-${mm}-${ss}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupRestore = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);

        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.expenses) &&
          typeof parsed.incomes === "object"
        ) {
          setData((prev) => {
            const mergedIncomes = {
              ...parsed.incomes,
              ...prev.incomes,
            };

            const existingIds = new Set(prev.expenses.map((e) => e.id));
            const mergedExpenses = [...prev.expenses];

            parsed.expenses.forEach((e) => {
              if (!existingIds.has(e.id)) {
                mergedExpenses.push(e);
              }
            });

            mergedExpenses.sort(
              (a, b) => new Date(b.date) - new Date(a.date)
            );

            return {
              incomes: mergedIncomes,
              expenses: mergedExpenses,
            };
          });

          alert("Backup merged successfully ✅ (old + new data together)");
        } else {
          alert("Invalid backup file ❌");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to read backup file ❌");
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadBill = () => {
    const isAll =
      categoryFilter.includes("All") || categoryFilter.length === 0;

    const expenses = isAll ? selectedMonthExpenses : filteredMonthExpenses;
    const income = selectedMonthIncome;

    const total = expenses.reduce((s, e) => s + e.amount, 0);

    const fullMonthTotal = selectedMonthExpenses.reduce(
      (s, e) => s + e.amount,
      0
    );

    const balance = income - fullMonthTotal;

    const categoryLabel = isAll
      ? "All categories"
      : categoryFilter.join(", ");

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Expenso - Expense Bill (${selectedMonthKey})</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              padding: 24px 32px;
              margin: 0;
              background: #f3f4f6;
              color: #111827;
            }
            .page {
              max-width: 820px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 12px;
              border: 1px solid #e5e7eb;
              padding: 24px 28px;
              box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
            }
            h1 {
              margin: 0 0 4px;
              font-size: 1.6rem;
            }
            h2 {
              margin: 0 0 12px;
              font-size: 1rem;
              color: #4b5563;
            }
            h3 {
              margin: 18px 0 8px;
              font-size: 1rem;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 12px;
              margin: 14px 0 8px;
            }
            .summary-card {
              background: #f9fafb;
              border-radius: 10px;
              border: 1px solid #e5e7eb;
              padding: 8px 10px;
            }
            .label {
              font-size: 0.75rem;
              color: #6b7280;
            }
            .value {
              margin-top: 2px;
              font-weight: 600;
            }
            .summary-wide {
              grid-column: span 3;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
              font-size: 0.85rem;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 6px 8px;
              text-align: left;
            }
            th {
              background: #f9fafb;
              font-weight: 600;
            }
            tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            tfoot td {
              font-weight: 600;
              background: #f3f4f6;
            }
            .right {
              text-align: right;
            }
            hr {
              border: none;
              border-top: 1px solid #e5e7eb;
              margin: 18px 0;
            }
            .footer {
              margin-top: 18px;
              font-size: 0.75rem;
              color: #6b7280;
            }
            .bill-watermark {
              position: fixed;
              bottom: 80px;
              left: 50%;
              transform: translateX(-50%);
              font-size: 88px;
              font-weight: 900;
              letter-spacing: 8px;
              color: rgba(0, 0, 0, 0.05);
              user-select: none;
              pointer-events: none;
              z-index: 0;
            }
          </style>
        </head>
        <body>
        <div class="bill-watermark">EXPENSO</div>
          <div class="page">
            <h1>Expenso – Monthly Expense Bill</h1>
            <h2>Month: ${selectedMonthKey}</h2>
            <p><strong>Categories:</strong> ${categoryLabel}</p>

            <div class="summary-grid">
              <div class="summary-card">
                <div class="label">Income</div>
                <div class="value">₹${income}</div>
              </div>
              <div class="summary-card">
                <div class="label">Total Expense (selected)</div>
                <div class="value">₹${total}</div>
              </div>
              <div class="summary-card">
                <div class="label">Total Expense (all categories)</div>
                <div class="value">₹${fullMonthTotal}</div>
              </div>
              <div class="summary-card summary-wide">
                <div class="label">Balance (after all expenses)</div>
                <div class="value">₹${balance}</div>
              </div>
            </div>

            <hr />

            <h3>Expense Details</h3>
            ${expenses.length === 0
        ? "<p>No expenses for this selection.</p>"
        : `
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th class="right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${expenses
          .map(
            (e) => `
                  <tr>
                    <td>${e.date}</td>
                    <td>${e.title}</td>
                    <td>${e.category || "Other"}</td>
                    <td class="right">₹${e.amount}</td>
                  </tr>
                `
          )
          .join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3">Total</td>
                  <td class="right">₹${total}</td>
                </tr>
              </tfoot>
            </table>
            `
      }

            <div class="footer">
              Generated from <strong>Expenso</strong>
            </div>
          </div>
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const categoryDonutData = useMemo(() => {
    if (selectedMonthExpenses.length === 0) return [];
    const map = {};
    selectedMonthExpenses.forEach((e) => {
      const key = e.category || "Other";
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map).map(([key, value]) => ({
      key,
      name: CATEGORY_LABELS[key] || key,
      value,
    }));
  }, [selectedMonthExpenses]);

  const lastSixMonthKeys = useMemo(() => {
    const result = [];
    const [year, month] = currentMonthKey.split("-").map(Number);
    const base = new Date(year, month - 1, 1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base);
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      result.push(`${y}-${m}`);
    }
    return result;
  }, [currentMonthKey]);

  const sixMonthTrendData = useMemo(() => {
    return lastSixMonthKeys.map((key) => {
      const income = data.incomes[key] || 0;
      const expense = data.expenses
        .filter((e) => e.monthKey === key)
        .reduce((s, e) => s + e.amount, 0);

      const [y, m] = key.split("-").map(Number);
      const dateObj = new Date(y, m - 1, 1);
      const monthShort = dateObj.toLocaleString("en-US", { month: "short" });
      const shortLabel = `${monthShort} ${(y % 100)
        .toString()
        .padStart(2, "0")}`;

      return {
        monthKey: key,
        shortLabel,
        income,
        expense,
      };
    });
  }, [lastSixMonthKeys, data.expenses, data.incomes]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-part-1">
          <h1>
            <span className="app-header-logo">₹</span>
            Expenso
          </h1>
          <p>Simple • Fast • Personal</p>
        </div>
        <div className="header-part-2">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() =>
              setTheme((prev) => (prev === "dark" ? "light" : "dark"))
            }
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            <i
              className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"
                }`}
            ></i>
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </header>

      <main className="app-main">
        <section className="card">
          <h2>Current Month ({currentMonthKey})</h2>
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Income</span>
              <span className="stat-value">₹{currentMonthIncome}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Expense</span>
              <span className="stat-value">₹{currentMonthTotal}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Last 7 days</span>
              <span className="stat-value">₹{weeklyTotal}</span>
            </div>
          </div>

          {showWarning && (
            <div className="warning">
              ⚠️ Weekly spending is more than 80% of your limit (₹
              {weeklyLimit.toFixed(0)}). Try to spend a bit carefully 🙂
            </div>
          )}

          {currentMonthIncome === 0 || isEditingIncome ? (
            <form className="inline-form" onSubmit={handleIncomeSave}>
              <label>
                Set / Update this month income:
                <input
                  type="number"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  placeholder="e.g. 30000"
                />
              </label>
              <div className="income-actions-row">
                <button className="btn-main" type="submit">
                  {currentMonthIncome === 0 ? "Save Income" : "Update Income"}
                </button>

                {currentMonthIncome !== 0 && (
                  <button
                    type="button"
                    className="btn-secondary btn-main"
                    onClick={() => {
                      setIsEditingIncome(false);
                      setIncomeInput("");
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="inline-form">
              <button
                type="button"
                className="btn-main"
                onClick={() => {
                  setIncomeInput(String(currentMonthIncome));
                  setIsEditingIncome(true);
                }}
              >
                Edit Income
              </button>
            </div>
          )}

          <div className="backup-row">
            <button
              type="button"
              className="btn-main"
              onClick={handleBackupDownload}
              disabled={!hasData}
            >
              Download Backup (JSON)
            </button>

            <label className="backup-restore-label">
              <span>Restore Backup (JSON):</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleBackupRestore}
              />
            </label>
          </div>

          <h3 className="section-subtitle">Current Month Expenses</h3>
          <ul className="expense-list">
            {currentMonthExpenses.length === 0 && (
              <li className="empty">No expenses for this month yet.</li>
            )}
            {currentMonthExpenses.map((e) => (
              <li key={e.id} className="expense-item">
                <div>
                  <div className="expense-title">{e.title}</div>
                  <div className="expense-meta">
                    <span className="expense-category">
                      {e.category || "Other"}
                    </span>
                    <span className="expense-date">{e.date}</span>
                  </div>
                </div>
                <div className="expense-right">
                  <div className="expense-amount">₹{e.amount}</div>
                  <div className="expense-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleEditExpense(e)}
                      title="Edit"
                    >
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleDeleteExpense(e.id)}
                      title="Delete"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" ref={editFormRef}>
          <h2>{editingExpenseId ? "Edit Expense" : "Add Expense"}</h2>
          <form className="form" onSubmit={handleAddExpense}>
            <label>
              What did you buy?
              <input
                name="title"
                value={expenseForm.title}
                onChange={handleExpenseChange}
                placeholder="e.g. Zomato order"
              />
            </label>
            <label>
              Amount (₹)
              <input
                name="amount"
                type="number"
                value={expenseForm.amount}
                onChange={handleExpenseChange}
                placeholder="e.g. 250"
              />
            </label>
            <label>
              Date
              <input
                name="date"
                type="date"
                value={expenseForm.date}
                onChange={handleExpenseChange}
              />
            </label>
            <label>
              Category
              <div className="single-select-wrapper">
                <select
                  name="category"
                  value={expenseForm.category}
                  onChange={handleExpenseChange}
                  className="single-select"
                >
                  <option value="Food">🍽️ Food</option>
                  <option value="Transport">🚗 Transport</option>
                  <option value="Shopping">🛒 Shopping</option>
                  <option value="Bills">🧾 Bills</option>
                  <option value="Entertainment">🎮 Entertainment</option>
                  <option value="Rent">🏠 Rent</option>
                  <option value="Other">💡 Other</option>
                </select>
                <span className="select-arrow">▾</span>
              </div>
            </label>
            <button className="btn-main" type="submit">
              {editingExpenseId ? "Update" : "Add"}
            </button>

            {editingExpenseId && (
              <button
                type="button"
                className="btn-secondary btn-main"
                onClick={() => {
                  setEditingExpenseId(null);
                  setExpenseForm({
                    title: "",
                    amount: "",
                    date: getTodayDateStr(),
                    category: "Other",
                  });
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
        </section>

        <section className="card">
          <div className="card-header-row">
            <h2>Previous Month ({prevMonthKey})</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSelectedMonthKey(prevMonthKey)}
            >
              Show full details
            </button>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Income</span>
              <span className="stat-value">₹{prevMonthIncome}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Expense</span>
              <span className="stat-value">₹{prevMonthTotal}</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Month Details</h2>
          <div className="month-selector">
            <div className="month-field">
              <label>
                Month
                <input
                  type="month"
                  value={selectedMonthKey}
                  onChange={(e) => {
                    setSelectedMonthKey(e.target.value);
                    setCategoryFilter(["All"]);
                  }}
                />
              </label>
            </div>

            <div className="category-field">
              <label className="category-label">
                <span>Categories</span>
                <MultiCategorySelect
                  options={CATEGORY_KEYS}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                />
              </label>
              <span className="multi-hint">
                Click and tick categories to filter
              </span>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Income</span>
              <span className="stat-value">₹{selectedMonthIncome}</span>
            </div>
            <div className="stat">
              <span className="stat-label">
                {categoryFilter.includes("All") || categoryFilter.length === 0
                  ? "Total Expense"
                  : categoryFilter.length === 1
                    ? `Total (${categoryFilter[0]})`
                    : `Total (${categoryFilter.length} categories)`}
              </span>
              <span className="stat-value">₹{filteredMonthTotal}</span>
            </div>

            <div className="stat">
              <span className="stat-label">Remaining Amount</span>
              <span className="stat-value">
                ₹{selectedMonthIncome - selectedMonthTotal}
              </span>
            </div>
          </div>

          <ul className="expense-list">
            {filteredMonthExpenses.length === 0 && (
              <li className="empty">
                {selectedMonthExpenses.length === 0
                  ? "No expenses for this month yet."
                  : "No expenses for this category selection in this month."}
              </li>
            )}
            {filteredMonthExpenses.map((e) => (
              <li key={e.id} className="expense-item">
                <div>
                  <div className="expense-title">{e.title}</div>
                  <div className="expense-meta">
                    <span className="expense-category">
                      {e.category || "Other"}
                    </span>
                    <span className="expense-date">{e.date}</span>
                  </div>
                </div>
                <div className="expense-right">
                  <div className="expense-amount">₹{e.amount}</div>
                  <div className="expense-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleEditExpense(e)}
                      title="Edit"
                    >
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleDeleteExpense(e.id)}
                      title="Delete"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn-main bill-btn"
            onClick={handleDownloadBill}
          >
            Download Bill (PDF / Print)
          </button>
        </section>

        <section className="card">
          <h2>Insights & Graphs</h2>
          <div className="chart-row">
            <div className="chart-box">
              <div className="chart-heading">
                Category Breakdown – {selectedMonthKey}
              </div>
              <div className="chart-sub">
                Split of all expenses for the selected month.
              </div>

              {categoryDonutData.length === 0 ? (
                <div className="chart-empty">
                  No expenses for this month yet, so the chart is empty.
                </div>
              ) : (
                <div className="chart-inner">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <ReTooltip
                        formatter={(value, name) => [`₹${value}`, name]}
                        contentStyle={{
                          background: "#020617",
                          borderRadius: "10px",
                          border: "1px solid #1f2937",
                          boxShadow: "0 12px 30px rgba(15,23,42,0.9)",
                          padding: "8px 10px",
                          color: "#e5e7eb",
                        }}
                        labelStyle={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#e5e7eb",
                          marginBottom: 4,
                        }}
                        itemStyle={{
                          fontSize: "0.78rem",
                          color: "#e5e7eb",
                        }}
                      />
                      <Legend />
                      <Pie
                        data={categoryDonutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={3}
                        labelLine={false}
                        label={renderDonutLabel}
                      >
                        {categoryDonutData.map((entry, index) => (
                          <Cell
                            key={entry.key}
                            fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="chart-box">
              <div className="chart-heading">
                Last 6 Months – Income vs Expense
              </div>
              <div className="chart-sub">
                Overall trend for the last 6 months from the current month.
              </div>

              {sixMonthTrendData.every(
                (d) => d.income === 0 && d.expense === 0
              ) ? (
                <div className="chart-empty">
                  Not enough data for the last 6 months yet. As you add data,
                  this graph will fill automatically.
                </div>
              ) : (
                <div className="chart-inner">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={sixMonthTrendData}
                      margin={{ top: 8, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ReTooltip
                        formatter={(value, name, item) => {
                          const key = item?.dataKey;
                          const label = key === "income" ? "Income" : "Expense";
                          return [`₹${value}`, label];
                        }}
                        labelFormatter={(label, payload) =>
                          payload?.[0]?.payload?.monthKey
                            ? `Month: ${payload[0].payload.monthKey}`
                            : `Month`
                        }
                        contentStyle={{
                          background: "#020617",
                          borderRadius: "10px",
                          border: "1px solid #1f2937",
                          boxShadow: "0 12px 30px rgba(15,23,42,0.9)",
                          padding: "8px 10px",
                          color: "#e5e7eb",
                        }}
                        labelStyle={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#e5e7eb",
                          marginBottom: 4,
                        }}
                        itemStyle={{
                          fontSize: "0.78rem",
                          color: "#e5e7eb",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="income"
                        name="Income"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense"
                        name="Expense"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <div className="unselected-text">
        <p>Expenso</p>
      </div>
      <div className="footer-brand-strip">EXPENSO</div>
      <footer className="app-footer">
        <span>© Expenso - Personal Finance Tracker</span>
        <button
          type="button"
          className="install-btn"
          onClick={handleInstallClick}
          disabled={!installAvailable}
        >
          <i className="fa-solid fa-download"></i>
          <span>{installAvailable ? "Install App" : "Install"}</span>
        </button>
      </footer>
    </div>
  );
}
