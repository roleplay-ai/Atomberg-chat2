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

export async function GET(request: NextRequest) {
    try {
        console.log('Initializing system and uploading knowledge base...')

        const client = getOpenAIClient()

        // If already initialized, verify readiness and return
        const existingId = getVectorStoreId()
        if (existingId) {
            try {
                const existingStore = await client.vectorStores.retrieve(existingId)
                const ready = existingStore.status !== 'in_progress' && (existingStore.file_counts?.completed ?? 0) > 0
                if (ready) {
                    return NextResponse.json({
                        message: 'System already initialized',
                        ready: true,
                        vectorStoreId: existingId,
                        status: existingStore.status,
                        fileCounts: existingStore.file_counts,
                    })
                }
            } catch (e) {
                console.warn('Stored vector store not retrievable, will re-initialize.')
            }
        }

        // Get all PDF files from knowledge base
        const filePaths = getKnowledgeBaseFiles()

        if (filePaths.length === 0) {
            return NextResponse.json(
                { error: 'No knowledge base PDF files found. Please ensure PDF files are in the public/knowledge-base directory or public root.' },
                { status: 400 }
            )
        }

        console.log(`Found ${filePaths.length} knowledge base files:`)
        filePaths.forEach(filePath => {
            console.log(`  - ${path.basename(filePath)}`)
        })

        // Create files for all PDFs
        const fileIds: string[] = []
        const fileDetails: Array<{ id: string, name: string }> = []

        for (const filePath of filePaths) {
            console.log('Creating file from:', path.basename(filePath))

            const file = await client.files.create({
                file: fs.createReadStream(filePath),
                purpose: 'assistants',
            })

            console.log(`File created with ID: ${file.id} (${path.basename(filePath)})`)
            fileIds.push(file.id)
            fileDetails.push({
                id: file.id,
                name: path.basename(filePath)
            })
        }

        // Create vector store with all files
        console.log(`Creating vector store with ${fileIds.length} files...`)
        const vectorStore = await client.vectorStores.create({
            name: 'Company Knowledge Base (Multi-File)',
            file_ids: fileIds
        })

        console.log('Vector store created:', vectorStore.id)

        // Store the vector store ID
        setVectorStoreId(vectorStore.id)

        // Wait until processing completes
        const maxAttempts = 120
        const intervalMs = 2000
        let ready = false
        let latestStore = vectorStore
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            latestStore = await client.vectorStores.retrieve(vectorStore.id)
            const inProgress = latestStore.status === 'in_progress'
            const hasFiles = (latestStore.file_counts?.completed ?? 0) > 0
            ready = !inProgress && hasFiles
            console.log(`Vector store poll ${attempt + 1}/${maxAttempts}: status=${latestStore.status}, completed=${latestStore.file_counts?.completed}`)
            if (ready) break
            await new Promise(r => setTimeout(r, intervalMs))
        }

        return NextResponse.json({
            message: 'System initialized and knowledge base uploaded',
            ready,
            fileCount: filePaths.length,
            files: fileDetails,
            vectorStoreId: vectorStore.id,
            status: latestStore.status,
            fileCounts: latestStore.file_counts,
            storedSuccessfully: getVectorStoreId() === vectorStore.id
        })
    } catch (error) {
        console.error('Init error:', error)
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        )
    }
}