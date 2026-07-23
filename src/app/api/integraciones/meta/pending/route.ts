// GET /api/integraciones/meta/pending
// Despues del OAuth callback, la cookie 'neura_meta_pending' tiene una lista
// cifrada de pages con IG. El frontend llama aca para renderizar el selector.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requirePropietarioContext, sanitizeError } from "@/lib/meta/propietario";
import { decryptMetaSecret } from "@/lib/meta/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENDING_COOKIE = "neura_meta_pending";

type PendingSelection = {
  pid: string;
  eat: string;
  tex: number | null;
  scopes: string[];
  pages: Array<{
    id: string;
    name: string;
    eat_page: string;
    instagram_business_account_id: string | null;
    instagram_username: string | null;
  }>;
};

export async function GET(request: Request) {
  try {
    const ctx = await requirePropietarioContext(request);
    if (ctx instanceof NextResponse) return ctx;

    const jar = await cookies();
    const encoded = jar.get(PENDING_COOKIE)?.value ?? null;
    if (!encoded) return NextResponse.json({ success: true, pending: null });

    let pending: PendingSelection;
    try {
      pending = JSON.parse(decryptMetaSecret(encoded)) as PendingSelection;
    } catch {
      return NextResponse.json({ success: true, pending: null });
    }

    if (pending.pid !== ctx.propietarioId) {
      return NextResponse.json({ success: true, pending: null });
    }

    const safePages = pending.pages.map((p) => ({
      id: p.id,
      name: p.name,
      has_instagram: !!p.instagram_business_account_id,
      instagram_username: p.instagram_username,
    }));

    return NextResponse.json({
      success: true,
      pending: {
        pages: safePages,
        scopes: pending.scopes,
        token_expires_at: pending.tex,
      },
    });
  } catch (err) {
    console.error("[api/integraciones/meta/pending]", sanitizeError(err));
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
