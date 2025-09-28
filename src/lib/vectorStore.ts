import fs from 'fs'
import path from 'path'

const VECTOR_STORE_FILE = path.join(process.cwd(), '.vector-store-id')

export function getVectorStoreId(): string | null {
    try {
        if (fs.existsSync(VECTOR_STORE_FILE)) {
            return fs.readFileSync(VECTOR_STORE_FILE, 'utf8').trim()
        }
    } catch (error) {
        console.error('Error reading vector store ID:', error)
    }
    return null
}

export function setVectorStoreId(id: string): void {
    try {
        fs.writeFileSync(VECTOR_STORE_FILE, id)
        console.log('Vector store ID saved:', id)
    } catch (error) {
        console.error('Error saving vector store ID:', error)
    }
}

export function clearVectorStoreId(): void {
    try {
        if (fs.existsSync(VECTOR_STORE_FILE)) {
            fs.unlinkSync(VECTOR_STORE_FILE)
        }
    } catch (error) {
        console.error('Error clearing vector store ID:', error)
    }
}
