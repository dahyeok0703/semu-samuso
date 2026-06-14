"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importErpClientsAction } from "@/lib/integrations/erp-import/actions";

/**
 * 더존 스마트A · 세무사랑Pro 등에서 내보낸 거래처 파일(xlsx/csv)을 가져온다. 파일은
 * 브라우저에서 행으로 파싱해 서버 액션으로 전달하고, 서버가 헤더를 정규화·검증한 뒤
 * 기존 일괄 등록 경로로 적재한다.
 */
export function ErpImportButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      const parsed = sheet
        ? (XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Array<Record<string, unknown>>)
        : [];
      setRows(parsed);
      setFileName(file.name);
    } catch {
      toast.error("파일을 읽지 못했습니다. xlsx 또는 csv 파일인지 확인해 주세요.");
    }
  }

  function submit() {
    if (rows.length === 0) return;
    startTransition(async () => {
      const res = await importErpClientsAction({ rows });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        `${res.data.imported}건을 가져왔습니다.` +
          (res.data.skipped ? ` (건너뜀 ${res.data.skipped})` : "") +
          (res.data.failed ? ` (실패 ${res.data.failed})` : ""),
      );
      setOpen(false);
      setRows([]);
      setFileName(null);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="size-4" /> ERP 가져오기
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ERP 거래처 가져오기</DialogTitle>
          <DialogDescription>
            더존 스마트A·세무사랑Pro 등에서 내보낸 거래처 파일(xlsx/csv)을 선택하세요. ‘상호’,
            ‘사업자등록번호’ 등 헤더를 자동으로 인식합니다.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />

        {fileName ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{fileName}</span> — {rows.length}행 감지됨
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            취소
          </Button>
          <Button onClick={submit} disabled={isPending || rows.length === 0}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null} 가져오기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
