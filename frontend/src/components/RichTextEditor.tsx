import { useEffect, useRef } from 'react';
import { Bold, Italic, List, Heading1, Heading2, ListOrdered, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Configure DOMPurify to allow safe HTML elements
const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'div', 'span'],
  ALLOWED_ATTR: ['class', 'style'],
  ALLOW_DATA_ATTR: false,
};

export default function RichTextEditor({
  value,
  onChange,
  className,
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      const sanitizedValue = DOMPurify.sanitize(value, PURIFY_CONFIG);
      if (editorRef.current.innerHTML !== sanitizedValue) {
        if (document.activeElement !== editorRef.current) {
          editorRef.current.innerHTML = sanitizedValue;
        }
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const sanitizedContent = DOMPurify.sanitize(editorRef.current.innerHTML, PURIFY_CONFIG);
      onChange(sanitizedContent);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  return (
    <div className={cn("border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 focus-within:ring-2 focus-within:ring-blue-500 transition-shadow", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <ToolbarButton onClick={() => execCommand('formatBlock', 'H1')} icon={Heading1} title="Heading 1" />
        <ToolbarButton onClick={() => execCommand('formatBlock', 'H2')} icon={Heading2} title="Heading 2" />
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <ToolbarButton onClick={() => execCommand('bold')} icon={Bold} title="Bold" />
        <ToolbarButton onClick={() => execCommand('italic')} icon={Italic} title="Italic" />
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <ToolbarButton onClick={() => execCommand('insertUnorderedList')} icon={List} title="Bullet List" />
        <ToolbarButton onClick={() => execCommand('insertOrderedList')} icon={ListOrdered} title="Numbered List" />
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        className={cn(
          "p-3 min-h-[150px] outline-none max-w-none text-sm text-gray-900 dark:text-white",
          "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-2",
          "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:mt-2",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2",
          "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2",
          "[&_p]:mb-2",
          "[&_li]:mb-0.5"
        )}
      />
    </div>
  );
}

function ToolbarButton({ onClick, icon: Icon, title }: { onClick: () => void; icon: LucideIcon; title: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
      title={title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
