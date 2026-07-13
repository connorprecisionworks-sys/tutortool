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
            foreignKeyName: "sessions_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
    }
    Enums: {
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
