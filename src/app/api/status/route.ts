import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getVectorStoreId } from '@/lib/vectorStore'

const getOpenAIClient = () => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is missing!')
    }
    return new OpenAI({ apiKey })
}

export async function GET() {
    try {
        const vectorStoreId = getVectorStoreId()
        if (!vectorStoreId) {
            return NextResponse.json({ ready: false, status: 'not_initialized' }, { status: 200 })
        }

        const client = getOpenAIClient()
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


