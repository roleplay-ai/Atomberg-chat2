# Production Deployment Setup

## Environment Variables

For production deployment, you need to set the following environment variables:

### Required Variables:
1. `OPENAI_API_KEY` - Your OpenAI API key
2. `VECTOR_STORE_ID` - The vector store ID (optional, will be auto-generated)

### How to Set Environment Variables:

#### For Vercel:
1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Add:
   - `OPENAI_API_KEY` = your_openai_api_key
   - `VECTOR_STORE_ID` = (leave empty, will be auto-generated)

#### For Netlify:
1. Go to your Netlify dashboard
2. Select your site
3. Go to Site settings > Environment variables
4. Add the variables above

#### For other platforms:
Set the environment variables according to your platform's documentation.

## Troubleshooting

If you get "System not properly initialized" error:

1. Make sure `OPENAI_API_KEY` is set correctly
2. Wait a few moments after deployment for the system to initialize
3. Refresh the page and try again
4. Check the server logs for any initialization errors

## File Requirements

Make sure `Knowledge Base.pdf` is in the `public/` directory of your deployment.
