import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getVectorStoreId } from '@/lib/vectorStore'

// Initialize OpenAI client
const getOpenAIClient = () => {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is missing!')
    }

    return new OpenAI({
        apiKey: apiKey,
    })
}

export async function POST(request: NextRequest) {
    try {
        const { message } = await request.json()

        const vectorStoreId = getVectorStoreId()
        if (!vectorStoreId) {
            console.log('No vector store ID found. This might be due to serverless environment limitations.')
            return NextResponse.json(
                { error: 'System not initialized. Please wait a moment and refresh the page, then try again.' },
                { status: 400 }
            )
        }

        console.log('Processing chat request:', message)

        const client = getOpenAIClient()

        // Check if vector store is ready
        try {
            const vectorStore = await client.vectorStores.retrieve(vectorStoreId)
            console.log('Vector store status:', vectorStore.status)
            console.log('File counts:', vectorStore.file_counts)

            if (vectorStore.status === 'in_progress') {
                return NextResponse.json(
                    { error: 'Knowledge base is still being processed. Please wait a moment and try again.' },
                    { status: 400 }
                )
            }

            if (vectorStore.file_counts.completed === 0) {
                return NextResponse.json(
                    { error: 'Knowledge base is not ready yet. Please try again in a moment.' },
                    { status: 400 }
                )
            }
        } catch (error) {
            console.error('Error checking vector store status:', error)
            return NextResponse.json(
                { error: 'Unable to verify knowledge base status. Please try again.' },
                { status: 500 }
            )
        }

        // Use the Responses API with file search
        const response = await client.responses.create({
            model: 'gpt-4o-mini',
            input: `You are a helpful company assistant. Answer the user's question based ONLY on the company information provided in the attached documents. Be professional, helpful, and accurate. 

IMPORTANT INSTRUCTIONS:
- Only use information from the provided company documents
- If the information is not available in the documents, say "I don't have that information in our company records"
- Don't mention that you're using documents or knowledge base
- Provide specific details from the documents when available
- Be conversational and helpful as a company representative

User's question: ${message}`,
            tools: [{
                type: 'file_search',
                vector_store_ids: [vectorStoreId]
            }]
        })

        console.log('Response received')
        console.log('Full response:', JSON.stringify(response, null, 2))

        // Extract the message content from the response
        let reply = 'Sorry, I couldn\'t process your request.'

        if (response.output && response.output.length > 0) {
            // Find the message output item
            const messageOutput = response.output.find(item => item.type === 'message')
            if (messageOutput && messageOutput.content && messageOutput.content.length > 0) {
                const textContent = messageOutput.content.find(content => content.type === 'output_text')
                if (textContent) {
                    reply = textContent.text
                    console.log('Extracted reply:', reply)
                }
            }

            // Also check for file search results
            const fileSearchOutput = response.output.find(item => item.type === 'file_search_call')
            if (fileSearchOutput) {
                console.log('File search results:', JSON.stringify(fileSearchOutput, null, 2))
            }
        }

        return NextResponse.json({ reply })
    } catch (error) {
        console.error('Chat error:', error)
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        )
    }
}
