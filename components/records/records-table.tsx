"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileDown,
  Filter,
  Loader2,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MultiSelectFilter } from "@/components/filters/multi-select-filter";
import { RecordFormDialog } from "@/components/forms/record-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  companyTitleCategory,
  JOINT_STOCK_COMPANY_TITLE,
  LIMITED_COMPANY_TITLE,
  SOLE_PROPRIETORSHIP_TITLE,
  UNKNOWN_COMPANY_TITLE,
} from "@/lib/company-title";
import { exportRecords } from "@/lib/excel/records";
import {
  contactsForRecord,
  recordMatchesContactFilter,
  UNASSIGNED_CONTACT_FILTER_VALUE,
} from "@/lib/records";
import { createClient } from "@/lib/supabase/client";
import { normalizeText } from "@/lib/utils";
import {
  AUTHORIZATION_DOCUMENT_RECEIVED,
  countRecordsByVoteStatus,
} from "@/lib/vote-status";
import type { AppRole, ContactPerson, FurnitureRecord } from "@/types/app";

const textFilter: FilterFn<FurnitureRecord> = (row, columnId, value) =>
  normalizeText(row.getValue(columnId)).includes(normalizeText(value));

const multiFilter: FilterFn<FurnitureRecord> = (row, columnId, value: string[]) =>
  !value?.length || value.includes(String(row.getValue(columnId) ?? ""));

const contactFilter: FilterFn<FurnitureRecord> = (row, _columnId, value: string[]) =>
  recordMatchesContactFilter(row.original, value ?? []);

function contactAt(record: FurnitureRecord, position: number) {
  return (
    record.record_contacts.find((item) => item.position === position)?.contact_people?.display_name ??
    ""
  );
}

const colorLabels = {
  yellow: "Sarı",
  green: "Yeşil",
  red: "Kırmızı",
  "": "Renksiz",
} as const;

function rowColorClasses(color: FurnitureRecord["row_color"]) {
  if (color === "yellow") {
    return "border-l-4 border-l-yellow-500 bg-yellow-100 hover:bg-yellow-200";
  }
  if (color === "green") {
    return "border-l-4 border-l-green-600 bg-green-100 hover:bg-green-200";
  }
  if (color === "red") {
    return "border-l-4 border-l-red-600 bg-red-100 hover:bg-red-200";
  }
  return "hover:bg-muted/50";
}

function ColorMenu({
  record,
  loading,
  onChange,
}: {
  record: FurnitureRecord;
  loading: boolean;
  onChange: (record: FurnitureRecord, color: FurnitureRecord["row_color"]) => void;
}) {
  const options = [
    { value: null, label: "Renksiz", dot: "bg-white border" },
    { value: "yellow", label: "Sarı", dot: "bg-yellow-400" },
    { value: "green", label: "Yeşil", dot: "bg-green-600" },
    { value: "red", label: "Kırmızı", dot: "bg-red-600" },
  ] as const;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 md:h-9 md:w-9"
          disabled={loading}
          title="Satır rengini değiştir"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-44 rounded-md border bg-background p-1 shadow-lg"
          align="end"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.label}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm outline-none hover:bg-muted"
              onSelect={() => onChange(record, option.value)}
            >
              <span className={`h-4 w-4 rounded-full ${option.dot}`} />
              <span className="flex-1">{option.label}</span>
              {(record.row_color ?? null) === option.value && <Check className="h-4 w-4" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SortHeader({ label, column }: { label: string; column: any }) {
  const sorted = column.getIsSorted();
  return (
    <button
      className="flex w-full items-center gap-1 text-left font-semibold hover:text-primary"
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}

function makeColumn(
  id: keyof FurnitureRecord,
  label: string,
  size: number,
  cell?: ColumnDef<FurnitureRecord>["cell"],
): ColumnDef<FurnitureRecord> {
  return {
    id,
    accessorKey: id,
    header: ({ column }) => <SortHeader label={label} column={column} />,
    size,
    filterFn: textFilter,
    cell:
      cell ??
      (({ getValue }) => (
        <span className="whitespace-pre-line">{String(getValue() ?? "")}</span>
      )),
  };
}

export function RecordsTable({
  records,
  contacts,
  role,
  canExport,
  loading,
  onRefresh,
}: {
  records: FurnitureRecord[];
  contacts: ContactPerson[];
  role: AppRole;
  canExport: boolean;
  loading: boolean;
  onRefresh: () => void;
}) {
  const editable = role === "admin" || role === "editor";
  const isAnonymous = !canExport;
  const publicHiddenColumns: VisibilityState = isAnonymous
    ? {
        member_registry_no: false,
        trade_registry_no: false,
        officials: false,
        origin: false,
        vote_status: false,
        contact_1: false,
        contact_2: false,
        contact_3: false,
        contact_4: false,
        notes: false,
        street: false,
        registered_address: false,
        phone_numbers: false,
      }
    : {};
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "display_order", desc: false }]);
  const [visibility, setVisibility] = useState<VisibilityState>({
    ...publicHiddenColumns,
    contact_owner: false,
    row_color_filter: false,
    title_type_filter: false,
  });
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<FurnitureRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [coloringId, setColoringId] = useState<string | null>(null);
  const [giftingId, setGiftingId] = useState<string | null>(null);
  const contactColumnCount = useMemo(
    () =>
      Math.max(
        4,
        ...records.flatMap((record) =>
          record.record_contacts.map((contact) => contact.position),
        ),
      ),
    [records],
  );
  const colorCounts = useMemo(
    () =>
      records.reduce(
        (counts, record) => {
          counts[record.row_color ?? "none"] += 1;
          return counts;
        },
        { red: 0, yellow: 0, green: 0, none: 0 },
      ),
    [records],
  );
  const authorizationDocumentCount = useMemo(
    () => countRecordsByVoteStatus(records, AUTHORIZATION_DOCUMENT_RECEIVED),
    [records],
  );

  useEffect(() => {
    const raw = localStorage.getItem("records-table-preferences");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { visibility?: VisibilityState; pageSize?: number };
      if (saved.visibility) {
        setVisibility({
          ...saved.visibility,
          ...publicHiddenColumns,
          contact_owner: false,
          row_color_filter: false,
          title_type_filter: false,
        });
      }
      if ([25, 50, 100].includes(saved.pageSize ?? 0)) {
        setPagination((current) => ({ ...current, pageSize: saved.pageSize! }));
      }
    } catch {
      localStorage.removeItem("records-table-preferences");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "records-table-preferences",
      JSON.stringify({ visibility, pageSize: pagination.pageSize }),
    );
  }, [visibility, pagination.pageSize]);

  const columns = useMemo<ColumnDef<FurnitureRecord>[]>(
    () => [
      makeColumn("display_order", "Sıra", 70),
      makeColumn("member_registry_no", "Üye Sicil No", 115),
      makeColumn("trade_registry_no", "Ticaret Sicil No", 125),
      makeColumn("profession_group", "Meslek Grubu", 210),
      {
        ...makeColumn("status", "Durumu", 100, ({ getValue }) => (
          <Badge variant={getValue() === "Faal" ? "default" : "secondary"}>
            {String(getValue())}
          </Badge>
        )),
        filterFn: multiFilter,
      },
      makeColumn("title", "Unvan", 360, ({ getValue }) => (
        <span className="line-clamp-2 font-medium">{String(getValue())}</span>
      )),
      {
        id: "title_type_filter",
        accessorFn: (record) =>
          companyTitleCategory(record.title, record.officials),
        header: "Ünvan Türü",
        filterFn: multiFilter,
        enableHiding: false,
      },
      makeColumn("officials", "Yetkililer", 210, ({ getValue }) => (
        <span className="whitespace-pre-line">{String(getValue() ?? "")}</span>
      )),
      { ...makeColumn("origin", "KÖKEN", 120), filterFn: multiFilter },
      { ...makeColumn("vote_status", "OY DURUMU", 130), filterFn: multiFilter },
      {
        ...makeColumn("gift", "Hediye", 90, ({ row }) => (
          <input
            type="checkbox"
            checked={Boolean(row.original.gift)}
            disabled={!editable || giftingId === row.original.id}
            className="h-5 w-5 cursor-pointer rounded border accent-primary disabled:cursor-default"
            aria-label={`${row.original.title} hediye durumu`}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) =>
              void changeGift(row.original, event.target.checked)
            }
          />
        )),
        enableColumnFilter: false,
      },
      ...Array.from({ length: contactColumnCount }, (_, index) => index + 1).map(
        (position): ColumnDef<FurnitureRecord> => ({
          id: `contact_${position}`,
          accessorFn: (record) => contactAt(record, position),
          header: ({ column }) => <SortHeader label={`TEMAS ${position}`} column={column} />,
          size: 160,
          filterFn: textFilter,
        }),
      ),
      makeColumn("notes", "NOTLAR", 300, ({ getValue }) => (
        <span className="line-clamp-3 whitespace-pre-line">{String(getValue() ?? "")}</span>
      )),
      { ...makeColumn("district", "MAHALLE", 160), filterFn: multiFilter },
      makeColumn("street", "CADDE", 190),
      makeColumn("registered_address", "Tescil Adresi", 360, ({ getValue }) => (
        <span className="line-clamp-3">{String(getValue())}</span>
      )),
      makeColumn("phone_numbers", "Telefon Numaraları", 270, ({ getValue }) => (
        <span className="line-clamp-4 whitespace-pre-line">{String(getValue())}</span>
      )),
      {
        id: "contact_owner",
        accessorFn: (record) => record.record_contacts.map((item) => item.contact_person_id),
        header: "Temas sorumlusu",
        filterFn: contactFilter,
        enableHiding: false,
      },
      {
        id: "row_color_filter",
        accessorFn: (record) => record.row_color ?? "",
        header: "Satır rengi",
        filterFn: multiFilter,
        enableHiding: false,
      },
      {
        id: "actions",
        header: "İşlem",
        enableSorting: false,
        enableHiding: false,
        size: 150,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              title={editable ? "Düzenle" : "Görüntüle"}
              onClick={() => {
                setSelected(row.original);
                setDialogOpen(true);
              }}
            >
              {editable ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {editable && (
              <>
                <ColorMenu
                  record={row.original}
                  loading={coloringId === row.original.id}
                  onChange={(record, color) => void changeColor(record, color)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  title="Sil"
                  disabled={deletingId === row.original.id}
                  onClick={() => void remove(row.original)}
                >
                  {deletingId === row.original.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [editable, deletingId, coloringId, giftingId, contactColumnCount],
  );

  const table = useReactTable({
    data: records,
    columns,
    state: { globalFilter, columnFilters, sorting, columnVisibility: visibility, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _columnId, value) => {
      const search = normalizeText(value);
      if (!search) return true;
      const record = row.original;
      const haystack = normalizeText(
        [
          record.display_order,
          record.member_registry_no,
          record.trade_registry_no,
          record.profession_group,
          record.status,
          record.title,
          record.officials,
          record.origin,
          record.vote_status,
          record.gift ? "hediye" : "",
          ...contactsForRecord(record),
          record.notes,
          record.district,
          record.street,
          record.registered_address,
          record.phone_numbers,
        ].join(" "),
      );
      return haystack.includes(search);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const optionsFor = (key: keyof FurnitureRecord) =>
    Array.from(new Set(records.map((record) => String(record[key] ?? "")))).sort((a, b) =>
      a.localeCompare(b, "tr"),
    );

  async function remove(record: FurnitureRecord) {
    if (!window.confirm(`${record.member_registry_no} sicil numaralı kayıt arşive taşınsın mı?`)) return;
    setDeletingId(record.id);
    const { error } = await createClient().rpc("soft_delete_record", {
      p_id: record.id,
      p_expected_version: record.version,
    });
    setDeletingId(null);
    if (error) {
      toast.error(
        error.code === "40001" || error.message.includes("VERSION_CONFLICT")
          ? "Kayıt değişmiş; liste yenilendi."
          : "Kayıt silinemedi.",
      );
      onRefresh();
      return;
    }
    toast.success("Kayıt arşive taşındı.");
    onRefresh();
  }

  async function changeColor(
    record: FurnitureRecord,
    color: FurnitureRecord["row_color"],
  ) {
    if (record.row_color === color) return;
    setColoringId(record.id);
    const { error } = await createClient().rpc("set_record_color", {
      p_id: record.id,
      p_expected_version: record.version,
      p_row_color: color,
    });
    setColoringId(null);
    if (error) {
      toast.error(
        error.code === "40001" || error.message.includes("VERSION_CONFLICT")
          ? "Kayıt başka bir kullanıcı tarafından değiştirildi; liste yenilendi."
          : `Satır rengi değiştirilemedi: ${error.message}`,
      );
      onRefresh();
      return;
    }
    toast.success(`Satır rengi ${color ? colorLabels[color] : "Renksiz"} olarak değiştirildi.`);
    onRefresh();
  }

  async function changeGift(record: FurnitureRecord, gift: boolean) {
    if (record.gift === gift) return;
    setGiftingId(record.id);
    const { error } = await createClient().rpc("set_record_gift", {
      p_id: record.id,
      p_expected_version: record.version,
      p_gift: gift,
    });
    setGiftingId(null);
    if (error) {
      toast.error(
        error.code === "40001" || error.message.includes("VERSION_CONFLICT")
          ? "Kayıt başka bir kullanıcı tarafından değiştirildi; liste yenilendi."
          : `Hediye durumu değiştirilemedi: ${error.message}`,
      );
      onRefresh();
      return;
    }
    toast.success(gift ? "Hediye işaretlendi." : "Hediye işareti kaldırıldı.");
    onRefresh();
  }

  const filterValue = (id: string) => (table.getColumn(id)?.getFilterValue() as string[]) ?? [];
  const filteredRecords = table.getFilteredRowModel().rows.map((row) => row.original);
  const sortedFilteredRecords = table.getSortedRowModel().rows.map((row) => row.original);

  const renderMultiFilters = () => (
    <>
      {!isAnonymous && (
        <MultiSelectFilter
          label="Firma Türü"
          options={[
            {
              value: SOLE_PROPRIETORSHIP_TITLE,
              label: "Şahıs Firması (Tahmini)",
            },
            {
              value: LIMITED_COMPANY_TITLE,
              label: "Limited Şirket",
            },
            { value: JOINT_STOCK_COMPANY_TITLE, label: "Anonim Şirket" },
            { value: UNKNOWN_COMPANY_TITLE, label: "Bilinmeyen" },
          ]}
          value={filterValue("title_type_filter")}
          onChange={(value) =>
            table.getColumn("title_type_filter")?.setFilterValue(value)
          }
        />
      )}
      <MultiSelectFilter
        label="Durumu"
        options={optionsFor("status")}
        value={filterValue("status")}
        onChange={(value) => table.getColumn("status")?.setFilterValue(value)}
      />
      {!isAnonymous && (
        <>
          <MultiSelectFilter
            label="Oy Durumu"
            options={optionsFor("vote_status")}
            value={filterValue("vote_status")}
            onChange={(value) => table.getColumn("vote_status")?.setFilterValue(value)}
          />
          <MultiSelectFilter
            label="Köken"
            options={optionsFor("origin")}
            value={filterValue("origin")}
            onChange={(value) => table.getColumn("origin")?.setFilterValue(value)}
          />
        </>
      )}
      <MultiSelectFilter
        label="Mahalle"
        options={optionsFor("district")}
        value={filterValue("district")}
        onChange={(value) => table.getColumn("district")?.setFilterValue(value)}
      />
      {!isAnonymous && (
        <MultiSelectFilter
          label="Temas sorumlusu"
          options={[
            {
              value: UNASSIGNED_CONTACT_FILTER_VALUE,
              label: "Temas atanmamış",
            },
            ...contacts.map((contact) => ({
              value: contact.id,
              label: contact.display_name,
            })),
          ]}
          value={filterValue("contact_owner")}
          onChange={(value) => table.getColumn("contact_owner")?.setFilterValue(value)}
        />
      )}
      <MultiSelectFilter
        label="Satır rengi"
        options={[
          { value: "yellow", label: "Sarı" },
          { value: "green", label: "Yeşil" },
          { value: "red", label: "Kırmızı" },
          { value: "", label: "Renksiz" },
        ]}
        value={filterValue("row_color_filter")}
        onChange={(value) => table.getColumn("row_color_filter")?.setFilterValue(value)}
      />
    </>
  );

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-6 md:gap-2">
          <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 shadow-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" />
            <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              Kırmızı
            </span>
            <span className="text-sm font-bold tabular-nums text-red-700">
              {colorCounts.red}
            </span>
          </div>
          <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 shadow-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-400" />
            <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              Sarı
            </span>
            <span className="text-sm font-bold tabular-nums text-yellow-700">
              {colorCounts.yellow}
            </span>
          </div>
          <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 shadow-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-600" />
            <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              Yeşil
            </span>
            <span className="text-sm font-bold tabular-nums text-green-700">
              {colorCounts.green}
            </span>
          </div>
          <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 shadow-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full border bg-muted" />
            <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              Renksiz
            </span>
            <span className="text-sm font-bold tabular-nums">
              {colorCounts.none}
            </span>
          </div>
          <div className="col-span-2 flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 shadow-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
            <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              Yetki Belgesi Alındı
            </span>
            <span className="text-sm font-bold tabular-nums text-blue-700">
              {authorizationDocumentCount}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Tüm kayıtlarda ara..."
            />
          </div>
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {renderMultiFilters()}
          </div>
          <details className="w-full rounded-md border bg-background md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
              <Filter className="h-4 w-4" />
              Filtreler
              {columnFilters.length > 0 && (
                <Badge variant="secondary">{columnFilters.length}</Badge>
              )}
              <ChevronDown className="ml-auto h-4 w-4" />
            </summary>
            <div className="flex flex-wrap gap-2 border-t p-3">
              {renderMultiFilters()}
            </div>
          </details>
          {!isAnonymous && <div className="hidden md:block">
          {canExport && <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="h-4 w-4" />
                Sütunlar
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 max-h-96 overflow-y-auto rounded-md border bg-background p-1 shadow-lg">
                {table
                  .getAllLeafColumns()
                  .filter(
                    (column) =>
                      column.getCanHide() &&
                      ![
                        "contact_owner",
                        "row_color_filter",
                        "title_type_filter",
                      ].includes(column.id),
                  )
                  .map((column) => (
                    <DropdownMenu.CheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                      onSelect={(event) => event.preventDefault()}
                      className="relative cursor-pointer rounded py-2 pl-8 pr-3 text-sm outline-none hover:bg-muted"
                    >
                      {column.getIsVisible() && <Check className="absolute left-2 top-2.5 h-4 w-4" />}
                      {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
                    </DropdownMenu.CheckboxItem>
                  ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>}
          </div>}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                Excel
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 rounded-md border bg-background p-1 shadow-lg" align="end">
                <DropdownMenu.Item
                  className="flex cursor-pointer gap-2 rounded px-3 py-2 text-sm outline-none hover:bg-muted"
                  onSelect={() => exportRecords(records, "mobilya-takip-tum")}
                >
                  <FileDown className="h-4 w-4" /> Tüm kayıtları indir
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer gap-2 rounded px-3 py-2 text-sm outline-none hover:bg-muted"
                  onSelect={() => exportRecords(sortedFilteredRecords, "mobilya-takip-filtreli")}
                >
                  <FileDown className="h-4 w-4" /> Filtrelenenleri indir
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <Button variant="ghost" size="icon" onClick={onRefresh} title="Yenile">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {editable && (
            <Button
              size="sm"
              onClick={() => {
                setSelected(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Yeni kayıt
            </Button>
          )}
        </div>

        <div className="rounded-lg border bg-background shadow-sm">
          <div className="hidden max-h-[calc(100vh-17rem)] overflow-auto md:block">
            <table className="w-full min-w-[2900px] border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers
                      .filter(
                        (header) =>
                          ![
                            "contact_owner",
                            "row_color_filter",
                            "title_type_filter",
                          ].includes(header.column.id),
                      )
                      .map((header) => (
                        <th
                          key={header.id}
                          style={{ width: header.getSize() }}
                          className="border-b border-r px-3 py-3 text-left align-top"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanFilter() &&
                            !["status", "vote_status", "origin", "district"].includes(
                              header.column.id,
                            ) && (
                              <Input
                                className="mt-2 h-8 bg-background font-normal"
                                value={String(header.column.getFilterValue() ?? "")}
                                onChange={(event) => header.column.setFilterValue(event.target.value)}
                                placeholder="Filtrele"
                                onClick={(event) => event.stopPropagation()}
                              />
                            )}
                        </th>
                      ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b align-top ${rowColorClasses(row.original.row_color)}`}
                  >
                    {row
                      .getVisibleCells()
                      .filter(
                        (cell) =>
                          ![
                            "contact_owner",
                            "row_color_filter",
                            "title_type_filter",
                          ].includes(cell.column.id),
                      )
                      .map((cell) => (
                        <td
                          key={cell.id}
                          className={`max-w-md border-r px-3 py-3 ${
                            editable && cell.column.id !== "actions"
                              ? "cursor-pointer transition-colors hover:bg-primary/5"
                              : ""
                          }`}
                          title={
                            editable && cell.column.id !== "actions"
                              ? "Kaydı düzenlemek için tıklayın"
                              : undefined
                          }
                          onClick={() => {
                            if (!editable || cell.column.id === "actions") return;
                            setSelected(row.original);
                            setDialogOpen(true);
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                  </tr>
                ))}
                {!table.getRowModel().rows.length && (
                  <tr>
                    <td colSpan={19} className="p-12 text-center text-muted-foreground">
                      Filtrelere uygun kayıt bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {table.getRowModel().rows.map((row) => {
              const record = row.original;
              const recordContactEntries = [...record.record_contacts]
                .sort((left, right) => left.position - right.position)
                .map((contact) => ({
                  position: contact.position,
                  name: contact.contact_people?.display_name ?? "",
                }))
                .filter((contact) => contact.name);
              const recordContacts = recordContactEntries.map((contact) => contact.name);
              return (
                <article
                  key={record.id}
                  className={`rounded-lg border p-4 shadow-sm transition-colors ${rowColorClasses(record.row_color)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        #{record.display_order} · Üye Sicil {record.member_registry_no}
                      </p>
                      <h2 className="mt-1 break-words font-semibold">{record.title}</h2>
                    </div>
                    <Badge variant={record.status === "Faal" ? "default" : "secondary"}>
                      {record.status}
                    </Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-x-2 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Mahalle</dt>
                    <dd>{record.district || "—"}</dd>
                    <dt className="text-muted-foreground">Temas</dt>
                    <dd>{recordContacts.join(", ") || "—"}</dd>
                    <dt className="text-muted-foreground">Telefon</dt>
                    <dd className="whitespace-pre-wrap break-words">
                      {record.phone_numbers || "—"}
                    </dd>
                    <dt className="text-muted-foreground">Renk</dt>
                    <dd>{colorLabels[record.row_color ?? ""]}</dd>
                    <dt className="text-muted-foreground">Hediye</dt>
                    <dd className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(record.gift)}
                        disabled={!editable || giftingId === record.id}
                        className="h-5 w-5 cursor-pointer rounded border accent-primary disabled:cursor-default"
                        aria-label={`${record.title} hediye durumu`}
                        onChange={(event) =>
                          void changeGift(record, event.target.checked)
                        }
                      />
                      <span>{record.gift ? "Evet" : "Hayır"}</span>
                    </dd>
                  </dl>
                  {!isAnonymous && (
                    <details className="group mt-4 border-t pt-3">
                      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-md px-2 text-sm font-medium hover:bg-background/60">
                        <span className="group-open:hidden">Tüm bilgileri göster</span>
                        <span className="hidden group-open:inline">Bilgileri gizle</span>
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <dl className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-2 gap-y-3 rounded-md bg-background/55 p-3 text-sm">
                        <dt className="text-muted-foreground">Ticaret Sicil</dt>
                        <dd className="break-words">{record.trade_registry_no || "—"}</dd>
                        <dt className="text-muted-foreground">Meslek Grubu</dt>
                        <dd className="break-words">{record.profession_group || "—"}</dd>
                        <dt className="text-muted-foreground">Yetkililer</dt>
                        <dd className="whitespace-pre-wrap break-words">
                          {record.officials || "—"}
                        </dd>
                        <dt className="text-muted-foreground">Köken</dt>
                        <dd className="break-words">{record.origin || "—"}</dd>
                        <dt className="text-muted-foreground">Oy Durumu</dt>
                        <dd className="break-words">{record.vote_status || "—"}</dd>
                        {recordContactEntries.map((contact) => (
                          <div key={`${record.id}-${contact.position}`} className="contents">
                            <dt className="text-muted-foreground">
                              TEMAS {contact.position}
                            </dt>
                            <dd className="break-words">{contact.name}</dd>
                          </div>
                        ))}
                        <dt className="text-muted-foreground">Notlar</dt>
                        <dd className="whitespace-pre-wrap break-words">
                          {record.notes || "—"}
                        </dd>
                        <dt className="text-muted-foreground">Cadde</dt>
                        <dd className="break-words">{record.street || "—"}</dd>
                        <dt className="text-muted-foreground">Tescil Adresi</dt>
                        <dd className="whitespace-pre-wrap break-words">
                          {record.registered_address || "—"}
                        </dd>
                      </dl>
                    </details>
                  )}
                  <div className="mt-4 flex justify-end gap-2 border-t pt-3">
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => {
                        setSelected(record);
                        setDialogOpen(true);
                      }}
                    >
                      {editable ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {editable ? "Düzenle" : "Ayrıntı"}
                    </Button>
                    {editable && (
                      <>
                        <ColorMenu
                          record={record}
                          loading={coloringId === record.id}
                          onChange={(target, color) => void changeColor(target, color)}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          title="Sil"
                          disabled={deletingId === record.id}
                          onClick={() => void remove(record)}
                        >
                          {deletingId === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            {!table.getRowModel().rows.length && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Filtrelere uygun kayıt bulunamadı.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm">
            <p className="text-muted-foreground">
              {filteredRecords.length} kayıt · Sayfa {table.getState().pagination.pageIndex + 1}/
              {Math.max(table.getPageCount(), 1)}
            </p>
            <div className="flex items-center gap-2">
              <select
                className="h-9 rounded-md border bg-background px-2"
                value={pagination.pageSize}
                onChange={(event) => table.setPageSize(Number(event.target.value))}
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size} / sayfa</option>
                ))}
              </select>
              <Button className="h-11 md:h-9" variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                Önceki
              </Button>
              <Button className="h-11 md:h-9" variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Sonraki
              </Button>
            </div>
          </div>
        </div>
      </div>
      <RecordFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={selected}
        contacts={contacts}
        role={role}
      />
    </>
  );
}
