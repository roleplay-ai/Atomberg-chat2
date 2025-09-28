const fs = require('fs');
const path = require('path');

// Create .env.local file with template
const envContent = `# Copy your OpenAI API key here
OPENAI_API_KEY=your_openai_api_key_here
`;

const envPath = path.join(__dirname, '.env.local');

if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env.local file');
    console.log('📝 Please edit .env.local and add your OpenAI API key');
} else {
    console.log('⚠️  .env.local already exists');
}

console.log('\n🚀 To start the application:');
console.log('1. Add your OpenAI API key to .env.local');
console.log('2. Run: npm run dev');
console.log('3. Open: http://localhost:3000');

