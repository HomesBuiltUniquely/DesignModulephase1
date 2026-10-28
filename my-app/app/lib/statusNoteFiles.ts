export const STATUS_NOTE_MAX_FILES = 8;
export const STATUS_NOTE_MAX_BYTES = 20 * 1024 * 1024;

export function statusNoteFileProblem(files: File[]): string | null {
    if (files.length > STATUS_NOTE_MAX_FILES) return 'You can attach up to 8 files.';
    for (const file of files) {
        const mime = (file.type || '').toLowerCase();
        const allowed = mime === 'application/pdf' || mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|heif|bmp|pdf)$/i.test(file.name);
        if (!allowed) return 'Only images and PDF files can be attached.';
        if (file.size > STATUS_NOTE_MAX_BYTES) return `${file.name} is larger than 20 MB.`;
    }
    return null;
}
