import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "personal-expense-app";

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // e.g. 2025-12
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

export default function App() {
  // ---- Data state (loaded directly from localStorage) ----
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

  // income edit / view toggle
  const [isEditingIncome, setIsEditingIncome] = useState(false);

  // ---- Save to localStorage on every change ----
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const currentMonthKey = getMonthKey(getTodayDateStr());
  const prevMonthKey = getPrevMonthKey(currentMonthKey);

  // ---- Derived values ----
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

  // Weekly (last 7 days) expenses of current month
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

  // Weekly limit = monthly income / 4 (simple)
  const weeklyLimit = currentMonthIncome / 4;
  const showWarning =
    weeklyLimit > 0 && weeklyTotal > weeklyLimit * 0.8; // 80% se upar warning

  // ---- Handlers ----
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

    setExpenseForm({
      title: "",
      amount: "",
      date: getTodayDateStr(),
      category: "Other",
    });
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

  const hasData =
    data.expenses.length > 0 || Object.keys(data.incomes).length > 0;

  // ---------- BACKUP / RESTORE HANDLERS ----------

  const handleBackupDownload = () => {
    if (!hasData) return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "expense-backup.json";
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
          // 🔁 MERGE: backup + current data (current data ko priority)
          setData((prev) => {
            // incomes: current ko priority
            const mergedIncomes = {
              ...parsed.incomes,
              ...prev.incomes,
            };

            // expenses: id ke basis pe unique merge
            const existingIds = new Set(prev.expenses.map((e) => e.id));
            const mergedExpenses = [...prev.expenses];

            parsed.expenses.forEach((e) => {
              if (!existingIds.has(e.id)) {
                mergedExpenses.push(e);
              }
            });

            // optional: date desc (latest upar)
            mergedExpenses.sort(
              (a, b) => new Date(b.date) - new Date(a.date)
            );

            return {
              incomes: mergedIncomes,
              expenses: mergedExpenses,
            };
          });

          alert("Backup merged successfully ✅ (old + new data dono)");
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

  // ---------- DOWNLOAD BILL (for selected month) ----------
  const handleDownloadBill = () => {
    const expenses = selectedMonthExpenses;
    const income = selectedMonthIncome;
    const total = selectedMonthTotal;
    const balance = income - total;

    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;

    const html = `
      <html>
        <head>
          <title>Expense Bill - ${selectedMonthKey}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              padding: 16px 24px;
            }
            h1, h2, h3 {
              margin: 0 0 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            th, td {
              border: 1px solid #ccc;
              padding: 6px 8px;
              font-size: 14px;
              text-align: left;
            }
            th {
              background: #f3f4f6;
            }
            tfoot td {
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <h1>Monthly Expense Bill</h1>
          <h2>Month: ${selectedMonthKey}</h2>
          <p><strong>Income:</strong> ₹${income}</p>
          <p><strong>Total Expense:</strong> ₹${total}</p>
          <p><strong>Balance:</strong> ₹${balance}</p>
          <hr/>
          <h3>Expense Details</h3>
          ${
            expenses.length === 0
              ? "<p>No expenses for this month.</p>"
              : `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Category</th>
                <th>Amount (₹)</th>
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
                  <td>${e.amount}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total</td>
                <td>₹${total}</td>
              </tr>
            </tfoot>
          </table>
          `
          }
          <br/>
          <p>Generated from My Expense Tracker</p>
        </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>💰 My Expense Tracker</h1>
        <p>Simple • Fast • Personal</p>
      </header>

      <main className="app-main">
        {/* Current month summary */}
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
              {weeklyLimit.toFixed(0)}). Thoda dhyaan se kharch karo 🙂
            </div>
          )}

          {/* Income block: show form OR edit button */}
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
              <label>
                This month income:
                <div className="stat-value">₹{currentMonthIncome}</div>
              </label>
              <button
                type="button"
                className="btn-main"
                onClick={() => {
                  setIncomeInput(String(currentMonthIncome)); // prefill
                  setIsEditingIncome(true);
                }}
              >
                Edit Income
              </button>
            </div>
          )}

          {/* Backup / Restore buttons */}
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

          {/* Current month expense list */}
          <h3 style={{ marginTop: "12px", fontSize: "0.95rem" }}>
            Current Month Expenses
          </h3>
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
                <div className="expense-amount">₹{e.amount}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* Add expense */}
        <section className="card">
          <h2>Add Expense</h2>
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
              <select
                name="category"
                value={expenseForm.category}
                onChange={handleExpenseChange}
              >
                <option value="Food">Food</option>
                <option value="Transport">Transport</option>
                <option value="Shopping">Shopping</option>
                <option value="Bills">Bills</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <button className="btn-main" type="submit">
              Add
            </button>
          </form>
        </section>

        {/* Previous month quick view */}
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

        {/* Any month details (including previous) */}
        <section className="card">
          <h2>Month Details</h2>
          <div className="month-selector">
            <label>
              Month:
              <input
                type="month"
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
              />
            </label>
          </div>

          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">Income</span>
              <span className="stat-value">₹{selectedMonthIncome}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Expense</span>
              <span className="stat-value">₹{selectedMonthTotal}</span>
            </div>
          </div>

          <ul className="expense-list">
            {selectedMonthExpenses.length === 0 && (
              <li className="empty">No expenses for this month yet.</li>
            )}
            {selectedMonthExpenses.map((e) => (
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
                <div className="expense-amount">₹{e.amount}</div>
              </li>
            ))}
          </ul>

          {/* Month bill download button */}
          <button
            type="button"
            className="btn-main bill-btn"
            onClick={handleDownloadBill}
          >
            Download Bill (PDF / Print)
          </button>
        </section>
      </main>

      <footer className="app-footer">
        <span>Made for personal use 🧾</span>
      </footer>
    </div>
  );
}
