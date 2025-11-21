// server/list-models.js
// Quick script to list all Gemini models available to your API key
require('dotenv').config();

const API_KEY = process.env.GEMINI_KEY;

if (!API_KEY) {
  console.error('❌ GEMINI_KEY not found in .env file');
  process.exit(1);
}

async function listModels() {
  // Try both v1 and v1beta endpoints
  const endpoints = [
    { version: 'v1', url: `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}` },
    { version: 'v1beta', url: `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}` },
  ];

  for (const { version, url } of endpoints) {
    try {
      console.log(`\n🔍 Checking ${version} endpoint...`);
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.error(`❌ ${version} error:`, data.error?.message || response.statusText);
        continue;
      }

      const models = data.models || [];
      if (models.length === 0) {
        console.log(`   No models found in ${version}`);
        continue;
      }

      console.log(`\n✅ Found ${models.length} model(s) in ${version}:`);
      console.log('─'.repeat(60));

      models.forEach((model) => {
        const name = model.name || 'unknown';
        const displayName = model.displayName || 'N/A';
        const supportedMethods = model.supportedGenerationMethods || [];
        const supportsGenerate = supportedMethods.includes('generateContent');

        console.log(`\n📦 Model: ${name}`);
        console.log(`   Display: ${displayName}`);
        console.log(`   Supports generateContent: ${supportsGenerate ? '✅' : '❌'}`);
        if (supportedMethods.length > 0) {
          console.log(`   Methods: ${supportedMethods.join(', ')}`);
        }
      });
    } catch (err) {
      console.error(`❌ Failed to fetch ${version}:`, err.message);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('\n💡 Tip: Set GEMINI_MODEL in your .env to one of the models above');
  console.log('   Example: GEMINI_MODEL=gemini-2.5-pro');
}

listModels().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});


