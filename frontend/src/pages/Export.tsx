import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { exportApi } from '@/lib/api';
import { Copy, Download, Check } from 'lucide-react';
import { subDays, format } from 'date-fns';

export default function Export() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 365), 'yyyy-MM-dd'), // Last year by default
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [copied, setCopied] = useState(false);

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
      </div>
    </div>
  );
}
