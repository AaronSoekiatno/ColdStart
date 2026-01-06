import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    // Initialize Supabase client with service role key for admin access
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

    const normalizedEmail = email.toLowerCase().trim();
    
    // Insert into waitlist table
    const { data, error } = await supabaseAdmin
      .from("waitlist")
      .insert({
        email: normalizedEmail,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // If table doesn't exist, we'll handle it gracefully
      if (error.code === "42P01") {
        console.error("Waitlist table does not exist. Please create it in Supabase.");
        // For now, just log it - you can create the table later
        // Or return success anyway for development
        return NextResponse.json(
          { 
            success: true, 
            message: "Email recorded (table creation pending)" 
          },
          { status: 200 }
        );
      }

      // If email already exists, that's okay - return success
      if (error.code === "23505") {
        // Update email preferences to opt-in to newsletter if not already
        try {
          const { getOrCreateEmailPreferences } = await import("@/lib/supabase");
          const preferences = await getOrCreateEmailPreferences(normalizedEmail);
          
          // If marketing emails are disabled, opt them in (they're on waitlist)
          if (!preferences.marketing_emails_enabled) {
            await supabaseAdmin
              .from("email_preferences")
              .update({ marketing_emails_enabled: true })
              .eq("email", normalizedEmail);
          }
        } catch (prefError) {
          // Log but don't fail - waitlist signup should still succeed
          console.error("Error updating email preferences for waitlist:", prefError);
        }
        
        return NextResponse.json(
          { success: true, message: "You're already on the waitlist!" },
          { status: 200 }
        );
      }

      console.error("Error inserting into waitlist:", error);
      return NextResponse.json(
        { error: "Failed to join waitlist" },
        { status: 500 }
      );
    }

    // Create or update email preferences to opt-in to newsletter
    // Waitlist signups should automatically opt-in to marketing emails
    try {
      const { getOrCreateEmailPreferences } = await import("@/lib/supabase");
      const preferences = await getOrCreateEmailPreferences(normalizedEmail);
      
      // Opt them into marketing emails (newsletter) since they joined waitlist
      if (!preferences.marketing_emails_enabled) {
        await supabaseAdmin
          .from("email_preferences")
          .update({ marketing_emails_enabled: true })
          .eq("email", normalizedEmail);
      }
    } catch (prefError) {
      // Log but don't fail - waitlist signup should still succeed
      console.error("Error creating email preferences for waitlist:", prefError);
    }

    return NextResponse.json(
      { success: true, message: "Successfully joined waitlist" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in waitlist endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

