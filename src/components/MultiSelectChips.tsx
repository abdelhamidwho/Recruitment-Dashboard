"use client";

import * as React from "react";
import { X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
  category?: string;
}

interface MultiSelectChipsProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  allowCustom?: boolean;
}

export function MultiSelectChips({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  allowCustom = true,
}: MultiSelectChipsProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleUnselect = (item: string) => {
    onChange(value.filter((i) => i !== item));
  };

  const handleSelect = (currentValue: string) => {
    if (value.includes(currentValue)) {
      onChange(value.filter((i) => i !== currentValue));
    } else {
      onChange([...value, currentValue]);
    }
    // We don't close the popover for multi-select, just let them keep picking
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = inputValue;
    if (e.key === "Enter" && input) {
      e.preventDefault();
      const existingOption = options.find(
        (o) => o.label.toLowerCase() === input.toLowerCase() || o.value.toLowerCase() === input.toLowerCase()
      );
      const valToAdd = existingOption ? existingOption.value : input;
      
      if (!value.includes(valToAdd) && (existingOption || allowCustom)) {
        onChange([...value, valToAdd]);
      }
      setInputValue("");
    }
  };

  const selectedLabels = value.map((val) => {
    const opt = options.find((o) => o.value === val);
    return opt ? opt.label : val;
  });

  const categories = Array.from(new Set(options.map((o) => o.category).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {selectedLabels.map((label, idx) => (
          <Badge key={value[idx]} variant="secondary" className="px-1 font-normal text-xs flex items-center gap-1">
            {label}
            <button
              className="ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-muted"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUnselect(value[idx]);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => handleUnselect(value[idx])}
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </Badge>
        ))}
      </div>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn("w-full justify-between", "inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium transition-all hover:bg-muted focus-visible:border-ring")}
          role="combobox"
          aria-expanded={open}
        >
          {value.length > 0 ? `${value.length} selected` : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <input
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Search or type to add..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <CommandList>
              {categories.length > 0 ? (
                categories.map((category) => {
                  const catOptions = options
                    .filter((o) => o.category === category)
                    .filter((o) =>
                      o.label.toLowerCase().includes(inputValue.toLowerCase()) ||
                      o.value.toLowerCase().includes(inputValue.toLowerCase())
                    );
                  if (catOptions.length === 0) return null;
                  return (
                    <CommandGroup key={category} heading={category}>
                      {catOptions.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => handleSelect(option.value)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value.includes(option.value) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })
              ) : (
                <CommandGroup>
                  {options
                    .filter((o) =>
                      o.label.toLowerCase().includes(inputValue.toLowerCase()) ||
                      o.value.toLowerCase().includes(inputValue.toLowerCase())
                    )
                    .map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => handleSelect(option.value)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value.includes(option.value) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}
              {allowCustom && inputValue && !options.some((o) => o.label.toLowerCase() === inputValue.toLowerCase()) && (
                <CommandGroup>
                  <CommandItem
                    value={inputValue}
                    onSelect={() => {
                      handleSelect(inputValue);
                      setInputValue("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(inputValue) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    Add &quot;{inputValue}&quot;
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
