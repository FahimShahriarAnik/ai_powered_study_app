import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";

export async function PUT(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { materialId, content } = (await request.json()) as {
    materialId: string;
    content: string;
  };

  if (!materialId) {
    return NextResponse.json({ error: "materialId is required" }, { status: 400 });
  }

  const { error } = await supabase.from("material_notes").upsert(
    {
      user_id: user.id,
      material_id: materialId,
      content: content ?? "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,material_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
