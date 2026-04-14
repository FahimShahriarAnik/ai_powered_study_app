import { PDFParse } from "pdf-parse";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";

export const maxDuration = 60;

const MAX_PAGES = 50;
const MAX_MATERIALS_PER_COURSE = 10;

export async function POST(request: NextRequest) {
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

  let body: { storageFilePath?: string; courseId?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { storageFilePath, courseId, title } = body;

  if (!storageFilePath || !courseId || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the storage path belongs to this user (path starts with user.id/)
  if (!storageFilePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Parallel: verify course ownership + check material count
  const [courseResult, countResult] = await Promise.all([
    supabase.from("courses").select("id").eq("id", courseId).eq("user_id", user.id).single(),
    supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId),
  ]);

  if (!courseResult.data) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if ((countResult.count ?? 0) >= MAX_MATERIALS_PER_COURSE) {
    return NextResponse.json(
      { error: `Courses are limited to ${MAX_MATERIALS_PER_COURSE} materials.` },
      { status: 400 }
    );
  }

  // Download from Supabase Storage (client already uploaded it directly)
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("materials")
    .download(storageFilePath);

  if (downloadError || !fileBlob) {
    return NextResponse.json(
      { error: "Could not retrieve uploaded file." },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());

  // Parse PDF
  let rawText: string;
  let numPages: number;
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    rawText = result.text.trim();
    numPages = result.total;
  } catch {
    // Clean up orphaned storage file
    await supabase.storage.from("materials").remove([storageFilePath]);
    return NextResponse.json(
      { error: "Could not read PDF. Make sure it's a valid PDF file." },
      { status: 400 }
    );
  }

  if (numPages > MAX_PAGES) {
    await supabase.storage.from("materials").remove([storageFilePath]);
    return NextResponse.json(
      { error: `PDF must be ${MAX_PAGES} pages or fewer (yours has ${numPages}).` },
      { status: 400 }
    );
  }

  if (!rawText) {
    await supabase.storage.from("materials").remove([storageFilePath]);
    return NextResponse.json(
      { error: "No text could be extracted. The PDF may be scanned/image-based." },
      { status: 400 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("materials").getPublicUrl(storageFilePath);

  const { data: material, error: dbError } = await supabase
    .from("materials")
    .insert({
      course_id: courseId,
      title: title.trim(),
      raw_text: rawText,
      file_url: publicUrl,
      char_count: rawText.length,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ material });
}
