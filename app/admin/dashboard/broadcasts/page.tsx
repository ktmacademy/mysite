"use client";

import { FormEvent, useEffect, useState } from "react";
import { Megaphone, Info } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

interface Broadcast {
  id: string;
  channel: string;
  title: string | null;
  message: string;
  recipients: number;
  status: string;
  created_at: string;
  sent_at: string | null;
}

export default function BroadcastsPage() {
  const [channel, setChannel] = useState("whatsapp");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<Broadcast[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    adminFetch<{ enabled: boolean; items: Broadcast[] }>("/api/admin/broadcasts", { action: "list" })
      .then((r) => {
        setEnabled(r.enabled);
        setItems(r.items);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!message.trim()) {
      setError("Message is required");
      return;
    }
    setSaving(true);
    try {
      await adminFetch("/api/admin/broadcasts", {
        action: "create",
        channel,
        title,
        message,
        segment: {},
        recipients: 0,
      });
      setMsg("Broadcast saved as a draft.");
      setTitle("");
      setMessage("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const send = async (id: string) => {
    setError("");
    setMsg("");
    setSendingId(id);
    try {
      const r = await adminFetch<{ ok: boolean; recipients: number }>(
        "/api/admin/broadcasts",
        { action: "send", id }
      );
      setMsg(`Push sent to ${r.recipients} device${r.recipients === 1 ? "" : "s"}.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingId(null);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500";

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title="Broadcasts" subtitle="Compose WhatsApp / push campaigns" />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <b>Push</b> broadcasts are live via FCM — save a push campaign, then hit <b>Send now</b> in the history below
          to deliver it to every app user (even with the app closed). <b>WhatsApp</b> broadcasts are still{" "}
          <b>saved as drafts</b> only; sending those needs a WhatsApp Business API provider (AiSensy / Interakt / Twilio
          / Meta) connected.
        </p>
      </div>

      {!enabled && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          The <code>broadcasts</code> table doesn&apos;t exist yet — apply the growth migration to enable saving.
        </div>
      )}

      <form onSubmit={submit} className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">New broadcast</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
                <option value="whatsapp">WhatsApp</option>
                <option value="push">Push notification</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Title (optional)</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Campaign name" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Message*</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="What do you want to tell users?"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !enabled}
          className="mt-5 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
        {msg && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{msg}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </form>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">History</h2>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-gray-500">No broadcasts yet.</p>}
        {items.map((b) => (
          <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-gray-900">{b.title || "(untitled)"}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  b.status === "sent" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {b.channel} · {b.status}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600">{b.message}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">{new Date(b.created_at).toLocaleString()}</p>
              {b.channel === "push" && b.status !== "sent" && (
                <button
                  onClick={() => send(b.id)}
                  disabled={sendingId === b.id}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {sendingId === b.id ? "Sending…" : "Send now"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
