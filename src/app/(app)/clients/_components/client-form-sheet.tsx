"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FieldError } from "@/components/form/field-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors } from "@/lib/actions/apply-field-errors";
import { formatBizRegNo } from "@/lib/clients/biz-reg-no";
import { checkBizRegNoDuplicate, createClientAction, updateClientAction } from "@/lib/clients/actions";
import {
  CLIENT_STATUS_OPTIONS,
  CLOSING_MONTH_OPTIONS,
  TAX_TYPE_OPTIONS,
} from "@/lib/clients/constants";
import { clientFormSchema, type ClientFormValues } from "@/lib/clients/schemas";
import type { Client } from "@/types/database.types";

const TAX_NONE = "none";

function toFormValues(client?: Client): ClientFormValues {
  return {
    biz_name: client?.biz_name ?? "",
    biz_reg_no: client?.biz_reg_no ? formatBizRegNo(client.biz_reg_no) : "",
    ceo_name: client?.ceo_name ?? "",
    industry: client?.industry ?? "",
    tax_type: client?.tax_type ?? null,
    closing_month: client?.closing_month ?? 12,
    is_semiannual_withholding: client?.is_semiannual_withholding ?? false,
    is_diligent_filing: client?.is_diligent_filing ?? false,
    contact_phone: client?.contact_phone ?? "",
    contact_kakao: client?.contact_kakao ?? "",
    contact_email: client?.contact_email ?? "",
    status: client?.status ?? "active",
    memo: client?.memo ?? "",
  };
}

export function ClientFormSheet({
  trigger,
  client,
}: {
  trigger: React.ReactNode;
  client?: Client;
}) {
  const router = useRouter();
  const isEdit = Boolean(client);
  const [open, setOpen] = useState(false);
  const [dupWarning, setDupWarning] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: toFormValues(client),
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(toFormValues(client));
      setDupWarning(null);
    }
  }

  async function onBizRegNoBlur(value: string) {
    const formatted = formatBizRegNo(value);
    if (formatted !== value) setValue("biz_reg_no", formatted, { shouldValidate: true });
    const res = await checkBizRegNoDuplicate({ bizRegNo: value, excludeId: client?.id });
    setDupWarning(res.duplicate ? `이미 등록된 사업자번호입니다 (${res.name}).` : null);
  }

  async function onSubmit(values: ClientFormValues) {
    const result = isEdit
      ? await updateClientAction({ ...values, id: client!.id })
      : await createClientAction(values);

    if (!result.ok) {
      applyFieldErrors(result.error, setError);
      toast.error(result.error.message);
      return;
    }
    toast.success(isEdit ? "거래처 정보를 저장했습니다." : "거래처를 등록했습니다.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b p-6 text-left">
          <SheetTitle>{isEdit ? "거래처 수정" : "거래처 등록"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "거래처 정보를 수정합니다." : "새 거래처를 등록합니다. 상호는 필수입니다."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col" noValidate>
          <div className="flex-1 space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="biz_name">
                상호 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="biz_name"
                aria-invalid={Boolean(errors.biz_name)}
                {...register("biz_name")}
              />
              <FieldError message={errors.biz_name?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="biz_reg_no">사업자등록번호</Label>
              <Input
                id="biz_reg_no"
                inputMode="numeric"
                placeholder="123-45-67890"
                aria-invalid={Boolean(errors.biz_reg_no)}
                aria-describedby="biz_reg_no_help"
                {...register("biz_reg_no", {
                  onBlur: (e) => onBizRegNoBlur(e.target.value),
                })}
              />
              <FieldError message={errors.biz_reg_no?.message} />
              {dupWarning ? (
                <p id="biz_reg_no_help" className="text-xs font-medium text-amber-600">
                  ⚠ {dupWarning}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ceo_name">대표자</Label>
                <Input id="ceo_name" {...register("ceo_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">업종</Label>
                <Input id="industry" {...register("industry")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_type">과세유형</Label>
                <Controller
                  control={control}
                  name="tax_type"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? TAX_NONE}
                      onValueChange={(v) => field.onChange(v === TAX_NONE ? null : v)}
                    >
                      <SelectTrigger id="tax_type">
                        <SelectValue placeholder="선택 안 함" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TAX_NONE}>선택 안 함</SelectItem>
                        {TAX_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closing_month">결산월</Label>
                <Controller
                  control={control}
                  name="closing_month"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger id="closing_month">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLOSING_MONTH_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <fieldset className="grid grid-cols-2 gap-4">
              <legend className="sr-only">신고 옵션</legend>
              <Controller
                control={control}
                name="is_semiannual_withholding"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                    />
                    반기 원천징수
                  </label>
                )}
              />
              <Controller
                control={control}
                name="is_diligent_filing"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                    />
                    성실신고 대상
                  </label>
                )}
              />
            </fieldset>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_phone">연락처</Label>
                <Input id="contact_phone" inputMode="tel" {...register("contact_phone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_kakao">카카오</Label>
                <Input id="contact_kakao" {...register("contact_kakao")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">이메일</Label>
              <Input
                id="contact_email"
                type="email"
                aria-invalid={Boolean(errors.contact_email)}
                {...register("contact_email")}
              />
              <FieldError message={errors.contact_email?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">상태</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="memo">메모</Label>
              <Textarea id="memo" rows={3} {...register("memo")} />
              <FieldError message={errors.memo?.message} />
            </div>
          </div>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background p-4">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                취소
              </Button>
            </SheetClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "저장 중…" : isEdit ? "저장" : "등록"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
