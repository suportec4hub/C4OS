import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.19";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const B2_KEY_ID   = Deno.env.get("B2_KEY_ID")!;
const B2_APP_KEY  = Deno.env.get("B2_APP_KEY")!;
const B2_BUCKET   = Deno.env.get("B2_BUCKET")   || "C4OS-Bucket";
const B2_REGION   = Deno.env.get("B2_REGION")   || "us-west-004";
const B2_ENDPOINT = Deno.env.get("B2_ENDPOINT") || `https://s3.${B2_REGION}.backblazeb2.com`;

const awsClient = new AwsClient({
  accessKeyId: B2_KEY_ID,
  secretAccessKey: B2_APP_KEY,
  region: B2_REGION,
  service: "s3",
});

async function uploadToB2(key: string, body: Uint8Array, contentType: string): Promise<string> {
  const url = `${B2_ENDPOINT}/${B2_BUCKET}/${key}`;
  const res = await awsClient.fetch(url, {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`B2 upload ${res.status}: ${err.slice(0, 300)}`);
  }
  return url;
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

    const publicUrl = await uploadToB2(key, bytes, contentType);

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
