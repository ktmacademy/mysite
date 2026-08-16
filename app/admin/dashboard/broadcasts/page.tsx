"use client";

import { FormEvent, useEffect, useState } from "react";
import { Megaphone, Info } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    adminFetch<{ enabled: boolean; items: Broadcast[] }>("/api/admin/broadcasts", {
      action: "list",
    })
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
      setMsg(
        `Push sent to ${r.recipients} device${r.recipients === 1 ? "" : "s"}.`
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title="Broadcasts" subtitle="Compose WhatsApp / push campaigns" />

      <Alert className="mb-6">
        <Info />
        <AlertDescription>
          <b>Push</b> broadcasts are live via FCM — save a push campaign, then hit{" "}
          <b>Send now</b> in the history below to deliver it to every app user
          (even with the app closed). <b>WhatsApp</b> broadcasts are still{" "}
          <b>saved as drafts</b> only; sending those needs a WhatsApp Business
          API provider (AiSensy / Interakt / Twilio / Meta) connected.
        </AlertDescription>
      </Alert>

      {!enabled && (
        <Alert className="mb-6">
          <AlertDescription>
            The <code>broadcasts</code> table doesn&apos;t exist yet — apply the
            growth migration to enable saving.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg">
            <Megaphone className="size-5 text-primary" />
            New broadcast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(String(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="push">Push notification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign">Title (optional)</Label>
                <Input
                  id="campaign"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Campaign name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Message*</Label>
              <Textarea
                id="body"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="What do you want to tell users?"
                required
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={saving || !enabled}
              className="w-full"
            >
              {saving ? "Saving…" : "Save draft"}
            </Button>

            {msg && (
              <Alert>
                <AlertDescription>{msg}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">History</h2>
      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-muted-foreground">No broadcasts yet.</p>
        )}
        {items.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{b.title || "(untitled)"}</span>
                <Badge variant={b.status === "sent" ? "default" : "secondary"}>
                  {b.channel} · {b.status}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {b.message}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {new Date(b.created_at).toLocaleString()}
                </p>
                {b.channel === "push" && b.status !== "sent" && (
                  <Button
                    size="sm"
                    onClick={() => send(b.id)}
                    disabled={sendingId === b.id}
                  >
                    {sendingId === b.id ? "Sending…" : "Send now"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
