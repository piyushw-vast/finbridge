import { useState, useEffect, useRef } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ROLE_COLOR = {
  accountant: "bg-indigo-100 text-indigo-700",
  firm_admin: "bg-violet-100 text-violet-700",
  company_admin: "bg-emerald-100 text-emerald-700",
  company_user: "bg-slate-100 text-slate-600",
};

export default function CommentThread({ invoiceId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.get(`/invoices/${invoiceId}/comments`)
      .then(r => setComments(r.data))
      .catch(() => {});
  }, [invoiceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function handleSend(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/invoices/${invoiceId}/comments`, { message });
      setComments(p => [...p, res.data]);
      setMessage("");
    } catch {}
    finally { setSending(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">Comments</h2>
        <p className="text-xs text-slate-400 mt-0.5">Back-and-forth between company and accountant</p>
      </div>

      <div className="px-6 py-4 space-y-4 max-h-72 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No comments yet. Start the conversation.</p>
        ) : comments.map(c => {
          const isMe = c.user_role === user?.role;
          return (
            <div key={c.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${ROLE_COLOR[c.user_role] || "bg-slate-100 text-slate-600"}`}>
                {c.user_name?.[0]?.toUpperCase()}
              </div>
              <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">{c.user_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize font-medium ${ROLE_COLOR[c.user_role] || "bg-slate-100 text-slate-500"}`}>
                    {c.user_role?.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-slate-400">{timeAgo(c.created_at)}</span>
                </div>
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-slate-100 text-slate-800 rounded-tl-sm"}`}>
                  {c.message}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="px-6 py-4 border-t border-slate-100 flex gap-3">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <button type="submit" disabled={sending || !message.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
