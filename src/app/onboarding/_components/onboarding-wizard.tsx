"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarPlus, Check, FileSpreadsheet, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bulkImportClientsAction, createClientAction } from "@/lib/clients/actions";
import { TAX_TYPE_LABELS, TAX_TYPE_OPTIONS } from "@/lib/clients/constants";
import { downloadClientTemplate, parseClientsFile } from "@/lib/clients/excel";
import { bulkClientRowSchema } from "@/lib/clients/schemas";
import {
  FILING_SCHEDULE_DISCLAIMER,
  generateFilingTasks,
  toClientForRules,
} from "@/lib/filing-rules/engine";
import { generateWorkspaceScheduleAction } from "@/lib/filings/actions";
import { finishOnboardingAction, updateOfficeInfoAction } from "@/lib/onboarding/actions";
import type { Client, TaxType } from "@/types/database.types";

const STEPS = ["사무소 정보", "거래처 추가", "신고 일정", "완료"] as const;
const TAX_NONE = "none";

export function OnboardingWizard({
  initialOffice,
  clients,
  year,
}: {
  initialOffice: { name: string; ownerName: string };
  clients: Client[];
  year: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [finishing, startFinish] = useTransition();

  function finish(skipped: boolean) {
    startFinish(async () => {
      await finishOnboardingAction({ skipped });
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <span className="font-semibold">시작하기</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => finish(true)} disabled={finishing}>
          건너뛰기
        </Button>
      </div>

      {/* Progress */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {step}/{STEPS.length} · {STEPS[step - 1]}
          </span>
          <span>{Math.round((step / STEPS.length) * 100)}%</span>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        {step === 1 ? (
          <StepOffice initial={initialOffice} onNext={() => setStep(2)} />
        ) : step === 2 ? (
          <StepClients clients={clients} onBack={() => setStep(1)} onNext={() => setStep(3)} />
        ) : step === 3 ? (
          <StepSchedule
            clients={clients}
            year={year}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        ) : (
          <StepDone onFinish={() => finish(false)} finishing={finishing} />
        )}
      </div>
    </div>
  );
}

// --- Step 1: office info ----------------------------------------------------
function StepOffice({
  initial,
  onNext,
}: {
  initial: { name: string; ownerName: string };
  onNext: () => void;
}) {
  const router = useRouter();
  const [officeName, setOfficeName] = useState(initial.name === "내 사무소" ? "" : initial.name);
  const [ownerName, setOwnerName] = useState(initial.ownerName);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateOfficeInfoAction({ officeName, ownerName });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      router.refresh();
      onNext();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">사무소 정보를 알려주세요</h2>
      </div>
      <div className="space-y-2">
        <Label htmlFor="officeName">사무소 이름</Label>
        <Input
          id="officeName"
          value={officeName}
          onChange={(e) => setOfficeName(e.target.value)}
          placeholder="예) 가나다 세무회계"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerName">대표자 이름</Label>
        <Input id="ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !officeName.trim() || !ownerName.trim()}>
          {isPending ? "저장 중…" : "다음"}
        </Button>
      </div>
    </form>
  );
}

// --- Step 2: add clients ----------------------------------------------------
function StepClients({
  clients,
  onBack,
  onNext,
}: {
  clients: Client[];
  onBack: () => void;
  onNext: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [bizName, setBizName] = useState("");
  const [taxType, setTaxType] = useState<string>(TAX_NONE);
  const [isPending, startTransition] = useTransition();
  const [importing, setImporting] = useState(false);

  function addOne(e: React.FormEvent) {
    e.preventDefault();
    if (!bizName.trim()) return;
    startTransition(async () => {
      const res = await createClientAction({
        biz_name: bizName,
        tax_type: taxType === TAX_NONE ? null : (taxType as TaxType),
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("거래처를 추가했습니다.");
      setBizName("");
      setTaxType(TAX_NONE);
      router.refresh();
    });
  }

  async function onFile(file: File) {
    setImporting(true);
    try {
      const raw = await parseClientsFile(file);
      const valid = raw
        .map((r) => bulkClientRowSchema.safeParse(r.values))
        .filter((r) => r.success)
        .map((r) => (r as { data: unknown }).data);
      if (valid.length === 0) {
        toast.error("유효한 거래처 행을 찾지 못했습니다.");
        return;
      }
      const res = await bulkImportClientsAction({ rows: valid });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        `${res.data.inserted}건을 추가했습니다.${res.data.failed.length ? ` (실패 ${res.data.failed.length})` : ""}`,
      );
      router.refresh();
    } catch {
      toast.error("파일을 읽지 못했습니다.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">거래처를 추가해 보세요</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        한 곳만 추가해도 충분합니다. 나중에 더 늘릴 수 있어요.
      </p>

      <form onSubmit={addOne} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={bizName}
          onChange={(e) => setBizName(e.target.value)}
          placeholder="상호 (예: 가나다상사)"
          aria-label="상호"
        />
        <Select value={taxType} onValueChange={setTaxType}>
          <SelectTrigger className="sm:w-[140px]" aria-label="과세유형">
            <SelectValue placeholder="과세유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TAX_NONE}>과세유형</SelectItem>
            {TAX_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={isPending || !bizName.trim()}>
          추가
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <FileSpreadsheet className="size-4" />
        엑셀로 여러 건:
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => downloadClientTemplate()}
        >
          템플릿
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="sr-only"
          aria-label="엑셀 업로드"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
        >
          <Upload className="size-3.5" /> {importing ? "가져오는 중…" : "업로드"}
        </button>
      </div>

      {clients.length > 0 ? (
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            추가된 거래처 ({clients.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {clients.slice(0, 12).map((c) => (
              <Badge key={c.id} variant="secondary">
                {c.biz_name}
                {c.tax_type ? ` · ${TAX_TYPE_LABELS[c.tax_type]}` : ""}
              </Badge>
            ))}
            {clients.length > 12 ? <Badge variant="muted">외 {clients.length - 12}곳</Badge> : null}
          </div>
        </div>
      ) : null}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          이전
        </Button>
        <Button onClick={onNext} disabled={clients.length === 0}>
          다음
        </Button>
      </div>
    </div>
  );
}

// --- Step 3: schedule preview + generate ------------------------------------
function StepSchedule({
  clients,
  year,
  onBack,
  onNext,
}: {
  clients: Client[];
  year: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const preview = useMemo(() => {
    return clients
      .filter((c) => c.tax_type)
      .map((c) => ({
        client: c,
        tasks: generateFilingTasks(toClientForRules(c), year).slice(0, 6),
      }))
      .filter((p) => p.tasks.length > 0);
  }, [clients, year]);

  const totalTasks = useMemo(
    () =>
      clients
        .filter((c) => c.tax_type)
        .reduce((sum, c) => sum + generateFilingTasks(toClientForRules(c), year).length, 0),
    [clients, year],
  );

  function generate() {
    startTransition(async () => {
      const res = await generateWorkspaceScheduleAction({ year });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`${year}년 신고 일정 ${res.data.created}건을 생성했습니다.`);
      router.refresh();
      onNext();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarPlus className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{year}년 신고 일정 미리보기</h2>
      </div>

      {preview.length === 0 ? (
        <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          과세유형이 설정된 거래처가 없어 미리보기를 만들 수 없습니다. 이전 단계에서 과세유형을
          지정하면 일정이 자동 생성됩니다. 지금은 건너뛰어도 됩니다.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            거래처 속성으로 {totalTasks}건의 신고 마감이 자동 생성됩니다. 일부만 미리 보여드려요.
          </p>
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {preview.map(({ client, tasks }) => (
              <div key={client.id} className="rounded-lg border p-3">
                <p className="mb-1.5 text-sm font-medium">{client.biz_name}</p>
                <ul className="space-y-1">
                  {tasks.map((t) => (
                    <li
                      key={`${t.filingType}-${t.periodLabel}`}
                      className="flex justify-between text-xs"
                    >
                      <span>
                        {t.label} <span className="text-muted-foreground">{t.periodLabel}</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">{t.dueDate}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">⚠ {FILING_SCHEDULE_DISCLAIMER}</p>
        </>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          이전
        </Button>
        {preview.length === 0 ? (
          <Button onClick={onNext}>건너뛰기</Button>
        ) : (
          <Button onClick={generate} disabled={isPending}>
            {isPending ? "생성 중…" : "일정 생성하고 다음"}
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Step 4: done -----------------------------------------------------------
function StepDone({ onFinish, finishing }: { onFinish: () => void; finishing: boolean }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950">
        <Check className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">준비 완료!</h2>
      <p className="text-sm text-muted-foreground">
        거래처와 신고 일정이 준비되었습니다. 대시보드에서 이번 주 마감과 위험 거래처를 확인하세요.
      </p>
      <Button className="w-full" onClick={onFinish} disabled={finishing}>
        {finishing ? "이동 중…" : "대시보드로 이동"}
      </Button>
    </div>
  );
}
