"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeText } from "@/lib/utils";

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
  const [search, setSearch] = useState("");

  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }

  const normalizedOptions = useMemo(
    () =>
      options.map((optionItem) => ({
        value: typeof optionItem === "string" ? optionItem : optionItem.value,
        label: typeof optionItem === "string" ? optionItem : optionItem.label,
      })),
    [options],
  );
  const visibleOptions = useMemo(() => {
    const query = normalizeText(search);
    if (!query) return normalizedOptions;
    return normalizedOptions.filter((option) => normalizeText(option.label).includes(query));
  }, [normalizedOptions, search]);

  return (
    <DropdownMenu.Root onOpenChange={(open) => !open && setSearch("")}>
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
          {normalizedOptions.length > 8 && (
            <div
              className="sticky top-0 z-10 bg-background p-1"
              onKeyDown={(event) => event.stopPropagation()}
            >
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-8"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  placeholder={`${label} ara...`}
                  autoFocus
                />
              </div>
            </div>
          )}
          {value.length > 0 && (
            <DropdownMenu.Item
              className="cursor-pointer rounded px-2 py-2 text-sm text-destructive outline-none hover:bg-muted"
              onSelect={() => onChange([])}
            >
              Seçimi temizle
            </DropdownMenu.Item>
          )}
          {visibleOptions.map(({ value: option, label: optionLabel }) => {
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
          {!visibleOptions.length && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Sonuç bulunamadı.
            </p>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
