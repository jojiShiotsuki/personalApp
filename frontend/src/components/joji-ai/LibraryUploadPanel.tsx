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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [textContent, setTextContent] = useState('');
  const [title, setTitle] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'text') {
        return jojiAiApi.uploadToLibrary(undefined, textContent, title || undefined);
      }
      // Sequential bulk upload for PDFs
      const results: string[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress({ current: i + 1, total: selectedFiles.length, name: file.name });
        const data = await jojiAiApi.uploadToLibrary(
          file,
          undefined,
          selectedFiles.length === 1 ? (title || undefined) : undefined
        );
        results.push(data.file_path);
      }
      setUploadProgress(null);
      return { file_path: results.join(', '), count: results.length };
    },
    onSuccess: (data: any) => {
      const count = data.count ?? 1;
      if (count > 1) {
        toast.success(`Saved ${count} files to brain`);
      } else {
        toast.success(`Saved to brain: ${data.file_path}`);
      }
      setSelectedFiles([]);
      setTextContent('');
      setTitle('');
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'Upload failed';
      toast.error(detail);
      setUploadProgress(null);
    },
  });

  const handleFileSelect = useCallback((files: FileList | File[]) => {
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        toast.error(`${file.name}: Only PDF files are supported`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File must be under 10 MB`);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files);
      }
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
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const canUpload =
    !uploadMutation.isPending &&
    (mode === 'pdf' ? selectedFiles.length > 0 : textContent.trim().length > 0);

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
            <label className={labelClasses}>PDF Files</label>
            <div
              onClick={handleZoneClick}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                'relative flex flex-col items-center justify-center gap-2',
                'w-full min-h-[100px] rounded-lg border-2 border-dashed',
                'cursor-pointer transition-all duration-200',
                isDragOver
                  ? 'border-[--exec-accent] bg-[--exec-accent]/5'
                  : 'border-stone-600/40 bg-stone-800/30 hover:border-stone-500/60 hover:bg-stone-800/50'
              )}
            >
              <Upload
                className={cn(
                  'w-6 h-6 transition-colors',
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
                  {selectedFiles.length > 0 ? 'Add more PDFs' : 'Drop PDFs here or click to browse'}
                </p>
                <p className="text-[10px] text-[--exec-text-muted] mt-0.5">Max 10 MB each</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                      'bg-stone-800/50 border border-stone-600/30'
                    )}
                  >
                    <FileText className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span className="text-xs text-[--exec-text] flex-1 min-w-0 truncate">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-[--exec-text-muted] flex-shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="text-stone-500 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-[--exec-text-muted] text-right">
                  {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                </p>
              </div>
            )}
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
              {uploadProgress
                ? `Processing ${uploadProgress.current}/${uploadProgress.total}: ${uploadProgress.name}`
                : 'Processing... this may take up to 30 seconds'}
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload {mode === 'pdf' && selectedFiles.length > 1 ? `${selectedFiles.length} files` : ''} to Brain
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
