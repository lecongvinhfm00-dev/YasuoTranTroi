export default async function handler(_req, res) {
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
      process.env.GEMINI_API_KEY.trim() !== ''
  );
  const supabaseConfigured = Boolean(
    process.env.VITE_SUPABASE_URL &&
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY &&
      !process.env.VITE_SUPABASE_URL.includes('your_supabase')
  );

  return res.status(200).json({
    ok: true,
    backendReady: true,
    geminiConfigured,
    supabaseConfigured,
    anonymousAuthEnabled: true,
    timestamp: new Date().toISOString(),
  });
}
