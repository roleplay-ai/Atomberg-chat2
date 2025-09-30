import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getVectorStoreId, setVectorStoreId } from '@/lib/vectorStore'

const getOpenAIClient = () => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is missing!')
    }
    return new OpenAI({ apiKey })
}

export async function GET() {
    try {
        let vectorStoreId = getVectorStoreId()
        const client = getOpenAIClient()

        if (!vectorStoreId) {
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
            return NextResponse.json({ ready: false, status: 'not_initialized' }, { status: 200 })
        }

        const vectorStore = await client.vectorStores.retrieve(vectorStoreId)

        const inProgress = vectorStore.status === 'in_progress'
        const hasFiles = (vectorStore.file_counts?.completed ?? 0) > 0
        const ready = !inProgress && hasFiles

        return NextResponse.json({
            ready,
            status: vectorStore.status,
            fileCounts: vectorStore.file_counts,
            vectorStoreId,
        })
    } catch (error) {
        return NextResponse.json({ ready: false, status: 'error', error: (error as Error).message }, { status: 200 })
    }
}


