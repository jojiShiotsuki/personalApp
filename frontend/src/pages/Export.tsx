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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CEO AI Briefing</h1>
            <p className="mt-1 text-sm text-gray-500">
              Strategic insights and data export optimized for Claude AI analysis
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleCopy}
              disabled={!exportData}
              className="flex items-center px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              disabled={!exportData}
              className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5 mr-2" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">
            Date Range:
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <button
            onClick={() =>
              setDateRange({
                start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
                end: format(new Date(), 'yyyy-MM-dd'),
              })
            }
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-700"
          >
            Last 7 days
          </button>
          <button
            onClick={() =>
              setDateRange({
                start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                end: format(new Date(), 'yyyy-MM-dd'),
              })
            }
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-700"
          >
            Last 30 days
          </button>
          <button
            onClick={() =>
              setDateRange({
                start: format(subDays(new Date(), 365), 'yyyy-MM-dd'),
                end: format(new Date(), 'yyyy-MM-dd'),
              })
            }
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-700"
          >
            Last year
          </button>
        </div>
      </div>

      {/* Markdown Preview */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
          </div>
        ) : exportData ? (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Markdown Preview
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Copy this and paste into Claude for strategic advice
              </p>
            </div>
            <div className="p-6">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-auto max-h-[600px]">
                {exportData.markdown}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-500">No data available for export</p>
            <p className="text-sm text-gray-400 mt-2">
              Adjust the date range or add some tasks and deals first
            </p>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-slate-50 border-t border-gray-200 px-8 py-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-slate-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-slate-900">
              How to use your CEO AI Briefing
            </h3>
            <div className="mt-2 text-sm text-slate-700">
              <p>
                1. Review the Executive Summary and Recommendations above
                <br />
                2. Click "Copy to Clipboard"
                <br />
                3. Open Claude.ai or your Claude app
                <br />
                4. Paste the briefing into a new conversation
                <br />
                5. Ask Claude strategic questions like:
                <br />
                &nbsp;&nbsp;&nbsp;- "Based on these bottlenecks, what should I prioritize?"
                <br />
                &nbsp;&nbsp;&nbsp;- "How can I improve my win rate?"
                <br />
                &nbsp;&nbsp;&nbsp;- "What's the pattern in my stalled deals?"
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
