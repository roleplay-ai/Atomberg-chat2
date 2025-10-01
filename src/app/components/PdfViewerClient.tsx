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
    const [viewerWidth, setViewerWidth] = useState<number>(0)
    const pageRefs = useRef<{ [page: number]: HTMLDivElement | null }>({})

    useEffect(() => {
        const updateWidth = () => {
            if (viewerContainerRef.current) {
                const containerWidth = viewerContainerRef.current.clientWidth
                // On mobile, subtract padding to get accurate width
                const isMobile = window.innerWidth <= 768
                setViewerWidth(isMobile ? containerWidth - 16 : containerWidth)
            }
        }
        updateWidth()
        window.addEventListener('resize', updateWidth)
        return () => window.removeEventListener('resize', updateWidth)
    }, [])

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
    }

    // Auto-scroll to the referenced page
    useEffect(() => {
        if (!pageRefs.current || !viewerContainerRef.current || !numPages || !isVisible) {
            return
        }
        // Add a small delay to ensure pages are rendered
        const timer = setTimeout(() => {
            const el = pageRefs.current[page]
            if (el && typeof el.offsetTop === 'number') {
                viewerContainerRef.current?.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
            }
        }, 500) // Increased delay for better reliability
        return () => clearTimeout(timer)
    }, [page, numPages, isVisible])

    const fileUrl = useMemo(() => encodeURI('/' + file), [file])
    const computedWidth = pdfZoom === 'page-width'
        ? viewerWidth
        : Math.max(200, Math.floor(viewerWidth * (parseInt(pdfZoom || '100', 10) / 100)))

    return (
        <div className="right-pane">
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
                <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={(err) => console.error('PDF load error:', err)}
                    onSourceError={(err) => console.error('PDF source error:', err)}
                    loading={<div style={{ padding: 12 }}>Loading PDF…</div>}
                    error={<div style={{ padding: 12, color: 'crimson' }}>Failed to load PDF.</div>}
                >
                    {numPages ? (
                        Array.from({ length: numPages }, (_, idx) => idx + 1).map((p) => (
                            <div key={`page-${p}`} ref={(el) => { pageRefs.current[p] = el }} style={{ display: 'flex', justifyContent: 'center', padding: 4 }}>
                                <Page
                                    pageNumber={p}
                                    width={computedWidth}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                />
                            </div>
                        ))
                    ) : null}
                </Document>
            </div>
        </div>
    )
}


