const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🔑 OpenAI API Key Setup');
console.log('========================');
console.log('');
console.log('You need to add your OpenAI API key to use the application.');
console.log('');
console.log('To get your API key:');
console.log('1. Go to: https://platform.openai.com/account/api-keys');
console.log('2. Sign in to your OpenAI account');
console.log('3. Click "Create new secret key"');
console.log('4. Copy the key (it starts with "sk-")');
console.log('');

rl.question('Enter your OpenAI API key: ', (apiKey) => {
    if (!apiKey || !apiKey.startsWith('sk-')) {
        console.log('❌ Invalid API key. It should start with "sk-"');
        rl.close();
        return;
    }

    const envContent = `# OpenAI API Key
OPENAI_API_KEY=${apiKey}
`;

    fs.writeFileSync('.env.local', envContent);

    console.log('✅ API key saved successfully!');
    console.log('');
    console.log('🚀 You can now start the application:');
    console.log('   npm run dev');
    console.log('');
    console.log('📝 Note: The .env.local file is automatically ignored by git for security.');

    rl.close();
});
