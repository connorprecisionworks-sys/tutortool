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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      clients: {
        Row: {
          archived: boolean
          bill_travel: boolean | null
          created_at: string
          custom_rate_cents: number | null
          id: string
          is_philanthropic: boolean
          notes: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          rate_type: Database["public"]["Enums"]["rate_type"]
          student_name: string
          travel_rate_cents: number | null
          tutor_id: string
        }
        Insert: {
          archived?: boolean
          bill_travel?: boolean | null
          created_at?: string
          custom_rate_cents?: number | null
          id?: string
          is_philanthropic?: boolean
          notes?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          student_name: string
          travel_rate_cents?: number | null
          tutor_id: string
        }
        Update: {
          archived?: boolean
          bill_travel?: boolean | null
          created_at?: string
          custom_rate_cents?: number | null
          id?: string
          is_philanthropic?: boolean
          notes?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          rate_type?: Database["public"]["Enums"]["rate_type"]
          student_name?: string
          travel_rate_cents?: number | null
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity_minutes: number | null
          session_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity_minutes?: number | null
          session_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity_minutes?: number | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          paid_at: string | null
          paid_method: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          stripe_invoice_id: string | null
          stripe_payment_url: string | null
          subtotal_cents: number
          total_cents: number
          tutor_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          paid_method?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_invoice_id?: string | null
          stripe_payment_url?: string | null
          subtotal_cents?: number
          total_cents?: number
          tutor_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          paid_method?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          stripe_invoice_id?: string | null
          stripe_payment_url?: string | null
          subtotal_cents?: number
          total_cents?: number
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          bill_travel: boolean
          client_id: string
          created_at: string
          duration_minutes: number
          effective_rate_cents: number
          id: string
          invoice_id: string | null
          location: string | null
          notes: string | null
          occurred_on: string
          start_time: string | null
          status: Database["public"]["Enums"]["session_status"]
          travel_minutes: number
          travel_rate_cents: number | null
          tutor_id: string
        }
        Insert: {
          bill_travel: boolean
          client_id: string
          created_at?: string
          duration_minutes: number
          effective_rate_cents: number
          id?: string
          invoice_id?: string | null
          location?: string | null
          notes?: string | null
          occurred_on: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          travel_minutes?: number
          travel_rate_cents?: number | null
          tutor_id: string
        }
        Update: {
          bill_travel?: boolean
          client_id?: string
          created_at?: string
          duration_minutes?: number
          effective_rate_cents?: number
          id?: string
          invoice_id?: string | null
          location?: string | null
          notes?: string | null
          occurred_on?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          travel_minutes?: number
          travel_rate_cents?: number | null
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_type: string
          id: string
          processed_at: string
        }
        Insert: {
          event_type: string
          id: string
          processed_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          processed_at?: string
        }
        Relationships: []
      }
      tutors: {
        Row: {
          auth_user_id: string
          bill_travel_default: boolean
          created_at: string
          email: string
          id: string
          invoice_terms: string
          name: string
          reminder_cadence: Json
          standard_rate_cents: number
          stripe_account_id: string | null
          travel_rate_cents: number | null
        }
        Insert: {
          auth_user_id: string
          bill_travel_default?: boolean
          created_at?: string
          email: string
          id?: string
          invoice_terms?: string
          name: string
          reminder_cadence?: Json
          standard_rate_cents?: number
          stripe_account_id?: string | null
          travel_rate_cents?: number | null
        }
        Update: {
          auth_user_id?: string
          bill_travel_default?: boolean
          created_at?: string
          email?: string
          id?: string
          invoice_terms?: string
          name?: string
          reminder_cadence?: Json
          standard_rate_cents?: number
          stripe_account_id?: string | null
          travel_rate_cents?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_manual_line_item: {
        Args: {
          p_amount_cents: number
          p_description: string
          p_invoice_id: string
        }
        Returns: string
      }
      create_draft_invoice: {
        Args: {
          p_client_id: string
          p_period_end: string
          p_period_start: string
        }
        Returns: string
      }
      current_tutor_id: { Args: never; Returns: string }
      mark_invoice_paid: {
        Args: { p_invoice_id: string; p_method: string }
        Returns: undefined
      }
      recompute_invoice_totals: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      remove_line_item: { Args: { p_line_item_id: string }; Returns: undefined }
      send_invoice: { Args: { p_invoice_id: string }; Returns: undefined }
      session_amount_cents: {
        Args: {
          p_bill_travel: boolean
          p_duration_minutes: number
          p_effective_rate_cents: number
          p_travel_minutes: number
          p_travel_rate_cents: number
        }
        Returns: number
      }
      set_invoice_stripe_link: {
        Args: {
          p_invoice_id: string
          p_stripe_checkout_session_id: string
          p_stripe_payment_url: string
        }
        Returns: undefined
      }
      void_invoice: { Args: { p_invoice_id: string }; Returns: undefined }
    }
    Enums: {
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "void"
      rate_type:
        | "standard"
        | "professional_discount"
        | "friend"
        | "low_income"
        | "pro_bono"
      session_status: "logged" | "billed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      invoice_status: ["draft", "sent", "paid", "overdue", "void"],
      rate_type: [
        "standard",
        "professional_discount",
        "friend",
        "low_income",
        "pro_bono",
      ],
      session_status: ["logged", "billed"],
    },
  },
} as const
