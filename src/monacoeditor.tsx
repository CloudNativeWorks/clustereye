import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
    value: string;
    readOnly?: boolean; // Readonly özelliği eklendi
    height?: string; // Yükseklik özelliği eklendi
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ value, readOnly = false, height = '300px' }) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const monacoInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    useEffect(() => {
        if (editorRef.current) {
            monacoInstanceRef.current = monaco.editor.create(editorRef.current, {
                value,
                language: 'pgsql', // PostgreSQL dil desteği
                theme: 'vs-light',
                readOnly, // Salt okunur yapı
                automaticLayout: true,
                minimap: { enabled: false },
                wordWrap: 'on', // Satır sonunda kelime kaydırma
                scrollBeyondLastLine: false, // Son satırdan sonra ekstra scroll alanı olmaması
                fontSize: 14, // Daha okunaklı font boyutu
                lineNumbers: 'on', // Satır numaraları
                scrollbar: {
                    verticalScrollbarSize: 12, // Dikey kaydırma çubuğu boyutu
                    horizontalScrollbarSize: 12 // Yatay kaydırma çubuğu boyutu
                },
                wrappingStrategy: 'advanced' // Gelişmiş kaydırma stratejisi
            });
        }

        return () => {
            monacoInstanceRef.current?.dispose();
        };
    }, []);

    // Dışarıdan gelen value güncellemelerini yönet
    useEffect(() => {
        if (monacoInstanceRef.current) {
            const currentValue = monacoInstanceRef.current.getValue();
            if (value !== currentValue) {
                monacoInstanceRef.current.setValue(value);
            }
        }
    }, [value]);

    return <div ref={editorRef} style={{ height, width: '100%' }} />;
};

export default MonacoEditor;
