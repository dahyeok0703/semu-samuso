"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateIntegrationAction } from "@/lib/integrations/actions";
import { INTEGRATION_ORDER, INTEGRATIONS, type IntegrationStatus } from "@/lib/integrations/types";

function IntegrationCard({ status }: { status: IntegrationStatus }) {
  const router = useRouter();
  const meta = INTEGRATIONS[status.provider];
  const [enabled, setEnabled] = useState(status.enabled);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateIntegrationAction({
        provider: status.provider,
        enabled,
        config,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setConfig({});
      toast.success("연동 설정을 저장했습니다.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {meta.name}
              {status.available ? (
                <Badge variant="success">활성</Badge>
              ) : (
                <Badge variant="muted">비활성</Badge>
              )}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
            사용
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {meta.keys.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {meta.keys.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label
                  htmlFor={`${status.provider}-${field.key}`}
                  className="flex items-center gap-1.5"
                >
                  {field.label}
                  {status.configured[field.key] ? (
                    <Check className="size-3.5 text-emerald-600" aria-label="설정됨" />
                  ) : null}
                </Label>
                <Input
                  id={`${status.provider}-${field.key}`}
                  type={field.secret ? "password" : "text"}
                  placeholder={
                    field.secret
                      ? status.configured[field.key]
                        ? "설정됨 — 변경 시에만 입력"
                        : "미설정"
                      : (field.placeholder ?? "")
                  }
                  autoComplete="off"
                  value={config[field.key] ?? ""}
                  onChange={(e) => setConfig((c) => ({ ...c, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            키가 필요 없습니다. 사용을 켜면 거래처 화면에서 ERP 내보내기 파일을 가져올 수 있어요.
          </p>
        )}

        {meta.thirdParty ? (
          <p className="text-xs text-muted-foreground">
            이 연동은 개인정보 제3자 제공·위탁 고지 대상입니다.{" "}
            <a href="/legal/third-party" className="underline" target="_blank" rel="noreferrer">
              고지 보기
            </a>
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null} 저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationsPanel({ statuses }: { statuses: IntegrationStatus[] }) {
  const byProvider = new Map(statuses.map((s) => [s.provider, s]));
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Plug className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">외부 연동</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        선택 연동은 키/계약이 없으면 자동 비활성화되며, 핵심 기능에는 영향을 주지 않습니다.
      </p>
      <div className="space-y-4">
        {INTEGRATION_ORDER.map((p) => {
          const s = byProvider.get(p);
          return s ? <IntegrationCard key={p} status={s} /> : null;
        })}
      </div>
    </section>
  );
}
