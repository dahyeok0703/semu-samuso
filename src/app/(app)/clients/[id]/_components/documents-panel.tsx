"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOC_TYPE_OPTIONS, type DocType } from "@/lib/ai/doc-types";
import {
  confirmDocumentAction,
  deleteDocumentAction,
  registerDocumentAction,
} from "@/lib/documents/actions";
import type { ClientDocument, TaskOption } from "@/lib/documents/queries";
import { DOCUMENTS_BUCKET } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

const NO_TASK = "none";

type UploadEntry = {
  key: string;
  file: File;
  name: string;
  status: "uploading" | "classifying" | "done" | "error";
  error?: string;
};

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-가-힣]/g, "_").slice(-120);
}

function metaString(meta: ClientDocument["ai_meta"], key: string): string | null {
  const m = (meta ?? {}) as Record<string, unknown>;
  return typeof m[key] === "string" ? (m[key] as string) : null;
}

function DocumentRow({
  doc,
  taskOptions,
  canWrite,
  isOwner,
  aiEnabled,
}: {
  doc: ClientDocument;
  taskOptions: TaskOption[];
  canWrite: boolean;
  isOwner: boolean;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reclassifying, setReclassifying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [docType, setDocType] = useState<DocType>((doc.doc_type as DocType) ?? "other");
  const [taskId, setTaskId] = useState<string>(doc.filing_task_id ?? NO_TASK);

  const fileName = metaString(doc.ai_meta, "file_name") ?? doc.file_path.split("/").pop() ?? "문서";
  const vendor = metaString(doc.ai_meta, "vendor");
  const period = metaString(doc.ai_meta, "period_hint");
  const reasoning = metaString(doc.ai_meta, "reasoning");
  const pending = doc.status === "pending_review";

  function confirm() {
    startTransition(async () => {
      const res = await confirmDocumentAction({
        documentId: doc.id,
        docType,
        taskId: taskId === NO_TASK ? null : taskId,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        res.data.wasCorrected ? "재분류를 확정했습니다 (학습에 반영)." : "확정했습니다.",
      );
      router.refresh();
    });
  }

  async function reclassify() {
    setReclassifying(true);
    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "AI 분류에 실패했습니다.");
      } else {
        toast.success("AI가 다시 분류했습니다.");
        router.refresh();
      }
    } catch {
      toast.error("AI 분류 요청에 실패했습니다.");
    } finally {
      setReclassifying(false);
    }
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteDocumentAction({ documentId: doc.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("자료를 삭제했습니다.");
      router.refresh();
    });
  }

  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{fileName}</span>
            {pending ? (
              <Badge variant="warning">검토 필요</Badge>
            ) : (
              <Badge variant="success">확정</Badge>
            )}
            {doc.classified_by_ai ? (
              <Badge variant="muted" className="gap-1">
                <Sparkles className="size-3" />
                AI{doc.confidence != null ? ` ${Math.round(doc.confidence * 100)}%` : ""}
              </Badge>
            ) : null}
          </div>
          {vendor || period || reasoning ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {[vendor && `발행처 ${vendor}`, period && `귀속 ${period}`, reasoning]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={docType}
            onValueChange={(v) => setDocType(v as DocType)}
            disabled={!canWrite || isPending}
          >
            <SelectTrigger className="h-8 w-[150px]" aria-label="서류 종류">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={taskId} onValueChange={setTaskId} disabled={!canWrite || isPending}>
            <SelectTrigger className="h-8 w-[150px]" aria-label="신고 연결">
              <SelectValue placeholder="신고 연결 안 함" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TASK}>신고 연결 안 함</SelectItem>
              {taskOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canWrite ? (
            <Button size="sm" onClick={confirm} disabled={isPending}>
              {isPending ? "처리 중…" : pending ? "확정" : "재확정"}
            </Button>
          ) : null}

          {aiEnabled && canWrite ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={reclassify}
              disabled={reclassifying}
              aria-label="AI 재분류"
              title="AI 재분류"
            >
              <RefreshCw className={`size-4 ${reclassifying ? "animate-spin" : ""}`} />
            </Button>
          ) : null}

          {isOwner ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label="삭제"
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>자료를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              ‘{fileName}’ 파일과 분류 정보가 삭제됩니다. 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDelete(false);
                remove();
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

export function DocumentsPanel({
  clientId,
  workspaceId,
  documents,
  taskOptions,
  canWrite,
  isOwner,
  aiEnabled,
}: {
  clientId: string;
  workspaceId: string;
  documents: ClientDocument[];
  taskOptions: TaskOption[];
  canWrite: boolean;
  isOwner: boolean;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);

  function update(key: string, patch: Partial<UploadEntry>) {
    setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }

  async function processFile(entry: UploadEntry) {
    const supabase = createClient();
    update(entry.key, { status: "uploading", error: undefined });

    const path = `${workspaceId}/${clientId}/${crypto.randomUUID()}-${sanitizeName(entry.file.name)}`;
    const { error: upErr } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, entry.file, { contentType: entry.file.type || undefined, upsert: false });
    if (upErr) {
      update(entry.key, { status: "error", error: "업로드 실패" });
      return;
    }

    const reg = await registerDocumentAction({
      clientId,
      filePath: path,
      fileName: entry.file.name,
      contentType: entry.file.type || "application/octet-stream",
    });
    if (!reg.ok) {
      update(entry.key, { status: "error", error: reg.error.message });
      return;
    }

    if (aiEnabled) {
      update(entry.key, { status: "classifying" });
      try {
        await fetch("/api/classify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ documentId: reg.data.id }),
        });
      } catch {
        // Classification is best-effort; the doc remains for manual classification.
      }
    }

    update(entry.key, { status: "done" });
    router.refresh();
  }

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const entries: UploadEntry[] = list.map((file) => ({
      key: crypto.randomUUID(),
      file,
      name: file.name,
      status: "uploading",
    }));
    setUploads((prev) => [...entries, ...prev]);
    entries.forEach((e) => void processFile(e));
  }

  return (
    <DocumentsPanelInner
      addFiles={addFiles}
      uploads={uploads}
      retry={(key) => {
        const entry = uploads.find((u) => u.key === key);
        if (entry) void processFile(entry);
      }}
      dragOver={dragOver}
      setDragOver={setDragOver}
      inputRef={inputRef}
      canWrite={canWrite}
      documents={documents}
      taskOptions={taskOptions}
      isOwner={isOwner}
      aiEnabled={aiEnabled}
    />
  );
}

// Split presentational shell so the upload logic above stays readable.
function DocumentsPanelInner({
  addFiles,
  uploads,
  retry,
  dragOver,
  setDragOver,
  inputRef,
  canWrite,
  documents,
  taskOptions,
  isOwner,
  aiEnabled,
}: {
  addFiles: (f: FileList | File[]) => void;
  uploads: UploadEntry[];
  retry: (key: string) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  canWrite: boolean;
  documents: ClientDocument[];
  taskOptions: TaskOption[];
  isOwner: boolean;
  aiEnabled: boolean;
}) {
  return (
    <div className="space-y-4">
      {canWrite ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : ""
          }`}
        >
          <Upload className="size-6 text-muted-foreground" />
          <p className="text-sm">
            파일을 끌어다 놓거나{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => inputRef.current?.click()}
            >
              선택
            </button>
            하세요
          </p>
          <p className="text-xs text-muted-foreground">
            이미지(JPG/PNG) · PDF 지원.{" "}
            {aiEnabled
              ? "업로드 시 AI가 자동 분류합니다."
              : "자동 분류 비활성 — 수동으로 분류하세요."}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="sr-only"
            aria-label="자료 파일 선택"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {uploads.length > 0 ? (
        <ul className="space-y-1">
          {uploads.map((u) => (
            <li
              key={u.key}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 truncate">
                {u.status === "done" ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : u.status === "error" ? (
                  <AlertCircle className="size-4 text-destructive" />
                ) : (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                <span className="truncate">{u.name}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {u.status === "uploading"
                  ? "업로드 중…"
                  : u.status === "classifying"
                    ? "AI 분류 중…"
                    : u.status === "done"
                      ? "완료"
                      : (u.error ?? "실패")}
                {u.status === "error" ? (
                  <button
                    type="button"
                    className="ml-2 font-medium text-primary hover:underline"
                    onClick={() => retry(u.key)}
                  >
                    재시도
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {documents.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          수취한 자료가 없습니다. 위에서 파일을 업로드하세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              taskOptions={taskOptions}
              canWrite={canWrite}
              isOwner={isOwner}
              aiEnabled={aiEnabled}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
