import "server-only";

import { env } from "@/lib/env";
import {
  INTEGRATION_ORDER,
  INTEGRATIONS,
  type CodefConfig,
  type IntegrationProvider,
  type IntegrationStatus,
  type SolapiConfig,
} from "@/lib/integrations/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 연동 설정 해석기. 워크스페이스 설정(service-role 전용 테이블) ⊕ env 글로벌을 병합한다.
 * 워크스페이스 설정이 없으면 env 글로벌로 폴백(기존 동작 보존). 키/토글이 없으면 비활성.
 */

type Row = { enabled: boolean; config: Record<string, unknown> };

async function loadRow(provider: IntegrationProvider, workspaceId: string): Promise<Row | null> {
  const admin = createAdminClient();
  if (!admin) return null; // service-role 없으면 워크스페이스 설정 불가 → env 폴백
  const { data } = await admin
    .from("integration_settings")
    .select("enabled, config")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  if (!data) return null;
  return { enabled: data.enabled, config: (data.config ?? {}) as Record<string, unknown> };
}

function envSolapi(): SolapiConfig {
  return {
    apiKey: env.SOLAPI_API_KEY,
    apiSecret: env.SOLAPI_API_SECRET,
    sender: env.SOLAPI_SENDER,
    pfId: env.SOLAPI_PFID,
    kakaoTemplateId: env.SOLAPI_KAKAO_TEMPLATE_ID,
  };
}

function envCodef(): CodefConfig {
  return {
    clientId: env.CODEF_CLIENT_ID,
    clientSecret: env.CODEF_CLIENT_SECRET,
    publicKey: env.CODEF_PUBLIC_KEY,
  };
}

/** Merge defined keys of `over` onto `base` (skip empty strings). */
function merge<T extends Record<string, unknown>>(base: T, over: Record<string, unknown>): T {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (typeof v === "string" && v.trim() !== "") (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Solapi
// ---------------------------------------------------------------------------
export type SolapiResolution = {
  config: SolapiConfig;
  enabled: boolean;
  smsAvailable: boolean;
  kakaoAvailable: boolean;
};

export async function resolveSolapi(workspaceId: string): Promise<SolapiResolution> {
  const row = await loadRow("solapi", workspaceId);
  const config = merge(envSolapi(), row?.config ?? {});
  const envConfigured = Boolean(envSolapi().apiKey && envSolapi().apiSecret && envSolapi().sender);
  // No row → env decides; row → explicit toggle wins.
  const enabled = row ? row.enabled : envConfigured;
  const smsBase = Boolean(config.apiKey && config.apiSecret && config.sender);
  const kakaoBase = Boolean(smsBase && config.pfId && config.kakaoTemplateId);
  return {
    config,
    enabled,
    smsAvailable: enabled && smsBase,
    kakaoAvailable: enabled && kakaoBase,
  };
}

// ---------------------------------------------------------------------------
// CODEF
// ---------------------------------------------------------------------------
export type CodefResolution = { config: CodefConfig; enabled: boolean; available: boolean };

export async function resolveCodef(workspaceId: string): Promise<CodefResolution> {
  const row = await loadRow("codef", workspaceId);
  const config = merge(envCodef(), row?.config ?? {});
  const envConfigured = Boolean(envCodef().clientId && envCodef().clientSecret);
  const enabled = row ? row.enabled : envConfigured;
  const available = enabled && Boolean(config.clientId && config.clientSecret);
  return { config, enabled, available };
}

// ---------------------------------------------------------------------------
// ERP import (no keys; file-based). Enabled by default unless toggled off.
// ---------------------------------------------------------------------------
export async function resolveErpImport(workspaceId: string): Promise<{ available: boolean }> {
  const row = await loadRow("erp_import", workspaceId);
  return { available: row ? row.enabled : true };
}

// ---------------------------------------------------------------------------
// UI status (no secret values exposed)
// ---------------------------------------------------------------------------
export async function getIntegrationStatuses(workspaceId: string): Promise<IntegrationStatus[]> {
  const statuses: IntegrationStatus[] = [];

  for (const provider of INTEGRATION_ORDER) {
    const row = await loadRow(provider, workspaceId);
    const meta = INTEGRATIONS[provider];

    if (provider === "solapi") {
      const r = await resolveSolapi(workspaceId);
      statuses.push({
        provider,
        enabled: r.enabled,
        available: r.smsAvailable || r.kakaoAvailable,
        configured: Object.fromEntries(
          meta.keys.map((k) => [k.key, Boolean((r.config as Record<string, unknown>)[k.key])]),
        ),
        source:
          row?.config && Object.keys(row.config).length > 0
            ? "workspace"
            : r.smsAvailable
              ? "env"
              : "none",
      });
    } else if (provider === "codef") {
      const r = await resolveCodef(workspaceId);
      statuses.push({
        provider,
        enabled: r.enabled,
        available: r.available,
        configured: Object.fromEntries(
          meta.keys.map((k) => [k.key, Boolean((r.config as Record<string, unknown>)[k.key])]),
        ),
        source:
          row?.config && Object.keys(row.config).length > 0
            ? "workspace"
            : r.available
              ? "env"
              : "none",
      });
    } else {
      const r = await resolveErpImport(workspaceId);
      statuses.push({
        provider,
        enabled: r.available,
        available: r.available,
        configured: {},
        source: row ? "workspace" : "none",
      });
    }
  }

  return statuses;
}
