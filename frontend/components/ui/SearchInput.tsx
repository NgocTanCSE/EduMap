import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
    className?: string;
}
export default function SearchInput({ value, onChange, placeholder = 'Tìm kiếm...', debounceMs = 300, className = '' }: SearchInputProps) {
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => {
        setLocalValue(value);
    }, [value]);
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localValue !== value) {
                onChange(localValue);
            }
        }, debounceMs);
        return () => clearTimeout(timer);
    }, [localValue, debounceMs, onChange, value]);
    const handleClear = () => {
        setLocalValue('');
        onChange('');
    };
    return (<div className={`relative ${className}`}>
      <Search className="input-icon" aria-hidden="true"/>
      <input type="text" value={localValue} onChange={(e) => setLocalValue(e.target.value)} placeholder={placeholder} className="form-input input-with-icon pr-10"/>
      {localValue && (<button onClick={handleClear} className="icon-fixed absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors" aria-label="Xóa tìm kiếm">
          <X className="w-4 h-4"/>
        </button>)}
    </div>);
}
