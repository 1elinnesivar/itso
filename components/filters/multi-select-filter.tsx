"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<string | { value: string; label: string }>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm">
          {label}
          {value.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {value.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 max-h-80 min-w-52 overflow-y-auto rounded-md border bg-background p-1 shadow-lg"
          align="start"
        >
          {value.length > 0 && (
            <DropdownMenu.Item
              className="cursor-pointer rounded px-2 py-2 text-sm text-destructive outline-none hover:bg-muted"
              onSelect={() => onChange([])}
            >
              Seçimi temizle
            </DropdownMenu.Item>
          )}
          {options.map((optionItem) => {
            const option = typeof optionItem === "string" ? optionItem : optionItem.value;
            const optionLabel = typeof optionItem === "string" ? optionItem : optionItem.label;
            return (
            <DropdownMenu.CheckboxItem
              key={option || "__empty"}
              checked={value.includes(option)}
              onCheckedChange={() => toggle(option)}
              onSelect={(event) => event.preventDefault()}
              className="relative cursor-pointer rounded py-2 pl-8 pr-2 text-sm outline-none hover:bg-muted"
            >
              <span className="absolute left-2 top-2.5">
                {value.includes(option) && <Check className="h-4 w-4" />}
              </span>
              {optionLabel || "(Boş)"}
            </DropdownMenu.CheckboxItem>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
