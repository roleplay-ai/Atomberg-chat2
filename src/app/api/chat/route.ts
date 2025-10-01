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

CRITICAL OUTPUT FORMAT:
After your natural language answer, you MUST ALWAYS output a SINGLE extra line exactly in this format so the app can navigate to referenced PDF pages:
SOURCES_JSON={"sources":[{"fileName":"<basename>","page":<pageNumber>}]}

IMPORTANT RULES FOR SOURCES_JSON:
- ALWAYS include a page number, even if approximate
- If you found the information in a specific section, provide that page number
- If the question is general or you can't determine a specific page, use page 1 as the default
- NEVER output an empty sources array
- Use the exact filename from the documents (e.g., "SFA User Manual_ASE with Multi Distributor.pdf")
- Use minified JSON format with no extra spaces or comments
- Only output ONE SOURCES_JSON line

Examples:
- Specific info found: SOURCES_JSON={"sources":[{"fileName":"SFA User Manual_ASE with Multi Distributor.pdf","page":49}]}
- General info or page unknown: SOURCES_JSON={"sources":[{"fileName":"SFA User Manual_ASE with Multi Distributor.pdf","page":1}]}

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
        let sources: { fileName: string; page: number }[] = []

        if (response.output && response.output.length > 0) {
            // Find the message output item
            const messageOutput = response.output.find(item => item.type === 'message')
            if (messageOutput && messageOutput.content && messageOutput.content.length > 0) {
                const textContent: any = messageOutput.content.find(content => content.type === 'output_text')
                if (textContent) {
                    reply = textContent.text
                    try {
                        const raw = reply
                        // Match the entire SOURCES_JSON line (including any trailing characters)
                        const sourcesLineMatch = raw.match(/SOURCES_JSON=[\s\S]*$/)
                        if (sourcesLineMatch) {
                            console.log('Found SOURCES_JSON line:', sourcesLineMatch[0])
                            // Extract the JSON part - use greedy match to get the complete JSON object
                            const jsonMatch = sourcesLineMatch[0].match(/\{[\s\S]*\}/)
                            if (jsonMatch) {
                                let jsonStr = jsonMatch[0].trim()
                                console.log('Extracted JSON string:', jsonStr)
                                try {
                                    const parsed = JSON.parse(jsonStr)
                                    if (parsed && Array.isArray(parsed.sources)) {
                                        sources = parsed.sources
                                        console.log('Successfully parsed sources:', sources)
                                    }
                                } catch (parseErr) {
                                    console.warn('Initial JSON parse failed:', parseErr)
                                    // Try removing extra closing brace if present
                                    if (jsonStr.endsWith('}}')) {
                                        try {
                                            jsonStr = jsonStr.slice(0, -1)
                                            const parsed2 = JSON.parse(jsonStr)
                                            if (parsed2 && Array.isArray(parsed2.sources)) {
                                                sources = parsed2.sources
                                                console.log('Parsed sources after removing extra brace:', sources)
                                            }
                                        } catch (secondErr) {
                                            console.warn('Failed to parse SOURCES_JSON after removing extra brace:', secondErr)
                                        }
                                    }
                                }
                            }
                            // Always remove the SOURCES_JSON line from reply
                            reply = raw.substring(0, raw.indexOf('SOURCES_JSON=')).trim()
                        }
                    } catch (e) {
                        console.warn('Failed to parse SOURCES_JSON from reply', e)
                    }
                    console.log('Extracted reply:', reply)
                    console.log('Final sources array:', sources)

                    // Only extract from annotations if SOURCES_JSON parsing failed
                    if (sources.length === 0 && Array.isArray(textContent.annotations) && textContent.annotations.length > 0) {
                        console.log('SOURCES_JSON not found, falling back to file citations:', JSON.stringify(textContent.annotations, null, 2))

                        // Look for SFA file citations with page info
                        const sfaCitations = textContent.annotations.filter((a: any) =>
                            a && a.type === 'file_citation' &&
                            typeof a.filename === 'string' &&
                            a.filename.toLowerCase().includes('sfa')
                        )

                        if (sfaCitations.length > 0) {
                            // Extract unique page numbers from annotations
                            const pageNumbers = new Set<number>()
                            for (const citation of sfaCitations) {
                                // Try to extract page from quote or index
                                if (typeof citation.index === 'number' && citation.index > 0) {
                                    // Rough estimate: assume ~500 chars per page
                                    const estimatedPage = Math.max(1, Math.floor(citation.index / 500))
                                    pageNumbers.add(estimatedPage)
                                }
                            }

                            // Use first SFA citation for filename
                            const firstSfa = sfaCitations[0]
                            if (pageNumbers.size > 0) {
                                const firstPage = Array.from(pageNumbers)[0]
                                sources = [{ fileName: firstSfa.filename, page: firstPage }]
                            } else {
                                sources = [{ fileName: firstSfa.filename, page: 1 }]
                            }

                            console.log('Extracted sources from annotations (fallback):', sources)
                        }
                    }
                }
            }

            // Also check for file search results as another fallback
            const fileSearchOutput: any = response.output.find(item => item.type === 'file_search_call')
            if (fileSearchOutput) {
                console.log('File search results:', JSON.stringify(fileSearchOutput, null, 2))

                // If we still don't have sources, try to extract from file search results
                if ((!sources || sources.length === 0) && fileSearchOutput.results && Array.isArray(fileSearchOutput.results)) {
                    for (const result of fileSearchOutput.results) {
                        if (result.filename && result.filename.toLowerCase().includes('sfa')) {
                            // Check if result has page info
                            const page = result.page_number || result.page || 1
                            sources = [{ fileName: result.filename, page: Math.max(1, page) }]
                            console.log('Extracted page from file search results (fallback):', sources)
                            break
                        }
                    }
                }
            }
        }

        // Ensure we always have at least a default source with page 1 if nothing was found
        if (!sources || sources.length === 0) {
            sources = [{ fileName: 'SFA User Manual_ASE with Multi Distributor.pdf', page: 1 }]
            console.log('No sources found, using default:', sources)
        }

        return NextResponse.json({ reply, sources })
    } catch (error) {
        console.error('Chat error:', error)
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        )
    }
}