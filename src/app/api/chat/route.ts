import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { getVectorStoreId, setVectorStoreId } from '@/lib/vectorStore'

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

// Helper function to get all PDF files from knowledge base
const getKnowledgeBaseFiles = (): string[] => {
    const filePaths: string[] = []

    // Check if knowledge-base directory exists
    const knowledgeBaseDir = path.join(process.cwd(), 'public', 'knowledge-base')

    if (fs.existsSync(knowledgeBaseDir)) {
        console.log('Using knowledge-base directory:', knowledgeBaseDir)
        const files = fs.readdirSync(knowledgeBaseDir)
        filePaths.push(...files
            .filter(file => file.toLowerCase().endsWith('.pdf'))
            .map(file => path.join(knowledgeBaseDir, file))
        )
    } else {
        // Fallback to individual files in public directory
        console.log('knowledge-base directory not found, checking public directory...')
        const publicFiles = [
            'Retailer_Roleplay_Knowledge_Base_Atomberg.pdf',
            'Knowledge Base.pdf'
        ]

        filePaths.push(...publicFiles
            .map(file => path.join(process.cwd(), 'public', file))
            .filter(filePath => fs.existsSync(filePath))
        )
    }

    return filePaths
}

export async function POST(request: NextRequest) {
    try {
        const { message } = await request.json()

        console.log('Processing chat request:', message)

        const client = getOpenAIClient()
        let vectorStoreId = getVectorStoreId()
        if (!vectorStoreId) {
            // Attempt to discover an existing vector store by name in production
            try {
                const list = await client.vectorStores.list({ limit: 50 })
                const found = list.data.find(vs => vs.name === 'Company Knowledge Base (Multi-File)' && (vs.file_counts?.completed ?? 0) > 0)
                if (found) {
                    vectorStoreId = found.id
                    setVectorStoreId(vectorStoreId)
                    console.log('Discovered existing vector store and cached ID:', vectorStoreId)
                }
            } catch (e) {
                console.warn('Unable to list vector stores for discovery:', e)
            }
        }
        if (!vectorStoreId) {
            return NextResponse.json(
                { error: 'Knowledge base not initialized. Please initialize before chatting.' },
                { status: 400 }
            )
        }

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
            input: `You are a helpful company assistant with access to multiple company documents. Answer the user's question based ONLY on the company information provided in the attached documents. Be professional, helpful, and accurate. 

IMPORTANT INSTRUCTIONS:
-- Only use information from the provided company documents
- If the information is not available in the documents, say "I don't have that information in our company records"
- Don't mention that you're using documents or knowledge base
- Provide specific details from the documents when available
- Be conversational and helpful as a company representative
- You have access to multiple documents, so cross-reference information when needed
- DO NOT create generic headings, bullet points, or formatting structures
- DO NOT add "Target vs. Achievement", "MTD Trends", "Productivity Metrics" or similar generic headings
- Provide direct, specific answers without unnecessary formatting
- Focus on the actual data and information, not presentation structure

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