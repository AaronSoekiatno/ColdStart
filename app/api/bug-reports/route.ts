import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, page_url, user_agent, browser_info } = body;

    // Validate required fields
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Bug description is required" },
        { status: 400 }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Create client with user's auth token to verify user
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    // Insert bug report
    const { data, error } = await supabaseAdmin
      .from("bug_reports")
      .insert({
        user_id: user.id,
        user_email: user.email,
        description: description.trim(),
        page_url: page_url || null,
        user_agent: user_agent || null,
        browser_info: browser_info || null,
        status: "new",
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting bug report:", error);
      return NextResponse.json(
        { error: "Failed to submit bug report" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Bug report submitted successfully", id: data.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in bug-reports endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
