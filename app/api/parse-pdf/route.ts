import { PDFParse } from "pdf-parse";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const courseId = formData.get("courseId") as string | null;
  const title = formData.get("title") as string | null;

  if (!file || !courseId || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify course belongs to user
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Check material limit
  const { count } = await supabase
    .from("materials")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  if ((count ?? 0) >= MAX_MATERIALS_PER_COURSE) {
    return NextResponse.json(
      { error: `Courses are limited to ${MAX_MATERIALS_PER_COURSE} materials.` },
      { status: 400 }
    );
  }

  // File size check
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "PDF must be under 10 MB." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse PDF using pdf-parse v2 class API
  let rawText: string;
  let numPages: number;
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    rawText = result.text.trim();
    numPages = result.total;
  } catch {
    return NextResponse.json(
      { error: "Could not read PDF. Make sure it's a valid PDF file." },
      { status: 400 }
    );
  }

  if (numPages > MAX_PAGES) {
    return NextResponse.json(
      { error: `PDF must be ${MAX_PAGES} pages or fewer (yours has ${numPages}).` },
      { status: 400 }
    );
  }

  if (!rawText) {
    return NextResponse.json(
      { error: "No text could be extracted. The PDF may be scanned/image-based." },
      { status: 400 }
    );
  }

  // Upload to Supabase Storage
  const filePath = `${user.id}/${courseId}/${Date.now()}-${file.name}`;
  const { error: storageError } = await supabase.storage
    .from("materials")
    .upload(filePath, buffer, { contentType: "application/pdf" });

  if (storageError) {
    return NextResponse.json(
      { error: "Failed to upload file. " + storageError.message },
      { status: 500 }
    );
  }

  const { data: { publicUrl } } = supabase.storage
    .from("materials")
    .getPublicUrl(filePath);

  // Save material record
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
