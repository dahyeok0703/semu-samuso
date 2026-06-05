"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Download, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bulkImportClientsAction, type BulkImportResult } from "@/lib/clients/actions";
import { formatBizRegNo } from "@/lib/clients/biz-reg-no";
import { CLIENT_STATUS_LABELS, TAX_TYPE_LABELS } from "@/lib/clients/constants";
import { downloadClientTemplate, parseClientsFile } from "@/lib/clients/excel";
import { bulkClientRowSchema, type ClientFormValues } from "@/lib/clients/schemas";

type ReviewRow = {
  rowNumber: number;
  values: ClientFormValues;
  errors: string[];
};

export function ImportWizard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"select" | "review" | "result">("select");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [isSubmitting, startTransition] = useTransition();

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidCount = rows.length - validRows.length;

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const raw = await parseClientsFile(file);
      if (raw.length === 0) {
        toast.error("데이터 행을 찾지 못했습니다. 템플릿 형식을 확인해 주세요.");
        return;
      }
      const reviewed: ReviewRow[] = raw.map((r) => {
        const parsed = bulkClientRowSchema.safeParse(r.values);
        if (parsed.success) {
          return { rowNumber: r.rowNumber, values: parsed.data, errors: [] };
        }
        const errors = parsed.error.errors.map((e) => e.message);
        return { rowNumber: r.rowNumber, values: r.values, errors };
      });
      setFileName(file.name);
      setRows(reviewed);
      setPhase("review");
    } catch {
      toast.error("파일을 읽지 못했습니다. .xlsx 형식인지 확인해 주세요.");
    } finally {
      setParsing(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  function submit() {
    if (validRows.length === 0) return;
    startTransition(async () => {
      const res = await bulkImportClientsAction({ rows: validRows.map((r) => r.values) });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setResult(res.data);
      setPhase("result");
      if (res.data.inserted > 0) {
        toast.success(`${res.data.inserted}건을 등록했습니다.`);
        router.refresh();
      }
    });
  }

  function reset() {
    setPhase("select");
    setRows([]);
    setResult(null);
    setFileName(null);
  }

  // --- Phase: select ---
  if (phase === "select") {
    return (
      <div className="space-y-6">
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            { n: 1, t: "템플릿 다운로드", d: "열 형식에 맞춰 거래처를 입력합니다." },
            { n: 2, t: "파일 업로드", d: "작성한 엑셀을 올리면 행별로 검증합니다." },
            { n: 3, t: "검토 후 등록", d: "유효한 행만 일괄 등록합니다." },
          ].map((s) => (
            <li key={s.n} className="rounded-xl border p-4">
              <div className="mb-1 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {s.n}
              </div>
              <p className="text-sm font-medium">{s.t}</p>
              <p className="text-xs text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-3 rounded-xl border border-dashed p-8 text-center">
          <FileUp className="mx-auto size-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">엑셀 파일(.xlsx)을 업로드하세요</p>
            <p className="text-xs text-muted-foreground">
              먼저 템플릿을 내려받아 작성하면 정확합니다.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            aria-label="엑셀 파일 선택"
            onChange={onInputChange}
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={() => downloadClientTemplate()}>
              <Download className="size-4" /> 템플릿 다운로드
            </Button>
            <Button onClick={() => inputRef.current?.click()} disabled={parsing}>
              <Upload className="size-4" /> {parsing ? "읽는 중…" : "파일 선택"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Phase: result ---
  if (phase === "result" && result) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border p-4">
          <CheckCircle2 className="size-8 text-emerald-500" />
          <div>
            <p className="font-medium">{result.inserted}건 등록 완료</p>
            {result.failed.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {result.failed.length}건은 등록되지 않았습니다.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">모든 행이 등록되었습니다.</p>
            )}
          </div>
        </div>

        {result.failed.length > 0 ? (
          <div className="rounded-xl border">
            <div className="border-b p-3 text-sm font-medium">등록 실패 항목</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>상호</TableHead>
                  <TableHead>사유</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.failed.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell>{f.biz_name || "(상호 없음)"}</TableCell>
                    <TableCell className="text-destructive">{f.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button asChild>
            <Link href="/clients">거래처 목록으로</Link>
          </Button>
          <Button variant="outline" onClick={reset}>
            다른 파일 등록
          </Button>
        </div>
      </div>
    );
  }

  // --- Phase: review ---
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{fileName}</span>
          <Badge variant="success">유효 {validRows.length}</Badge>
          {invalidCount > 0 ? <Badge variant="destructive">오류 {invalidCount}</Badge> : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>
            다시 선택
          </Button>
          <Button onClick={submit} disabled={validRows.length === 0 || isSubmitting}>
            {isSubmitting ? "등록 중…" : `유효한 ${validRows.length}건 등록`}
          </Button>
        </div>
      </div>

      {invalidCount > 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <AlertCircle className="size-4 text-amber-500" />
          오류가 있는 {invalidCount}개 행은 등록에서 제외됩니다. 수정 후 다시 업로드하세요.
        </p>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">행</TableHead>
              <TableHead>상호</TableHead>
              <TableHead className="hidden md:table-cell">사업자번호</TableHead>
              <TableHead className="hidden lg:table-cell">과세유형</TableHead>
              <TableHead className="hidden lg:table-cell">상태</TableHead>
              <TableHead>검증</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const ok = r.errors.length === 0;
              return (
                <TableRow key={r.rowNumber} className={ok ? undefined : "bg-destructive/5"}>
                  <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                  <TableCell className="font-medium">{r.values.biz_name || "—"}</TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">
                    {r.values.biz_reg_no ? formatBizRegNo(r.values.biz_reg_no) : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {r.values.tax_type ? TAX_TYPE_LABELS[r.values.tax_type] : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {CLIENT_STATUS_LABELS[r.values.status]}
                  </TableCell>
                  <TableCell>
                    {ok ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="size-3.5" /> 정상
                      </span>
                    ) : (
                      <span className="text-xs text-destructive">{r.errors.join(" · ")}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
