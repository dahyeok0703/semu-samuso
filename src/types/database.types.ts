/**
 * Supabase database types.
 *
 * GENERATED-EQUIVALENT: this mirrors supabase/migrations exactly. Regenerate
 * from a running local Supabase (Docker) after schema changes with:
 *   pnpm db:types        (supabase gen types typescript --local > this file)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspacePlan = "free" | "team" | "pro";
export type MemberRole = "owner" | "staff";
export type MemberStatus = "active" | "inactive";
export type TaxType = "general" | "simplified" | "exempt" | "corporate";
export type ClientStatus = "active" | "paused" | "ended";
export type FilingStatus = "pending" | "docs_received" | "filed" | "done";
export type DocsStatus = "missing" | "partial" | "complete";
export type DocumentSource = "upload" | "email" | "kakao" | "codef";
export type DocumentStatus = "pending_review" | "confirmed";
export type ReminderChannel = "email" | "inapp" | "kakao" | "sms";
export type ReminderStatus = "queued" | "sent" | "failed";
export type InvitationStatus = "pending" | "accepted" | "revoked";

type WorkspaceFk<Name extends string> = {
  foreignKeyName: Name;
  columns: ["workspace_id"];
  referencedRelation: "workspaces";
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          plan: WorkspacePlan;
          trial_ends_at: string | null;
          billing_customer_id: string | null;
          onboarded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          plan?: WorkspacePlan;
          trial_ends_at?: string | null;
          billing_customer_id?: string | null;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          plan?: WorkspacePlan;
          trial_ends_at?: string | null;
          billing_customer_id?: string | null;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          name: string;
          role: MemberRole;
          status: MemberStatus;
          invited_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          name: string;
          role?: MemberRole;
          status?: MemberStatus;
          invited_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string | null;
          name?: string;
          role?: MemberRole;
          status?: MemberStatus;
          invited_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [WorkspaceFk<"members_workspace_id_fkey">];
      };
      clients: {
        Row: {
          id: string;
          workspace_id: string;
          biz_name: string;
          biz_reg_no: string | null;
          ceo_name: string | null;
          industry: string | null;
          tax_type: TaxType | null;
          closing_month: number;
          is_semiannual_withholding: boolean;
          is_diligent_filing: boolean;
          contact_phone: string | null;
          contact_kakao: string | null;
          contact_email: string | null;
          status: ClientStatus;
          memo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          biz_name: string;
          biz_reg_no?: string | null;
          ceo_name?: string | null;
          industry?: string | null;
          tax_type?: TaxType | null;
          closing_month?: number;
          is_semiannual_withholding?: boolean;
          is_diligent_filing?: boolean;
          contact_phone?: string | null;
          contact_kakao?: string | null;
          contact_email?: string | null;
          status?: ClientStatus;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          biz_name?: string;
          biz_reg_no?: string | null;
          ceo_name?: string | null;
          industry?: string | null;
          tax_type?: TaxType | null;
          closing_month?: number;
          is_semiannual_withholding?: boolean;
          is_diligent_filing?: boolean;
          contact_phone?: string | null;
          contact_kakao?: string | null;
          contact_email?: string | null;
          status?: ClientStatus;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [WorkspaceFk<"clients_workspace_id_fkey">];
      };
      client_assignments: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          member_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          member_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          member_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          WorkspaceFk<"client_assignments_workspace_id_fkey">,
          {
            foreignKeyName: "client_assignments_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_assignments_member_id_fkey";
            columns: ["member_id"];
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      filing_tasks: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          filing_type: string;
          period_label: string;
          due_date: string | null;
          status: FilingStatus;
          docs_status: DocsStatus;
          assigned_member_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          filing_type: string;
          period_label: string;
          due_date?: string | null;
          status?: FilingStatus;
          docs_status?: DocsStatus;
          assigned_member_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          filing_type?: string;
          period_label?: string;
          due_date?: string | null;
          status?: FilingStatus;
          docs_status?: DocsStatus;
          assigned_member_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          WorkspaceFk<"filing_tasks_workspace_id_fkey">,
          {
            foreignKeyName: "filing_tasks_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "filing_tasks_assigned_member_id_fkey";
            columns: ["assigned_member_id"];
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      expected_documents: {
        Row: {
          id: string;
          workspace_id: string;
          filing_task_id: string;
          doc_type: string;
          is_received: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          filing_task_id: string;
          doc_type: string;
          is_received?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          filing_task_id?: string;
          doc_type?: string;
          is_received?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          WorkspaceFk<"expected_documents_workspace_id_fkey">,
          {
            foreignKeyName: "expected_documents_filing_task_id_fkey";
            columns: ["filing_task_id"];
            referencedRelation: "filing_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          filing_task_id: string | null;
          doc_type: string | null;
          file_path: string;
          source: DocumentSource;
          classified_by_ai: boolean;
          confidence: number | null;
          status: DocumentStatus;
          ai_model: string | null;
          ai_meta: Json;
          received_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          filing_task_id?: string | null;
          doc_type?: string | null;
          file_path: string;
          source?: DocumentSource;
          classified_by_ai?: boolean;
          confidence?: number | null;
          status?: DocumentStatus;
          ai_model?: string | null;
          ai_meta?: Json;
          received_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          filing_task_id?: string | null;
          doc_type?: string | null;
          file_path?: string;
          source?: DocumentSource;
          classified_by_ai?: boolean;
          confidence?: number | null;
          status?: DocumentStatus;
          ai_model?: string | null;
          ai_meta?: Json;
          received_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          WorkspaceFk<"documents_workspace_id_fkey">,
          {
            foreignKeyName: "documents_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_filing_task_id_fkey";
            columns: ["filing_task_id"];
            referencedRelation: "filing_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      classification_history: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          doc_type: string;
          account_hint: string | null;
          features: Json;
          was_corrected: boolean;
          source_document_id: string | null;
          confirmed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          doc_type: string;
          account_hint?: string | null;
          features?: Json;
          was_corrected?: boolean;
          source_document_id?: string | null;
          confirmed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          doc_type?: string;
          account_hint?: string | null;
          features?: Json;
          was_corrected?: boolean;
          source_document_id?: string | null;
          confirmed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          WorkspaceFk<"classification_history_workspace_id_fkey">,
          {
            foreignKeyName: "classification_history_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_history_source_document_id_fkey";
            columns: ["source_document_id"];
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage: {
        Row: {
          id: string;
          workspace_id: string;
          month: string;
          input_tokens: number;
          output_tokens: number;
          doc_count: number;
          est_cost_krw: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          month: string;
          input_tokens?: number;
          output_tokens?: number;
          doc_count?: number;
          est_cost_krw?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          month?: string;
          input_tokens?: number;
          output_tokens?: number;
          doc_count?: number;
          est_cost_krw?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [WorkspaceFk<"ai_usage_workspace_id_fkey">];
      };
      reminders: {
        Row: {
          id: string;
          workspace_id: string;
          client_id: string;
          filing_task_id: string | null;
          channel: ReminderChannel;
          template_key: string;
          sent_at: string | null;
          status: ReminderStatus;
          error: string | null;
          response_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          client_id: string;
          filing_task_id?: string | null;
          channel: ReminderChannel;
          template_key: string;
          sent_at?: string | null;
          status?: ReminderStatus;
          error?: string | null;
          response_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          client_id?: string;
          filing_task_id?: string | null;
          channel?: ReminderChannel;
          template_key?: string;
          sent_at?: string | null;
          status?: ReminderStatus;
          error?: string | null;
          response_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          WorkspaceFk<"reminders_workspace_id_fkey">,
          {
            foreignKeyName: "reminders_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminders_filing_task_id_fkey";
            columns: ["filing_task_id"];
            referencedRelation: "filing_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          workspace_id: string;
          member_id: string;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          member_id: string;
          type: string;
          title: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          member_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          WorkspaceFk<"notifications_workspace_id_fkey">,
          {
            foreignKeyName: "notifications_member_id_fkey";
            columns: ["member_id"];
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          workspace_id: string;
          actor_member_id: string | null;
          action: string;
          target_table: string | null;
          target_id: string | null;
          meta: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          actor_member_id?: string | null;
          action: string;
          target_table?: string | null;
          target_id?: string | null;
          meta?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          actor_member_id?: string | null;
          action?: string;
          target_table?: string | null;
          target_id?: string | null;
          meta?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          WorkspaceFk<"audit_logs_workspace_id_fkey">,
          {
            foreignKeyName: "audit_logs_actor_member_id_fkey";
            columns: ["actor_member_id"];
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_events: {
        Row: {
          id: string;
          workspace_id: string;
          type: string;
          raw: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          type: string;
          raw?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          type?: string;
          raw?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [WorkspaceFk<"billing_events_workspace_id_fkey">];
      };
      reminder_settings: {
        Row: {
          workspace_id: string;
          auto_send: boolean;
          channels: string[];
          offsets: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          auto_send?: boolean;
          channels?: string[];
          offsets?: number[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          workspace_id?: string;
          auto_send?: boolean;
          channels?: string[];
          offsets?: number[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [WorkspaceFk<"reminder_settings_workspace_id_fkey">];
      };
      invitations: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          role: MemberRole;
          token: string;
          status: InvitationStatus;
          invited_by_member_id: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email: string;
          role?: MemberRole;
          token: string;
          status?: InvitationStatus;
          invited_by_member_id?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          email?: string;
          role?: MemberRole;
          token?: string;
          status?: InvitationStatus;
          invited_by_member_id?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [WorkspaceFk<"invitations_workspace_id_fkey">];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_workspace_id: { Args: Record<never, never>; Returns: string };
      current_member_id: { Args: Record<never, never>; Returns: string };
      is_owner: { Args: Record<never, never>; Returns: boolean };
      is_assigned_to_client: { Args: { _client_id: string }; Returns: boolean };
      can_write_task: { Args: { _task_id: string }; Returns: boolean };
    };
    Enums: {
      workspace_plan: WorkspacePlan;
      member_role: MemberRole;
      member_status: MemberStatus;
      tax_type: TaxType;
      client_status: ClientStatus;
      filing_status: FilingStatus;
      docs_status: DocsStatus;
      document_source: DocumentSource;
      document_status: DocumentStatus;
      reminder_channel: ReminderChannel;
      reminder_status: ReminderStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};

// Convenience row aliases.
type Tables = Database["public"]["Tables"];
export type Workspace = Tables["workspaces"]["Row"];
export type Member = Tables["members"]["Row"];
export type Client = Tables["clients"]["Row"];
export type ClientAssignment = Tables["client_assignments"]["Row"];
export type FilingTask = Tables["filing_tasks"]["Row"];
export type ExpectedDocument = Tables["expected_documents"]["Row"];
export type DocumentRow = Tables["documents"]["Row"];
export type ClassificationHistory = Tables["classification_history"]["Row"];
export type AiUsage = Tables["ai_usage"]["Row"];
export type Reminder = Tables["reminders"]["Row"];
export type Notification = Tables["notifications"]["Row"];
export type AuditLog = Tables["audit_logs"]["Row"];
export type BillingEvent = Tables["billing_events"]["Row"];
