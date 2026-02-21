'use client';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
    fileUrl: string;
    pageNumber: number;
    onLoadSuccess: (args: { numPages: number }) => void;
};

export default function Dqc1PdfViewer({ fileUrl, pageNumber, onLoadSuccess }: Props) {
    return (
        <Document file={fileUrl} onLoadSuccess={onLoadSuccess} className='flex justify-center'>
            <Page pageNumber={pageNumber} width={800} className='shadow-inner' renderTextLayer renderAnnotationLayer />
        </Document>
    );
}
