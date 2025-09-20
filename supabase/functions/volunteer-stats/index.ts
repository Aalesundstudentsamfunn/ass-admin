import { createClient } from "npm:@supabase/supabase-js@2.36.0";
console.info("Volunteer stats function starting");
Deno.serve(async (req)=>{
  try {
    const url = new URL(req.url);
    // Expect Authorization: Bearer <access_token>
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({
        error: "Missing Authorization header"
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const accessToken = authHeader.split(" ")[1];
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({
        error: "Server misconfiguration: missing SUPABASE_URL or SUPABASE_ANON_KEY"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false
      }
    });
    // Validate token and get user
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({
        error: "Invalid or expired token"
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const user = userData.user;
    // Check profile voluntary flag
    const { data: profileRows, error: profileError } = await supabase.from("profiles").select("voluntary").eq("user_id", user.id).limit(1);
    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return new Response(JSON.stringify({
        error: "Error fetching profile"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const profile = profileRows && profileRows.length ? profileRows[0] : null;
    if (!profile || profile.voluntary !== true) {
      return new Response(JSON.stringify({
        error: "User is not a voluntary member"
      }), {
        status: 403,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Helper to get counts using head:true to only fetch count
    async function getCount(table, filter) {
      let query = supabase.from(table).select("id", {
        count: "exact",
        head: true
      });
      if (filter) query = query.eq(filter.column, filter.value);
      const { count, error } = await query;
      if (error) throw error;
      return Number(count ?? 0);
    }
    // Get counts
    const [assMembersCount, profilesCount, voluntaryProfilesCount, itemsCount] = await Promise.all([
      getCount("ass_members"),
      getCount("profiles"),
      getCount("profiles", {
        column: "voluntary",
        value: true
      }),
      getCount("items")
    ]);
    // Format response entries similar to the example
    const response = [
      {
        title: "Total Members",
        value: String(assMembersCount),
        description: "Active volunteer members",
        icon: "Users",
        trend: "+12%"
      },
      {
        title: "Total Profiles",
        value: String(profilesCount),
        description: "All user profiles",
        icon: "UserCircle",
        trend: "+3%"
      },
      {
        title: "Voluntary Profiles",
        value: String(voluntaryProfilesCount),
        description: "Profiles with voluntary = true",
        icon: "HandHeart",
        trend: "+8%"
      },
      {
        title: "Total Items",
        value: String(itemsCount),
        description: "All items",
        icon: "Box",
        trend: "-1%"
      }
    ];
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({
      error: "Internal server error"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
