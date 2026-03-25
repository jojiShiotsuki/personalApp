import { useState, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Upload, FileText, Loader2, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { jojiAiApi } from '@/lib/api';
import { toast } from 'sonner';

interface LibraryUploadPanelProps {
  onBack: () => void;
}

const inputClasses = cn(
  'w-full px-3 py-2 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all text-sm'
);

const labelClasses = 'block text-[10px] font-medium text-[--exec-text-muted] mb-1 uppercase tracking-wider';

export default function LibraryUploadPanel({ onBack }: LibraryUploadPanelProps) {
  const [mode, setMode] = useState<'pdf' | 'text'>('pdf');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState('');
  const [title, setTitle] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: () =>
      jojiAiApi.uploadToLibrary(
        mode === 'pdf' ? selectedFile ?? undefined : undefined,
        mode === 'text' ? textContent : undefined,
        title || undefined
      ),
    onSuccess: (data) => {
      toast.success(`Saved to brain: ${data.file_path}`);
      setSelectedFile(null);
      setTextContent('');
      setTitle('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'Upload failed';
      toast.error(detail);
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10 MB');
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const canUpload =
    !uploadMutation.isPending &&
    (mode === 'pdf' ? !!selectedFile : textContent.trim().length > 0);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-700/30">
        <button
          onClick={onBack}
          className={cn(
            'flex items-center gap-1.5 text-xs text-[--exec-text-secondary]',
            'hover:text-[--exec-text] transition-colors'
          )}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to settings
        </button>
        <h2 className="text-sm font-semibold text-[--exec-text] mt-2">Upload to Brain</h2>
        <p className="text-[10px] text-[--exec-text-muted] mt-0.5 leading-relaxed">
          Content is distilled by AI and saved to your knowledge vault
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Mode toggle */}
        <div className="flex items-center bg-stone-800/50 p-1 rounded-lg gap-1">
          <button
            onClick={() => setMode('pdf')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              mode === 'pdf'
                ? 'bg-stone-700 text-[--exec-text] shadow-sm'
                : 'text-[--exec-text-muted] hover:text-[--exec-text-secondary]'
            )}
          >
            <Upload className="w-3 h-3" />
            PDF
          </button>
          <button
            onClick={() => setMode('text')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              mode === 'text'
                ? 'bg-stone-700 text-[--exec-text] shadow-sm'
                : 'text-[--exec-text-muted] hover:text-[--exec-text-secondary]'
            )}
          >
            <Type className="w-3 h-3" />
            Text
          </button>
        </div>

        {/* Title field (optional) */}
        <div>
          <label className={labelClasses}>Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. $100M Offers'
            className={inputClasses}
          />
        </div>

        {/* PDF drop zone */}
        {mode === 'pdf' && (
          <div>
            <label className={labelClasses}>PDF File</label>
            <div
              onClick={handleZoneClick}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                'relative flex flex-col items-center justify-center gap-2',
                'w-full min-h-[120px] rounded-lg border-2 border-dashed',
                'cursor-pointer transition-all duration-200',
                selectedFile
                  ? 'border-green-700/60 bg-green-900/10'
                  : isDragOver
                  ? 'border-[--exec-accent] bg-[--exec-accent]/5'
                  : 'border-stone-600/40 bg-stone-800/30 hover:border-stone-500/60 hover:bg-stone-800/50'
              )}
            >
              {selectedFile ? (
                <>
                  <FileText className="w-7 h-7 text-green-400" />
                  <div className="text-center px-3">
                    <p className="text-xs font-medium text-green-400 break-all leading-snug">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-[--exec-text-muted] mt-0.5">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-[10px] text-[--exec-text-muted] hover:text-red-400 transition-colors underline"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <Upload
                    className={cn(
                      'w-7 h-7 transition-colors',
                      isDragOver ? 'text-[--exec-accent]' : 'text-stone-500'
                    )}
                  />
                  <div className="text-center px-3">
                    <p
                      className={cn(
                        'text-xs font-medium transition-colors',
                        isDragOver ? 'text-[--exec-accent]' : 'text-[--exec-text-secondary]'
                      )}
                    >
                      Drop a PDF here or click to browse
                    </p>
                    <p className="text-[10px] text-[--exec-text-muted] mt-0.5">Max 10 MB</p>
                  </div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>
        )}

        {/* Text paste area */}
        {mode === 'text' && (
          <div>
            <label className={labelClasses}>Content</label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste notes, excerpts, or any text you want the AI to learn from..."
              rows={10}
              className={cn(inputClasses, 'resize-none')}
            />
            <p className="text-[10px] text-[--exec-text-muted] mt-1 text-right">
              {textContent.length.toLocaleString()} / 500,000 characters
            </p>
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={() => uploadMutation.mutate()}
          disabled={!canUpload}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
            'transition-all duration-200',
            canUpload
              ? 'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md'
              : 'bg-stone-700/30 text-stone-500 cursor-not-allowed'
          )}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing... this may take up to 30 seconds
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload to Brain
            </>
          )}
        </button>

        {/* Info text */}
        <p className="text-[10px] text-[--exec-text-muted] text-center leading-relaxed px-2">
          Content is distilled by AI into key frameworks and principles, auto-organized, and saved
          to your Obsidian vault. Browse and edit in Obsidian.
        </p>
      </div>
    </div>
  );
}
