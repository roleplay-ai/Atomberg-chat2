import fs from 'fs'
import path from 'path'

// In-memory storage for serverless environments
// This will persist for the duration of the serverless function execution
let vectorStoreIdMemory: string | null = null

// Global variable that persists across requests in some serverless environments
declare global {
    var __vectorStoreId: string | undefined
}

// Try to get from environment variable first (for production)
export function getVectorStoreId(): string | null {
    // First, check environment variable (for production deployment)
    if (process.env.VECTOR_STORE_ID) {
        console.log('Using vector store ID from environment:', process.env.VECTOR_STORE_ID)
        return process.env.VECTOR_STORE_ID
    }

    // Then check global variable (for serverless persistence)
    if (global.__vectorStoreId) {
        console.log('Using vector store ID from global:', global.__vectorStoreId)
        return global.__vectorStoreId
    }

    // Then check in-memory storage
    if (vectorStoreIdMemory) {
        console.log('Using vector store ID from memory:', vectorStoreIdMemory)
        return vectorStoreIdMemory
    }

    // Finally, try file-based storage (for development)
    try {
        const VECTOR_STORE_FILE = path.join(process.cwd(), '.vector-store-id')
        if (fs.existsSync(VECTOR_STORE_FILE)) {
            const id = fs.readFileSync(VECTOR_STORE_FILE, 'utf8').trim()
            console.log('Using vector store ID from file:', id)
            return id
        }
    } catch (error) {
        console.error('Error reading vector store ID from file:', error)
    }

    console.log('No vector store ID found')
    return null
}

export function setVectorStoreId(id: string): void {
    // Set in global variable (for serverless persistence)
    global.__vectorStoreId = id
    console.log('Vector store ID saved to global:', id)

    // Set in memory
    vectorStoreIdMemory = id
    console.log('Vector store ID saved to memory:', id)

    // Try to save to file (for development)
    try {
        const VECTOR_STORE_FILE = path.join(process.cwd(), '.vector-store-id')
        fs.writeFileSync(VECTOR_STORE_FILE, id)
        console.log('Vector store ID saved to file:', id)
    } catch (error) {
        console.error('Error saving vector store ID to file (this is normal in serverless environments):', error)
    }
}

export function clearVectorStoreId(): void {
    global.__vectorStoreId = undefined
    vectorStoreIdMemory = null

    try {
        const VECTOR_STORE_FILE = path.join(process.cwd(), '.vector-store-id')
        if (fs.existsSync(VECTOR_STORE_FILE)) {
            fs.unlinkSync(VECTOR_STORE_FILE)
        }
    } catch (error) {
        console.error('Error clearing vector store ID from file:', error)
    }
}
