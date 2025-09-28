'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'

interface Message {
    id: number
    text: string
    sender: 'user' | 'bot' | 'typing'
    timestamp: Date
}

export default function Home() {
    const [messages, setMessages] = useState<Message[]>([])
    const [inputMessage, setInputMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [status, setStatus] = useState('Initializing...')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const hasInitialized = useRef(false)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        if (!hasInitialized.current) {
            hasInitialized.current = true
            initializeSystem()
        }
    }, [])

    const initializeSystem = async () => {
        try {
            setStatus('Initializing system and loading company information...')
            const response = await fetch('/api/init')
            const data = await response.json()

            if (response.ok) {
                setIsInitialized(true)
                setStatus('Ready! How can I help you today?')

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
                addMessage("Sorry, I couldn't initialize. Please make sure the server is running and the knowledge base file is available.", 'bot')
            }
        }
    }

    const addMessage = (text: string, sender: 'user' | 'bot' | 'typing') => {
        const newMessage: Message = {
            id: Date.now(),
            text,
            sender,
            timestamp: new Date()
        }
        setMessages(prev => [...prev, newMessage])
    }


    const sendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return
        if (!isInitialized) {
            addMessage("Please wait, I'm still initializing...", 'bot')
            return
        }

        const message = inputMessage.trim()
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
            } else {
                throw new Error(data.error || 'Failed to get response')
            }
        } catch (error) {
            console.error('Chat error:', error)
            setMessages(prev => prev.filter(msg => msg.id !== typingId))
            addMessage('❌ Sorry, I encountered an error: ' + (error as Error).message, 'bot')
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
        <div className="chatbot-container">
            <div className="chatbot-header">
                <div className="header-content">
                    <img src="nudgeable.jpg" alt="Atomberg Solutions" className="header-icon" />
                    <div>
                        <h1> Atomberg Solutions Assistant</h1>
                        <div className="status">{status}</div>
                    </div>
                </div>
            </div>

            <div className="messages-container">
                {messages.map((message) => (
                    <div key={message.id} className={`message ${message.sender}`}>
                        <div className="message-icon">
                            {message.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className="message-content">
                            <div className="message-text">{message.text}</div>
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
                    disabled={isLoading}
                    className="message-input"
                />
                <button
                    onClick={sendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="send-button"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                </button>
            </div>
        </div>
    )
}
