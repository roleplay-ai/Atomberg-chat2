import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { setVectorStoreId, getVectorStoreId } from '@/lib/vectorStore'

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

export async function GET(request: NextRequest) {
    try {
        console.log('Initializing system and uploading knowledge base...')

        const client = getOpenAIClient()

        // Path to the knowledge base file
        const filePath = path.join(process.cwd(), 'public', 'Retailer_Roleplay_Knowledge_Base_Atomberg.pdf')

        if (!fs.existsSync(filePath)) {
            return NextResponse.json(
                { error: 'Knowledge Base.pdf file not found in the public directory' },
                { status: 400 }
            )
        }

        console.log('Creating file from:', filePath)

        // Create the file first
        const file = await client.files.create({
            file: fs.createReadStream(filePath),
            purpose: 'assistants',
        })

        console.log('File created with ID:', file.id)

        // Create vector store with the file directly
        console.log('Creating vector store with file...')
        const vectorStore = await client.vectorStores.create({
            name: 'Company Knowledge Base',
            file_ids: [file.id]
        })

        console.log('Vector store created:', JSON.stringify(vectorStore, null, 2))
        console.log('Vector store ID:', vectorStore.id)

        // Store the vector store ID
        setVectorStoreId(vectorStore.id)
        console.log('Knowledge base uploaded and system initialized successfully')
        console.log('Vector store status:', vectorStore.status)
        console.log('File counts:', vectorStore.file_counts)
        console.log('Vector store ID stored:', vectorStore.id)

        // Verify the ID was stored correctly
        const storedId = getVectorStoreId()
        console.log('Verification - stored vector store ID:', storedId)

        return NextResponse.json({
            message: 'System initialized and knowledge base uploaded',
            fileId: file.id,
            vectorStoreId: vectorStore.id,
            status: vectorStore.status,
            fileCounts: vectorStore.file_counts,
            storedSuccessfully: storedId === vectorStore.id
        })
    } catch (error) {
        console.error('Init error:', error)
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        )
    }
}
