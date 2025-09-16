import pako from 'pako';

export const decodeCompressedBase64 = (compressedBase64: string): string => {
    try {
        // Remove the "COMPRESSED_XML:" prefix if it exists
        const base64Data = compressedBase64.replace('COMPRESSED_XML:', '');
        
        // Convert base64 to binary
        const binaryString = atob(base64Data);
        
        // Convert binary string to Uint8Array
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Decompress using pako (gzip)
        const decompressed = pako.inflate(bytes, { to: 'string' });
        
        return decompressed;
    } catch (error) {
        console.error('Error decoding compressed base64:', error);
        throw new Error('Failed to decode compressed data');
    }
}; 