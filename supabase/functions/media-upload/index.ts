import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cloudflare R2 — S3-compatible, região sempre "auto"
const R2_KEY_ID     = Deno.env.get("R2_KEY_ID")!;
const R2_APP_KEY    = Deno.env.get("R2_APP_KEY")!;
const R2_BUCKET     = Deno.env.get("R2_BUCKET")     || "c4os";
const R2_ENDPOINT   = Deno.env.get("R2_ENDPOINT")   || "https://1f59288cdc89e59b8a1027c6bc33205f.r2.cloudflarestorage.com";
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL") || "https://pub-702abeb54c2b46a6888cc69b17b364a7.r2.dev";

const awsClient = new AwsClient({
  accessKeyId: R2_KEY_ID,
  secretAccessKey: R2_APP_KEY,
  region: "auto",
  service: "s3",
});

async function uploadToR2(key: string, body: Uint8Array, contentType: string): Promise<string> {
  const uploadUrl = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
  const res = await awsClient.fetch(uploadUrl, {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`R2 upload ${res.status}: ${err.slice(0, 300)}`);
  }
  // Retorna URL pública (diferente da URL S3 de upload)
  return `${R2_PUBLIC_URL}/${key}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") || "";
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace(/^Bearer\s+/i, ""),
    );
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const form       = await req.formData();
    const file       = form.get("file") as File | null;
    const empresaId  = form.get("empresa_id") as string | null;
    const pathPrefix = (form.get("path_prefix") as string | null) || "chat";

    if (!file || !empresaId) {
      return json({ error: "file e empresa_id são obrigatórios" }, 400);
    }

    const bytes       = new Uint8Array(await file.arrayBuffer());
    const ext         = (file.name.split(".").pop() || "bin").toLowerCase();
    const key         = `${pathPrefix}/${empresaId}/${Date.now()}.${ext}`;
    const contentType = file.type || "application/octet-stream";

    const publicUrl = await uploadToR2(key, bytes, contentType);

    const tipo = contentType.startsWith("image/") ? "imagem"
               : contentType.startsWith("audio/") ? "audio"
               : contentType.startsWith("video/") ? "video"
               : "documento";

    return json({ publicUrl, tipo, nome_arquivo: file.name });
  } catch (e) {
    console.error("[media-upload] erro:", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
