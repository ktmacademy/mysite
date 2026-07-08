import { NextResponse } from "next/server";
import { requireAdmin, tableMissing } from "@/lib/server/admin";
import { sendPush } from "@/lib/server/push";

const CHANNELS = new Set(["whatsapp", "push"]);

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = check.supabase;
  const body = await request.json().catch(() => ({}));
  const action = body.action || "list";

  if (action === "create") {
    const { channel, title, message, segment, recipients } = body;
    if (!CHANNELS.has(channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    // Recorded only — actual delivery needs a WhatsApp Business API / push provider.
    const { data, error } = await supabase
      .from("broadcasts")
      .insert({
        channel,
        title: (title || "").trim() || null,
        message: message.trim(),
        segment: segment || {},
        recipients: Number(recipients) || 0,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) {
      if (tableMissing(error)) return NextResponse.json({ enabled: false }, { status: 200 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data.id });
  }

  // ---- send: deliver a saved push broadcast to every subscribed device ----
  if (action === "send") {
    const { id } = body;
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Missing broadcast id" }, { status: 400 });
    }
    const { data: b, error: loadErr } = await supabase
      .from("broadcasts")
      .select("id, channel, title, message, status")
      .eq("id", id)
      .single();
    if (loadErr) {
      if (tableMissing(loadErr)) return NextResponse.json({ enabled: false }, { status: 200 });
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    if (b.channel !== "push") {
      return NextResponse.json(
        { error: "Only push broadcasts can be sent from here (WhatsApp needs a provider)." },
        { status: 400 }
      );
    }
    if (b.status === "sent") {
      return NextResponse.json({ error: "This broadcast was already sent." }, { status: 400 });
    }

    const push = await sendPush({
      broadcast: true,
      title: (b.title || "CTEVT Plus").trim(),
      body: b.message,
      data: { type: "broadcast" },
    });
    if (!push.ok) {
      return NextResponse.json({ error: `Push failed: ${push.error}` }, { status: 502 });
    }

    // Approximate reach = number of registered device tokens.
    const { count } = await supabase
      .from("device_tokens")
      .select("token", { count: "exact", head: true });
    await supabase
      .from("broadcasts")
      .update({ status: "sent", sent_at: new Date().toISOString(), recipients: count || 0 })
      .eq("id", id);

    return NextResponse.json({ ok: true, recipients: count || 0 });
  }

  // list
  const { data, error } = await supabase
    .from("broadcasts")
    .select("id, channel, title, message, segment, recipients, status, created_at, sent_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (tableMissing(error)) return NextResponse.json({ enabled: false, items: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ enabled: true, items: data || [] });
}
