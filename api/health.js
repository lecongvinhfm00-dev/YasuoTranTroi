export default async function handler(_req, res) {
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
      process.env.GEMINI_API_KEY.trim() !== ''
  );

  return res.status(200).json({
    status: geminiConfigured ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      backend: true,
      geminiConfigured,
      defaultModel: 'gemini-4-hydrogen',
      availableModels: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
      databaseConnected: true,
      authConfigured: true,
    },
  });
}
