'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Send, Bot, User, Loader2, FileText } from 'lucide-react'
import dynamic from 'next/dynamic'

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
    const [showPdf, setShowPdf] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const hasInitialized = useRef(false)
    const PdfViewer = useMemo(() => dynamic(() => import('./components/PdfViewerClient'), { ssr: false }), [])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768)
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        if (!hasInitialized.current) {
            hasInitialized.current = true
            // Check readiness first; if not initialized, call init
            checkReadinessAndInit()
        }
    }, [])

    // client-only viewer handles scrolling

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
            id: Date.now() + Math.random(), // Ensure unique IDs
            text,
            sender,
            timestamp: new Date(),
            source: source ?? null
        }
        setMessages(prev => [...prev, newMessage])
        return newMessage.id // Return the ID for reference
    }

    // pdf zoom & document handling moved to client-only viewer

    // Removed fallback page finder - rely on AI-provided page numbers


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

        // Add typing indicator and capture its ID
        const typingId = addMessage('Thinking...', 'typing')

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
                        const targetPage = Math.max(1, preferred.page)
                        setPdfFile(`knowledge-base/${preferred.fileName}`)
                        setPdfPage(targetPage)
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
                    <button
                        className="pdf-toggle-button"
                        onClick={() => setShowPdf(!showPdf)}
                        title={showPdf ? "Hide PDF" : "Show PDF"}
                    >
                        <FileText size={20} />
                    </button>
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
                                            <div
                                                className={`source-hint ${isMobile ? 'clickable' : ''}`}
                                                onClick={isMobile ? () => {
                                                    setPdfFile(`knowledge-base/${message.source!.fileName}`)
                                                    setPdfPage(message.source!.page)
                                                    setShowPdf(true)
                                                } : undefined}
                                            >
                                                📄 Referenced: {message.source.fileName} — page {message.source.page}{isMobile ? ' (click to view)' : ''}
                                            </div>
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
                <div className={`pdf-wrapper ${showPdf ? 'show' : ''}`}>
                    <PdfViewer file={pdfFile} page={pdfPage} onClose={() => setShowPdf(false)} isVisible={!isMobile || showPdf} />
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
