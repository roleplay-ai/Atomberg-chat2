'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Message {
    id: number
    text: string
    sender: 'user' | 'bot' | 'typing'
    timestamp: Date
    source?: { fileName: string; page: number } | null
}

export default function Home() {
    const [messages, setMessages] = useState<Message[]>([])
    const [inputMessage, setInputMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [status, setStatus] = useState('Initializing...')
    const [pdfFile, setPdfFile] = useState<string>('knowledge-base/SFA User Manual_ASE with Multi Distributor.pdf')
    const [pdfPage, setPdfPage] = useState<number>(1)
    const [lastQuestion, setLastQuestion] = useState<string>('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const hasInitialized = useRef(false)
    const [pdfZoom, setPdfZoom] = useState<string>('page-width')
    const [numPages, setNumPages] = useState<number | null>(null)
    const viewerContainerRef = useRef<HTMLDivElement>(null)
    const [viewerWidth, setViewerWidth] = useState<number>(0)
    const pageRefs = useRef<{ [page: number]: HTMLDivElement | null }>({})

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        if (!hasInitialized.current) {
            hasInitialized.current = true
            // Check readiness first; if not initialized, call init
            checkReadinessAndInit()
        }
    }, [])

    // Track viewer container width for fit-to-width and zoom
    useEffect(() => {
        const updateWidth = () => {
            if (viewerContainerRef.current) {
                setViewerWidth(viewerContainerRef.current.clientWidth)
            }
        }
        updateWidth()
        window.addEventListener('resize', updateWidth)
        return () => window.removeEventListener('resize', updateWidth)
    }, [])

    // Auto-scroll to the referenced page when pdfPage changes
    useEffect(() => {
        if (!pageRefs.current || !viewerContainerRef.current) return
        const el = pageRefs.current[pdfPage]
        if (el && typeof el.offsetTop === 'number') {
            viewerContainerRef.current.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
        }
    }, [pdfPage])

    const initializeSystem = async () => {
        try {
            setStatus('Initializing system and loading company information...')
            const response = await fetch('/api/init')
            const data = await response.json()

            if (response.ok) {
                setIsInitialized(true)
                setStatus('Ready! How can I help you today?')
                console.log('System initialized successfully:', data)

                // Only add welcome message if no messages exist yet
                if (messages.length === 0) {
                    addMessage("Hello! I'm your company assistant. I'm here to help you with any questions about our company, policies, services, or any other information you might need. What would you like to know?", 'bot')
                }
            } else {
                throw new Error(data.error || 'Failed to initialize')
            }
        } catch (error) {
            console.error('Initialization error:', error)
            setStatus('Error: ' + (error as Error).message)

            // Only add error message if no messages exist yet
            if (messages.length === 0) {
                addMessage("Sorry, I couldn't initialize. This might be due to server configuration issues. Please try refreshing the page, or contact support if the problem persists.", 'bot')
            }
        }
    }

    const pollStatus = async (maxAttempts = 30, intervalMs = 2000) => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const res = await fetch('/api/status', { cache: 'no-store' })
                const json = await res.json()
                if (json.ready) {
                    setIsInitialized(true)
                    setStatus('Ready! How can I help you today?')
                    return true
                }
                if (json.status === 'error') {
                    setStatus('Error verifying knowledge base. Retrying...')
                } else if (json.status === 'not_initialized') {
                    setStatus('Preparing knowledge base...')
                } else if (json.status === 'in_progress') {
                    setStatus('Processing knowledge base...')
                }
            } catch (e) {
                console.error('Status check failed', e)
                setStatus('Checking status...')
            }
            await new Promise(r => setTimeout(r, intervalMs))
        }
        return false
    }

    const checkReadinessAndInit = async () => {
        setStatus('Checking knowledge base status...')
        const ready = await pollStatus(1, 0)
        if (ready) {
            // Add welcome only if none
            if (messages.length === 0) {
                addMessage("Hello! I'm your company assistant. I'm here to help you with any questions about our company, policies, services, or any other information you might need. What would you like to know?", 'bot')
            }
            return
        }
        await initializeSystem()
        // After kicking off init, poll until ready
        const becameReady = await pollStatus(60, 2000)
        if (!becameReady) {
            setStatus('Still preparing knowledge base. You can ask general questions meanwhile.')
        } else {
            if (messages.length === 0) {
                addMessage("Hello! I'm your company assistant. I'm here to help you with any questions about our company, policies, services, or any other information you might need. What would you like to know?", 'bot')
            }
        }
    }

    const addMessage = (text: string, sender: 'user' | 'bot' | 'typing', source?: { fileName: string; page: number } | null) => {
        const newMessage: Message = {
            id: Date.now(),
            text,
            sender,
            timestamp: new Date(),
            source: source ?? null
        }
        setMessages(prev => [...prev, newMessage])
    }

    const zoomIn = () => {
        if (pdfZoom === 'page-width') {
            setPdfZoom('125')
        } else {
            const current = parseInt(pdfZoom || '100', 10)
            setPdfZoom(String(Math.min(current + 25, 300)))
        }
    }

    const zoomOut = () => {
        if (pdfZoom === 'page-width') return
        const current = parseInt(pdfZoom || '100', 10)
        const next = Math.max(current - 25, 50)
        setPdfZoom(String(next))
    }

    const fitToWidth = () => setPdfZoom('page-width')

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages)
    }

    // Fallback: if AI didn't return a page for SFA, try to locate page by keywords
    useEffect(() => {
        const shouldSearch = pdfFile.toLowerCase().includes('sfa') && (!lastQuestion || lastQuestion.trim().length < 3 ? false : true)
        if (!shouldSearch) return

        // Only run if page is 1 or missing and we have an SFA file
        if (pdfPage !== 1) return

        let cancelled = false
        const run = async () => {
            try {
                const loadingTask = pdfjs.getDocument({ url: encodeURI('/' + pdfFile) })
                const pdf = await loadingTask.promise
                const terms = Array.from(new Set(
                    lastQuestion
                        .toLowerCase()
                        .replace(/[^a-z0-9\s]/g, ' ')
                        .split(/\s+/)
                        .filter(w => w.length >= 4)
                ))
                if (terms.length === 0) return
                let bestPage = 1
                let bestScore = 0
                const total = pdf.numPages
                for (let p = 1; p <= total; p++) {
                    const page = await pdf.getPage(p)
                    const textContent = await page.getTextContent()
                    const text = textContent.items.map((it: any) => (it.str || '')).join(' ').toLowerCase()
                    let score = 0
                    for (const t of terms) {
                        if (text.includes(t)) score += 1
                    }
                    if (score > bestScore) {
                        bestScore = score
                        bestPage = p
                    }
                    // Early exit if strong match
                    if (bestScore >= Math.min(terms.length, 5)) break
                    if (cancelled) return
                }
                if (!cancelled && bestScore > 0 && bestPage !== pdfPage) {
                    setPdfPage(bestPage)
                }
            } catch (e) {
                console.warn('Fallback page finder error:', e)
            }
        }
        run()
        return () => { cancelled = true }
    }, [pdfFile, lastQuestion])


    const sendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return
        if (!isInitialized) {
            setStatus('Processing knowledge base...')
            return
        }

        const message = inputMessage.trim()
        setLastQuestion(message)
        setInputMessage('')
        addMessage(message, 'user')

        // Add typing indicator
        const typingId = Date.now()
        addMessage('Thinking...', 'typing')

        try {
            setIsLoading(true)
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            })

            const data = await response.json()

            // Remove typing indicator
            setMessages(prev => prev.filter(msg => msg.id !== typingId))

            if (response.ok) {
                addMessage(data.reply, 'bot')
                if (Array.isArray(data.sources) && data.sources.length > 0) {
                    const preferred = data.sources.find((s: any) => typeof s.fileName === 'string' && s.fileName.toLowerCase().includes('sfa')) || data.sources[0]
                    if (preferred && typeof preferred.fileName === 'string' && typeof preferred.page === 'number') {
                        setPdfFile(`knowledge-base/${preferred.fileName}`)
                        setPdfPage(Math.max(1, preferred.page))
                        setPdfZoom('page-width')
                        setMessages(prev => {
                            const updated = [...prev]
                            for (let i = updated.length - 1; i >= 0; i--) {
                                if (updated[i].sender === 'bot') {
                                    updated[i] = { ...updated[i], source: { fileName: preferred.fileName, page: preferred.page } }
                                    break
                                }
                            }
                            return updated
                        })
                    }
                }
            } else {
                const errorMsg = (data && data.error) ? String(data.error) : 'Failed to get response'
                const processing = errorMsg.toLowerCase().includes('still being processed') ||
                    errorMsg.toLowerCase().includes('not ready')
                if (processing) {
                    // Do not surface an error message; show loader and poll until ready
                    setIsInitialized(false)
                    setStatus('Processing knowledge base...')
                    await pollStatus(60, 2000)
                    return
                }
                throw new Error(errorMsg)
            }
        } catch (error) {
            console.error('Chat error:', error)
            setMessages(prev => prev.filter(msg => msg.id !== typingId))
            const msg = (error as Error).message || ''
            const processing = msg.toLowerCase().includes('still being processed') ||
                msg.toLowerCase().includes('not ready')
            if (processing) {
                // Suppress chat error message; show loader and poll until ready
                setIsInitialized(false)
                setStatus('Processing knowledge base...')
                await pollStatus(60, 2000)
            } else {
                addMessage('❌ Sorry, I encountered an error: ' + msg, 'bot')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    // Prevent zoom on input focus for mobile
    useEffect(() => {
        const preventZoom = (e: any) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
                const viewport = document.querySelector('meta[name="viewport"]')
                if (viewport) {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
                }
            }
        }

        document.addEventListener('focusin', preventZoom)
        document.addEventListener('focusout', () => {
            const viewport = document.querySelector('meta[name="viewport"]')
            if (viewport) {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
            }
        })

        return () => {
            document.removeEventListener('focusin', preventZoom)
        }
    }, [])

    return (
        <div className="chatbot-container split-layout">
            <div className="chatbot-header">
                <div className="header-content">
                    <img src="nudgeable.jpg" alt="Atomberg Solutions" className="header-icon" />
                    <div>
                        <h1> Atomberg Assistant</h1>
                        <div className="status">{status}</div>
                    </div>
                </div>
            </div>
            <div className="split-content">
                <div className="left-pane">
                    <div className="messages-container">
                        {messages.map((message) => (
                            <div key={message.id} className={`message ${message.sender}`}>
                                <div className="message-icon">
                                    {message.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <div className="message-content">
                                    <div className="message-text">
                                        {message.text}
                                        {message.source && message.sender === 'bot' && (
                                            <div className="source-hint">Referenced: {message.source.fileName} — page {message.source.page}</div>
                                        )}
                                    </div>
                                    {message.sender !== 'typing' && (
                                        <div className="message-time">
                                            {message.timestamp.toLocaleTimeString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="input-container">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask me anything about our company..."
                            disabled={isLoading || !isInitialized}
                            className="message-input"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading || !inputMessage.trim() || !isInitialized}
                            className="send-button"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                        </button>
                    </div>
                </div>
                <div className="right-pane">
                    <div className="pdf-header">
                        <div className="pdf-title">SFA User Manual</div>
                        <div className="pdf-toolbar">
                            <button className="pdf-btn" onClick={zoomOut} title="Zoom out">-</button>
                            <button className="pdf-btn" onClick={fitToWidth} title="Fit to width">Fit</button>
                            <button className="pdf-btn" onClick={zoomIn} title="Zoom in">+</button>
                            <span className="pdf-zoom">{pdfZoom === 'page-width' ? 'Fit' : pdfZoom + '%'}</span>
                            <a className="pdf-link" href={`/${pdfFile}`} target="_blank" rel="noreferrer">Open</a>
                            <a className="pdf-link" href={`/${pdfFile}`} download>Download</a>
                        </div>
                    </div>
                    <div className="pdf-scroll" ref={viewerContainerRef}>
                        <Document
                            file={useMemo(() => encodeURI('/' + pdfFile), [pdfFile])}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={(err) => console.error('PDF load error:', err)}
                            onSourceError={(err) => console.error('PDF source error:', err)}
                            loading={<div style={{ padding: 12 }}>Loading PDF…</div>}
                            error={<div style={{ padding: 12, color: 'crimson' }}>Failed to load PDF.</div>}
                        >
                            {numPages ? (
                                Array.from({ length: numPages }, (_, idx) => idx + 1).map((p) => (
                                    <div key={`page-${p}`} ref={(el) => { pageRefs.current[p] = el }} style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
                                        <Page
                                            pageNumber={p}
                                            width={pdfZoom === 'page-width' ? viewerWidth : Math.max(200, Math.floor(viewerWidth * (parseInt(pdfZoom || '100', 10) / 100)))}
                                            renderTextLayer={true}
                                            renderAnnotationLayer={true}
                                        />
                                    </div>
                                ))
                            ) : null}
                        </Document>
                    </div>
                </div>
            </div>

            {(!isInitialized) && (
                <div className="loading-overlay">
                    <div className="loading-content">
                        <Loader2 className="animate-spin" size={28} />
                        <div className="loading-text">{status}</div>
                    </div>
                </div>
            )}
        </div>
    )
}
