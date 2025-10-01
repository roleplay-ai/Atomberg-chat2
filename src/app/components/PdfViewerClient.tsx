'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

// Configure PDF.js worker only in browser
if (typeof window !== 'undefined') {
    // Use ESM worker served from unpkg matching installed version
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface Props {
    file: string
    page: number
    onClose?: () => void
    isVisible?: boolean
}

export default function PdfViewerClient({ file, page, onClose, isVisible = true }: Props) {
    const [pdfZoom, setPdfZoom] = useState<string>('page-width')
    const [numPages, setNumPages] = useState<number | null>(null)
    const viewerContainerRef = useRef<HTMLDivElement>(null)
    const [viewerWidth, setViewerWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth - 40 : 600)
    const [isMobileDevice, setIsMobileDevice] = useState(false)
    const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set())
    const [pdfError, setPdfError] = useState<string | null>(null)
    const [isLoadingPage, setIsLoadingPage] = useState(false)
    const pageRefs = useRef<{ [page: number]: HTMLDivElement | null }>({})

    useEffect(() => {
        const checkMobileAndUpdateWidth = () => {
            setIsMobileDevice(window.innerWidth <= 768)
            if (viewerContainerRef.current) {
                const containerWidth = viewerContainerRef.current.clientWidth
                // Ensure we have a valid width
                const effectiveWidth = Math.max(containerWidth - 16, 300)
                setViewerWidth(effectiveWidth)
            }
        }
        // Delay to ensure container is properly sized
        const timer = setTimeout(checkMobileAndUpdateWidth, 100)
        window.addEventListener('resize', checkMobileAndUpdateWidth)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('resize', checkMobileAndUpdateWidth)
        }
    }, [])

    // Re-calculate width when visibility changes (for mobile)
    useEffect(() => {
        if (isVisible && viewerContainerRef.current) {
            const timer = setTimeout(() => {
                const containerWidth = viewerContainerRef.current?.clientWidth || 300
                const effectiveWidth = Math.max(containerWidth - 16, 300)
                setViewerWidth(effectiveWidth)
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [isVisible])

    // Reset zoom on file change or when becoming visible on mobile
    useEffect(() => {
        const isMobile = window.innerWidth <= 768
        if (isMobile && isVisible) {
            setPdfZoom('page-width')
        }
    }, [file, isVisible])

    // Ensure page-width on mobile by default
    useEffect(() => {
        setPdfZoom('page-width')
    }, [file])

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
        // On mobile, initially load only pages around the current page
        if (isMobileDevice) {
            const initialPages = new Set<number>()
            // Load more pages when navigating directly to a specific page
            const range = 5 // Load 5 pages before and after initially
            for (let i = Math.max(1, page - range); i <= Math.min(numPages, page + range); i++) {
                initialPages.add(i)
            }
            setLoadedPages(initialPages)
        } else {
            // On desktop, load all pages
            const allPages = new Set<number>()
            for (let i = 1; i <= numPages; i++) {
                allPages.add(i)
            }
            setLoadedPages(allPages)
        }
    }

    // Load more pages as user scrolls
    useEffect(() => {
        if (!isMobileDevice || !numPages) return

        const handleScroll = () => {
            const container = viewerContainerRef.current
            if (!container) return

            // Calculate which pages should be visible
            const scrollTop = container.scrollTop
            const containerHeight = container.clientHeight
            const scrollBottom = scrollTop + containerHeight

            // Estimate page positions and load nearby pages
            const estimatedPageHeight = containerHeight * 0.8
            const firstVisiblePage = Math.max(1, Math.floor(scrollTop / estimatedPageHeight) + 1)
            const lastVisiblePage = Math.min(numPages, Math.ceil(scrollBottom / estimatedPageHeight) + 1)

            const pagesToLoad = new Set(loadedPages)
            const range = 3
            for (let i = Math.max(1, firstVisiblePage - range); i <= Math.min(numPages, lastVisiblePage + range); i++) {
                pagesToLoad.add(i)
            }

            if (pagesToLoad.size !== loadedPages.size) {
                setLoadedPages(pagesToLoad)
            }
        }

        const container = viewerContainerRef.current
        if (container) {
            container.addEventListener('scroll', handleScroll)
            return () => container.removeEventListener('scroll', handleScroll)
        }
    }, [isMobileDevice, numPages, loadedPages])

    // Update loaded pages when navigating to a new page
    useEffect(() => {
        if (!isMobileDevice || !numPages) return

        if (!loadedPages.has(page)) {
            setIsLoadingPage(true)
        }

        setLoadedPages(prevPages => {
            const pagesToLoad = new Set(prevPages)
            const range = 5 // Load more pages when directly navigating
            for (let i = Math.max(1, page - range); i <= Math.min(numPages, page + range); i++) {
                pagesToLoad.add(i)
            }
            return pagesToLoad
        })

        // Clear loading indicator after a delay
        const timer = setTimeout(() => setIsLoadingPage(false), 1500)
        return () => clearTimeout(timer)
    }, [page, isMobileDevice, numPages])

    // Auto-scroll to the referenced page
    useEffect(() => {
        if (!pageRefs.current || !viewerContainerRef.current || !numPages || !isVisible) {
            return
        }

        // For mobile with progressive loading, wait for the page to be loaded
        if (isMobileDevice && !loadedPages.has(page)) {
            // Page not loaded yet, wait a bit longer
            const checkTimer = setInterval(() => {
                if (loadedPages.has(page)) {
                    clearInterval(checkTimer)
                    setTimeout(() => {
                        const el = pageRefs.current[page]
                        if (el && typeof el.offsetTop === 'number') {
                            viewerContainerRef.current?.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
                        }
                    }, 800)
                }
            }, 100)

            // Clear after max 5 seconds
            const maxWaitTimer = setTimeout(() => {
                clearInterval(checkTimer)
                // Try to scroll anyway
                const el = pageRefs.current[page]
                if (el && typeof el.offsetTop === 'number') {
                    viewerContainerRef.current?.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
                }
            }, 5000)

            return () => {
                clearInterval(checkTimer)
                clearTimeout(maxWaitTimer)
            }
        } else {
            // Page already loaded or on desktop, scroll with normal delay
            const timer = setTimeout(() => {
                const el = pageRefs.current[page]
                if (el && typeof el.offsetTop === 'number') {
                    viewerContainerRef.current?.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
                }
            }, 800)
            return () => clearTimeout(timer)
        }
    }, [page, numPages, isVisible, isMobileDevice, loadedPages])

    const fileUrl = useMemo(() => encodeURI('/' + file), [file])
    const computedWidth = useMemo(() => {
        if (pdfZoom === 'page-width') {
            return Math.max(viewerWidth, 300)
        }
        const zoomPercent = parseInt(pdfZoom || '100', 10)
        return Math.max(300, Math.floor(viewerWidth * (zoomPercent / 100)))
    }, [pdfZoom, viewerWidth])

    return (
        <div className="right-pane">
            {isMobileDevice && isLoadingPage && (
                <div style={{
                    position: 'absolute',
                    top: 60,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(102, 126, 234, 0.95)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: 20,
                    fontSize: 13,
                    zIndex: 100,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    Loading page {page}...
                </div>
            )}
            <div className="pdf-header">
                <div className="pdf-title">User Manual</div>
                <div className="pdf-toolbar">
                    {onClose && (
                        <button className="pdf-close-btn" onClick={onClose} title="Close PDF">✕</button>
                    )}
                    <button className="pdf-btn" onClick={zoomOut} title="Zoom out">-</button>
                    <button className="pdf-btn" onClick={fitToWidth} title="Fit to width">Fit</button>
                    <button className="pdf-btn" onClick={zoomIn} title="Zoom in">+</button>
                    <span className="pdf-zoom">{pdfZoom === 'page-width' ? 'Fit' : pdfZoom + '%'}</span>
                    <a className="pdf-link" href={fileUrl} target="_blank" rel="noreferrer">Open</a>
                    <a className="pdf-link" href={fileUrl} download>Download</a>
                </div>
            </div>
            <div className="pdf-scroll" ref={viewerContainerRef}>
                {pdfError ? (
                    <div style={{ padding: 20, textAlign: 'center' }}>
                        <div style={{ color: '#d32f2f', marginBottom: 16, fontSize: 16, fontWeight: 600 }}>
                            Unable to load PDF
                        </div>
                        <div style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>
                            This PDF may be too large for your device's browser. Please try:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                            <a
                                href={fileUrl}
                                download
                                style={{
                                    padding: '12px 24px',
                                    background: '#667eea',
                                    color: 'white',
                                    textDecoration: 'none',
                                    borderRadius: 8,
                                    fontSize: 14,
                                    fontWeight: 500
                                }}
                            >
                                Download PDF
                            </a>
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    padding: '12px 24px',
                                    background: '#f0f0f0',
                                    color: '#333',
                                    textDecoration: 'none',
                                    borderRadius: 8,
                                    fontSize: 14,
                                    fontWeight: 500
                                }}
                            >
                                Open in New Tab
                            </a>
                            <button
                                onClick={() => {
                                    setPdfError(null)
                                    setNumPages(null)
                                }}
                                style={{
                                    padding: '8px 16px',
                                    background: 'transparent',
                                    color: '#667eea',
                                    border: '1px solid #667eea',
                                    borderRadius: 8,
                                    fontSize: 13,
                                    cursor: 'pointer'
                                }}
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                ) : (
                    <Document
                        file={fileUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={(err) => {
                            console.error('PDF load error:', err)
                            setPdfError('Failed to load PDF. The file may be too large or corrupted.')
                        }}
                        onSourceError={(err) => {
                            console.error('PDF source error:', err)
                            setPdfError('Failed to load PDF source.')
                        }}
                        loading={<div style={{ padding: 12 }}>Loading PDF…</div>}
                        error={
                            <div style={{ padding: 20, textAlign: 'center' }}>
                                <div style={{ color: '#d32f2f', marginBottom: 12 }}>Failed to load PDF</div>
                                <button
                                    onClick={() => window.location.reload()}
                                    style={{
                                        padding: '8px 16px',
                                        background: '#667eea',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Reload Page
                                </button>
                            </div>
                        }
                    >
                        {numPages ? (
                            Array.from({ length: numPages }, (_, idx) => idx + 1).map((p) => (
                                <div key={`page-${p}`} ref={(el) => { pageRefs.current[p] = el }} style={{ display: 'flex', justifyContent: 'center', padding: 4, width: '100%', minHeight: isMobileDevice && !loadedPages.has(p) ? '600px' : 'auto' }}>
                                    {loadedPages.has(p) ? (
                                        <Page
                                            pageNumber={p}
                                            width={computedWidth}
                                            renderTextLayer={!isMobileDevice}
                                            renderAnnotationLayer={!isMobileDevice}
                                            loading={<div style={{ padding: '20px', textAlign: 'center' }}>Loading page {p}...</div>}
                                        />
                                    ) : (
                                        <div style={{
                                            width: computedWidth,
                                            minHeight: '600px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: '#f8f9fa',
                                            border: '1px solid #e0e0e0',
                                            color: '#999',
                                            fontSize: '14px',
                                            gap: 8
                                        }}>
                                            <div style={{ fontSize: 16, fontWeight: 500 }}>Page {p}</div>
                                            <div style={{ fontSize: 12, color: '#bbb' }}>Scroll to load</div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : null}
                    </Document>
                )}
            </div>
        </div>
    )
}



