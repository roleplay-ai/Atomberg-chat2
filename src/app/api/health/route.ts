import { NextResponse } from 'next/server'
import { getVectorStoreId } from '@/lib/vectorStore'

export async function GET() {
    try {
        const vectorStoreId = getVectorStoreId()
        return NextResponse.json({
            status: 'OK',
            vectorStoreId
        })
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        )
    }
}
