import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tiktokApi } from '@/lib/api';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TikTokImportResult } from '@/types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<TikTokImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (f: File) => tiktokApi.importData(f),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['tiktok'] });
      toast.success(`Imported ${data.imported} videos, updated ${data.updated}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Import failed');
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleImport = () => {
    if (file) importMutation.mutate(file);
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Import TikTok Data</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">Upload your TikTok data export (JSON format)</p>
            </div>
            <button onClick={handleClose} className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-900/20 border border-emerald-800/40 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-emerald-300 font-medium">Import Complete</p>
                  <p className="text-emerald-400/70 mt-1">{result.imported} new, {result.updated} updated, {result.skipped} skipped out of {result.total} total</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="p-4 bg-red-900/20 border border-red-800/40 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-red-300">Errors ({result.errors.length})</span>
                  </div>
                  <div className="text-xs text-red-400/70 space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((err, i) => (<p key={i}>{err}</p>))}
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-4 border-t border-stone-700/30">
                <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] transition-colors">Done</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
                  dragOver ? "border-[--exec-accent] bg-[--exec-accent]/5" : "border-stone-600/40 hover:border-stone-500/60",
                )}
                onClick={() => document.getElementById('tiktok-file-input')?.click()}
              >
                <input id="tiktok-file-input" type="file" accept=".json" onChange={handleFileChange} className="hidden" />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-[--exec-accent]" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-[--exec-text]">{file.name}</p>
                      <p className="text-xs text-[--exec-text-muted]">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-[--exec-text-muted] mx-auto mb-3" />
                    <p className="text-sm text-[--exec-text-secondary]">Drop your TikTok export JSON here</p>
                    <p className="text-xs text-[--exec-text-muted] mt-1">or click to browse (max 5MB)</p>
                  </>
                )}
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30">
                <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors">Cancel</button>
                <button onClick={handleImport} disabled={!file || importMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {importMutation.isPending ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
