export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      case_events: {
        Row: {
          auto_generated: boolean
          case_id: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          event_type: Database["public"]["Enums"]["case_event_type"]
          id: string
          next_step: string | null
          order_id: string | null
          title: string
        }
        Insert: {
          auto_generated?: boolean
          case_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          event_type?: Database["public"]["Enums"]["case_event_type"]
          id?: string
          next_step?: string | null
          order_id?: string | null
          title: string
        }
        Update: {
          auto_generated?: boolean
          case_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          event_type?: Database["public"]["Enums"]["case_event_type"]
          id?: string
          next_step?: string | null
          order_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          appeal_deadline: string | null
          cause_number: string | null
          court_precinct: string | null
          created_at: string
          customer_id: string
          filing_date: string | null
          id: string
          judgment_date: string | null
          judgment_result: Database["public"]["Enums"]["judgment_result"]
          notes: string | null
          stage: Database["public"]["Enums"]["case_stage"]
          trial_date: string | null
          writ_earliest: string | null
        }
        Insert: {
          appeal_deadline?: string | null
          cause_number?: string | null
          court_precinct?: string | null
          created_at?: string
          customer_id: string
          filing_date?: string | null
          id?: string
          judgment_date?: string | null
          judgment_result?: Database["public"]["Enums"]["judgment_result"]
          notes?: string | null
          stage?: Database["public"]["Enums"]["case_stage"]
          trial_date?: string | null
          writ_earliest?: string | null
        }
        Update: {
          appeal_deadline?: string | null
          cause_number?: string | null
          court_precinct?: string | null
          created_at?: string
          customer_id?: string
          filing_date?: string | null
          id?: string
          judgment_date?: string | null
          judgment_result?: Database["public"]["Enums"]["judgment_result"]
          notes?: string | null
          stage?: Database["public"]["Enums"]["case_stage"]
          trial_date?: string | null
          writ_earliest?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          precinct: string | null
          source: Database["public"]["Enums"]["customer_source"]
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          precinct?: string | null
          source?: Database["public"]["Enums"]["customer_source"]
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          precinct?: string | null
          source?: Database["public"]["Enums"]["customer_source"]
          zip?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_cents: number
          assigned_to: string | null
          case_id: string | null
          created_at: string
          customer_id: string
          disposition: Database["public"]["Enums"]["order_disposition"]
          id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          service_id: string
        }
        Insert: {
          amount_cents?: number
          assigned_to?: string | null
          case_id?: string | null
          created_at?: string
          customer_id: string
          disposition?: Database["public"]["Enums"]["order_disposition"]
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          service_id: string
        }
        Update: {
          amount_cents?: number
          assigned_to?: string | null
          case_id?: string | null
          created_at?: string
          customer_id?: string
          disposition?: Database["public"]["Enums"]["order_disposition"]
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          description: string
          id: string
          name: string
          price_cents: number
          slug: string
          sort_order: number
          stage: Database["public"]["Enums"]["service_stage"]
          texas_authority: string
        }
        Insert: {
          active?: boolean
          description?: string
          id?: string
          name: string
          price_cents?: number
          slug: string
          sort_order?: number
          stage: Database["public"]["Enums"]["service_stage"]
          texas_authority?: string
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          stage?: Database["public"]["Enums"]["service_stage"]
          texas_authority?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_staff: { Args: never; Returns: boolean }
      is_tx_court_holiday: { Args: { d: string }; Returns: boolean }
      next_business_day: { Args: { d: string }; Returns: string }
      regenerate_case_events: {
        Args: { p_case_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      case_event_type: "deadline" | "task" | "filing" | "note"
      case_stage:
        | "pre_trial"
        | "trial_set"
        | "judgment"
        | "appeal"
        | "move_out"
        | "closed"
      customer_source: "web" | "manual"
      judgment_result: "pending" | "tenant" | "landlord" | "dismissed"
      order_disposition:
        | "new"
        | "intake_review"
        | "docs_prep"
        | "awaiting_signature"
        | "filed"
        | "negotiating"
        | "completed"
        | "cancelled"
      payment_status: "unpaid" | "paid" | "refunded"
      service_stage: "pre_trial" | "post_judgment" | "move_out"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      case_event_type: ["deadline", "task", "filing", "note"],
      case_stage: [
        "pre_trial",
        "trial_set",
        "judgment",
        "appeal",
        "move_out",
        "closed",
      ],
      customer_source: ["web", "manual"],
      judgment_result: ["pending", "tenant", "landlord", "dismissed"],
      order_disposition: [
        "new",
        "intake_review",
        "docs_prep",
        "awaiting_signature",
        "filed",
        "negotiating",
        "completed",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid", "refunded"],
      service_stage: ["pre_trial", "post_judgment", "move_out"],
    },
  },
} as const
