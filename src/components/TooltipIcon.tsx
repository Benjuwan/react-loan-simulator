import { HelpCircle } from "lucide-react";

interface TooltipIconProps {
  text: string;
}

export function TooltipIcon({ text }: TooltipIconProps) {
  return (
    <div className="group/tooltip relative inline-flex items-center justify-center ml-1 cursor-help">
      <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-20 wrap-break-word font-normal pointer-events-none">
        {text}
        {/* 吹き出しの尻尾 */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  );
}
