// Demir Defteri — yapay zekâ vekili (Supabase Edge Function, Deno)
// Kullanıcı tarayıcıdan JWT ile çağırır; sağlayıcı anahtarı (DeepSeek / OpenAI / Anthropic) sunucuda gizli kalır.
// Günlük kullanıcı limiti ai_usage tablosunda tutulur.
//
// Kurulum (bir kez, kendi bilgisayarında):
//   npm i -g supabase
//   supabase login
//   supabase link --project-ref <proje-ref>
//   supabase secrets set DEEPSEEK_API_KEY=sk-... OPENAI_API_KEY=sk-... AI_PROVIDER=deepseek AI_DAILY_LIMIT=40
//   supabase functions deploy ai
// Fonksiyon adresi: https://<proje-ref>.supabase.co/functions/v1/ai  → uygulamada APP.aiProxy ya da Ayarlar → Supabase → fonksiyon adresi
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const PROVIDERS: Record<string, { url: string; model: string; quick: string; vision: boolean; keyEnv: string }> = {
  deepseek: { url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat", quick: "deepseek-chat", vision: false, keyEnv: "DEEPSEEK_API_KEY" },
  openai: { url: "https://api.openai.com/v1/chat/completions", model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini", quick: Deno.env.get("OPENAI_MODEL_QUICK") || "gpt-4o-mini", vision: true, keyEnv: "OPENAI_API_KEY" },
  anthropic: { url: "https://api.anthropic.com/v1/messages", model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5", quick: Deno.env.get("ANTHROPIC_MODEL_QUICK") || "claude-haiku-5-5", vision: true, keyEnv: "ANTHROPIC_API_KEY" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST bekleniyor", code: "bad_request" }, 405);

  // 1) Kullanıcı kim? (tarayıcıdan gelen Supabase oturumu)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!, anonKey = Deno.env.get("SUPABASE_ANON_KEY")!, serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Giriş gerekli", code: "not_granted" }, 401);

  // 2) Günlük limit
  const admin = createClient(supabaseUrl, serviceKey);
  const day = new Date().toISOString().slice(0, 10);
  const limit = Number(Deno.env.get("AI_DAILY_LIMIT") || 40);
  const { data: usage } = await admin.from("ai_usage").select("calls, prompt_tokens, completion_tokens").eq("user_id", user.id).eq("day", day).maybeSingle();
  if (usage && usage.calls >= limit) return json({ error: `Günlük ${limit} istek sınırına ulaşıldı`, code: "rate_limited" }, 429);

  // 3) İstek
  let body: { prompt?: string; json?: boolean; tier?: string; images?: { type: string; data: string }[] };
  try { body = await req.json(); } catch { return json({ error: "Geçersiz gövde", code: "bad_request" }, 400); }
  const prompt = String(body.prompt || "").slice(0, 60000);
  if (!prompt) return json({ error: "prompt boş", code: "bad_request" }, 400);
  const images = Array.isArray(body.images) ? body.images.slice(0, 4) : [];
  const wantJson = !!body.json;

  // 4) Sağlayıcı: görsel varsa görsel okuyabilen; yoksa AI_PROVIDER (varsayılan deepseek)
  let name = (Deno.env.get("AI_PROVIDER") || "deepseek").toLowerCase();
  if (!PROVIDERS[name] || !Deno.env.get(PROVIDERS[name].keyEnv)) name = Object.keys(PROVIDERS).find((k) => Deno.env.get(PROVIDERS[k].keyEnv)) || name;
  if (images.length && !PROVIDERS[name].vision) {
    const alt = ["openai", "anthropic"].find((k) => Deno.env.get(PROVIDERS[k].keyEnv));
    if (!alt) return json({ error: "Fotoğraf için OpenAI veya Anthropic anahtarı tanımlı değil", code: "no_vision" }, 400);
    name = alt;
  }
  const P = PROVIDERS[name], key = Deno.env.get(P.keyEnv);
  if (!key) return json({ error: "Sunucuda sağlayıcı anahtarı yok", code: "not_granted" }, 500);
  const model = body.tier === "quick" ? P.quick : P.model;

  // 5) Sağlayıcıya ilet
  let text = "", truncated = false, pt = 0, ct = 0;
  try {
    let res: Response;
    if (name === "anthropic") {
      const content: unknown[] = images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.type, data: im.data } }));
      content.push({ type: "text", text: prompt });
      res = await fetch(P.url, { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: "user", content }] }) });
      const data = await res.json();
      if (!res.ok) return json({ error: data?.error?.message || `HTTP ${res.status}`, code: res.status === 429 ? "rate_limited" : "upstream_error" }, 502);
      text = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
      truncated = data.stop_reason === "max_tokens"; pt = data.usage?.input_tokens || 0; ct = data.usage?.output_tokens || 0;
    } else {
      const content: unknown = images.length ? [...images.map((im) => ({ type: "image_url", image_url: { url: `data:${im.type};base64,${im.data}` } })), { type: "text", text: prompt }] : prompt;
      const payload: Record<string, unknown> = { model, max_tokens: 3000, temperature: 0.4, messages: [{ role: "system", content: "Türkçe yanıt ver. İstenirse yalnızca geçerli JSON döndür." }, { role: "user", content }] };
      if (wantJson && !images.length) payload.response_format = { type: "json_object" };
      res = await fetch(P.url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) return json({ error: data?.error?.message || `HTTP ${res.status}`, code: res.status === 429 ? "rate_limited" : res.status === 402 ? "no_credit" : "upstream_error" }, 502);
      const ch = data.choices?.[0];
      text = ch?.message?.content || ""; truncated = ch?.finish_reason === "length"; pt = data.usage?.prompt_tokens || 0; ct = data.usage?.completion_tokens || 0;
    }
  } catch (e) { return json({ error: String(e), code: "upstream_error" }, 502); }

  // 6) Kullanımı yaz
  await admin.from("ai_usage").upsert({ user_id: user.id, day, calls: (usage?.calls || 0) + 1, prompt_tokens: (usage?.prompt_tokens || 0) + pt, completion_tokens: (usage?.completion_tokens || 0) + ct, provider: name }, { onConflict: "user_id,day" });
  return json({ text, truncated, provider: name, model });
});
