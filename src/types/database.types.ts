/**
 * Supabase database types.
 *
 * This file is normally GENERATED — regenerate after migrations with:
 *   pnpm db:types        (writes to this path)
 *
 * It is hand-maintained here to mirror supabase/migrations until you run the
 * generator against a live local database.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemberRole = "owner" | "staff";
export type TaxType = "general" | "simplified" | "exempt" | "corporate";
export type ClientStatus = "active" | "suspended" | "terminated";

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: MemberRole;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: MemberRole;
          display_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: MemberRole;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_workspace_id_fkey";
            columns: ["workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          business_number: string | null;
          representative_name: string | null;
          tax_type: TaxType | null;
          status: ClientStatus;
          email: string | null;
          phone: string | null;
          memo: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          business_number?: string | null;
          representative_name?: string | null;
          tax_type?: TaxType | null;
          status?: ClientStatus;
          email?: string | null;
          phone?: string | null;
          memo?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          name?: string;
          business_number?: string | null;
          representative_name?: string | null;
          tax_type?: TaxType | null;
          status?: ClientStatus;
          email?: string | null;
          phone?: string | null;
          memo?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey";
            columns: ["workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_workspace_member: {
        Args: { _workspace_id: string };
        Returns: boolean;
      };
      workspace_role: {
        Args: { _workspace_id: string };
        Returns: MemberRole;
      };
    };
    Enums: {
      member_role: MemberRole;
      tax_type: TaxType;
      client_status: ClientStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};

// Convenience row aliases.
export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type Member = Database["public"]["Tables"]["members"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
