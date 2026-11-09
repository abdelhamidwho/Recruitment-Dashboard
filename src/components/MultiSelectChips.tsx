"use client";

import * as React from "react";
import { X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
  category?: string;
}

/**
 * Given the raw text currently typed into a MultiSelectChips input, decides
 * what value (if any) an Enter/"Add" action should add to the selection.
 * Pure and side-effect free so the add-and-clear behaviour is unit-testable
 * without rendering the component:
 * - If the typed text matches an existing option's label or value
 *   (case-insensitively), that option's value is used instead of the raw
 *   text, so free typing that happens to match a known option selects it
 *   rather than creating a duplicate custom entry.
 * - Returns `null` (nothing to add) when the resolved value is already
 *   selected, or when it doesn't match an option and custom values aren't
 *   allowed for this field.
 */
export function resolveValueToAdd(
  input: string,
  options: Option[],
  currentValue: string[],
  allowCustom: boolean,
): string | null {
  const existingOption = options.find(
    (o) => o.label.toLowerCase() === input.toLowerCase() || o.value.toLowerCase() === input.toLowerCase()
  );
  const valToAdd = existingOption ? existingOption.value : input;

  if (currentValue.includes(valToAdd)) return null;
  if (!existingOption && !allowCustom) return null;
  return valToAdd;
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
    if (e.key === "Enter" && inputValue) {
      e.preventDefault();
      const valToAdd = resolveValueToAdd(inputValue, options, value, allowCustom);
      if (valToAdd !== null) {
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
          <Badge key={value[idx]} variant="secondary" className="px-2 font-medium text-base flex items-center gap-1">
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
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          </Badge>
        ))}
      </div>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn("w-full justify-between", "inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 h-12 text-base font-medium text-muted-foreground border-input transition-all hover:bg-muted focus-visible:border-ring")}
          role="combobox"
          aria-expanded={open}
        >
          {value.length > 0 ? `${value.length} selected` : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or type to add..."
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={handleKeyDown}
            />
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
