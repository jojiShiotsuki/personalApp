import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { exportApi } from '@/lib/api';
import { Copy, Download, Check, Users, Handshake, ListTodo, FileSpreadsheet } from 'lucide-react';
import { subDays, format } from 'date-fns';
import { toast } from 'sonner';

export default function Export() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 365), 'yyyy-MM-dd'), // Last year by default
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: exportData, isLoading } = useQuery({
    queryKey: ['export', dateRange],
    queryFn: () => exportApi.getContext(dateRange.start, dateRange.end),
  });

  const handleCopy = async () => {
    if (exportData?.markdown) {
      await navigator.clipboard.writeText(exportData.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCsvDownload = async (entity: 'contacts' | 'deals' | 'tasks') => {
    setDownloading(entity);
    try {
      await exportApi.downloadCsv(entity);
      toast.success(`${entity}.csv downloaded`);
    } catch {
      toast.error(`Failed to download ${entity}.csv`);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownload = () => {
    if (exportData?.markdown) {
      const blob = new Blob([exportData.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `context-export-${format(new Date(), 'yyyy-MM-dd')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-b border-gray-200/60 dark:border-gray-700 px-8 py-6 sticky top-0 z-10 transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
              CEO AI Briefing
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Strategic insights and data export optimized for Claude AI analysis
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleCopy}
              disabled={!exportData}
              className="flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              disabled={!exportData}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200/60 dark:border-gray-700 px-8 py-4 transition-colors duration-200">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Date Range:
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
            />
            <span className="text-gray-500 dark:text-gray-400 font-medium">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Generating briefing...</p>
          </div>
        ) : exportData ? (
          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700 overflow-hidden animate-in fade-in duration-500">
            <div className="p-8">
              <pre className="font-mono text-sm text-gray-900 dark:text-white whitespace-pre-wrap overflow-x-auto">
                {exportData.markdown}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <p>No data available for the selected range.</p>
          </div>
        )}

        {/* CSV Data Exports */}
        <div className="max-w-4xl mx-auto mt-8">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data Exports</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { entity: 'contacts' as const, label: 'Contacts', icon: Users, desc: 'All contacts with status, company, and source' },
              { entity: 'deals' as const, label: 'Deals', icon: Handshake, desc: 'All deals with value, stage, and dates' },
              { entity: 'tasks' as const, label: 'Tasks', icon: ListTodo, desc: 'All tasks with priority, status, and due dates' },
            ]).map(({ entity, label, icon: Icon, desc }) => (
              <button
                key={entity}
                onClick={() => handleCsvDownload(entity)}
                disabled={downloading === entity}
                className="flex flex-col items-start gap-3 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">{label}</span>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                {downloading === entity && (
                  <div className="w-full flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 dark:border-blue-400" />
                    Downloading...
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
