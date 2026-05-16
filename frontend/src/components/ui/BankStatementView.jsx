export default function BankStatementView({ invoice }) {
  const data = invoice.extraction_data || {};
  const transactions = data.transactions || invoice.transaction?.line_items || [];

  const totalDebits = transactions.reduce((s, t) => s + (t.debit || 0), 0);
  const totalCredits = transactions.reduce((s, t) => s + (t.credit || 0), 0);

  function fmt(n) {
    if (n == null) return "—";
    return `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Account", value: data.account_number || "—", sub: data.bank_name || "Bank" },
          { label: "Account Holder", value: data.account_holder || "—", sub: data.statement_period_start ? `${data.statement_period_start} → ${data.statement_period_end}` : "Period" },
          { label: "Total Credits", value: fmt(totalCredits), sub: "Money In", color: "text-emerald-600" },
          { label: "Total Debits", value: fmt(totalDebits), sub: "Money Out", color: "text-rose-500" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-400 font-medium mb-1">{c.label}</p>
            <p className={`text-base font-bold truncate ${c.color || "text-slate-800"}`}>{c.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Transaction table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Transactions</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
            {transactions.length} rows extracted
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm">No transactions extracted</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["Date", "Description", "Ref", "Debit", "Credit", "Balance", "Category"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map((txn, i) => (
                  <tr key={i} className={`hover:bg-slate-50 transition-colors ${txn.debit ? "hover:bg-rose-50/30" : "hover:bg-emerald-50/30"}`}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{txn.date || "—"}</td>
                    <td className="px-4 py-3 text-slate-800 max-w-[240px]">
                      <p className="truncate text-xs" title={txn.description}>{txn.description || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{txn.reference || "—"}</td>
                    <td className="px-4 py-3 text-rose-600 font-medium text-xs whitespace-nowrap">
                      {txn.debit ? fmt(txn.debit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-emerald-600 font-medium text-xs whitespace-nowrap">
                      {txn.credit ? fmt(txn.credit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{txn.balance ? fmt(txn.balance) : "—"}</td>
                    <td className="px-4 py-3">
                      {txn.payment_head_id ? (
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                          Auto
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Totals</td>
                  <td className="px-4 py-3 text-rose-600 font-bold text-sm">{fmt(totalDebits)}</td>
                  <td className="px-4 py-3 text-emerald-600 font-bold text-sm">{fmt(totalCredits)}</td>
                  <td colSpan={2} className="px-4 py-3 text-slate-500 text-xs">
                    {data.closing_balance ? `Closing: ${fmt(data.closing_balance)}` : ""}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
