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
      agreements: {
        Row: {
          accepted_at: string
          auth_user_id: string
          id: string
          privacy_version: string
          terms_version: string
        }
        Insert: {
          accepted_at?: string
          auth_user_id: string
          id?: string
          privacy_version: string
          terms_version: string
        }
        Update: {
          accepted_at?: string
          auth_user_id?: string
          id?: string
          privacy_version?: string
          terms_version?: string
        }
        Relationships: []
      }
      auto_invoice_runs: {
        Row: {
          client_id: string
          created_at: string
          id: string
          invoice_id: string | null
          trigger_key: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          trigger_key: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          trigger_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_invoice_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_invoice_runs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          start_time: string
          tutor_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          tutor_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          tutor_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_blocks: {
        Row: {
          created_at: string
          end_date: string
          id: string
          note: string | null
          start_date: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          note?: string | null
          start_date: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          note?: string | null
          start_date?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_link_slots: {
        Row: {
          booking_link_id: string
          created_at: string
          duration_minutes: number
          id: string
          start_ts: string
        }
        Insert: {
          booking_link_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          start_ts: string
        }
        Update: {
          booking_link_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          start_ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_link_slots_booking_link_id_fkey"
            columns: ["booking_link_id"]
            isOneToOne: false
            referencedRelation: "booking_links"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_links: {
        Row: {
          buffer_minutes: number
          chosen_slot_id: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          mode: string
          service_id: string | null
          session_id: string | null
          status: string
          student_id: string | null
          token: string
          tutor_id: string
        }
        Insert: {
          buffer_minutes?: number
          chosen_slot_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          mode?: string
          service_id?: string | null
          session_id?: string | null
          status?: string
          student_id?: string | null
          token: string
          tutor_id: string
        }
        Update: {
          buffer_minutes?: number
          chosen_slot_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          mode?: string
          service_id?: string | null
          session_id?: string | null
          status?: string
          student_id?: string | null
          token?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_links_chosen_slot_id_fkey"
            columns: ["chosen_slot_id"]
            isOneToOne: false
            referencedRelation: "booking_link_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_links_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "parent_visible_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_links_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          mode: Database["public"]["Enums"]["booking_mode"]
          requested_start: string
          service_id: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["booking_status"]
          student_id: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          id?: string
          mode: Database["public"]["Enums"]["booking_mode"]
          requested_start: string
          service_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          student_id: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          mode?: Database["public"]["Enums"]["booking_mode"]
          requested_start?: string
          service_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          student_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "parent_visible_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived: boolean
          auto_invoice_enabled: boolean
          auto_invoice_next_date: string | null
          auto_invoice_trigger: string
          bill_travel: boolean | null
          class_id: string | null
          created_at: string
          custom_rate_cents: number | null
          id: string
          is_philanthropic: boolean
          needs_goals: string | null
          notes: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          pending_parent_review: boolean
          rate_type: Database["public"]["Enums"]["rate_type"]
          scheduling_mode: string
          sms_opt_in: boolean
          student_name: string
          travel_rate_cents: number | null
          tutor_id: string
        }
        Insert: {
          archived?: boolean
          auto_invoice_enabled?: boolean
          auto_invoice_next_date?: string | null
          auto_invoice_trigger?: string
          bill_travel?: boolean | null
          class_id?: string | null
          created_at?: string
          custom_rate_cents?: number | null
          id?: string
          is_philanthropic?: boolean
          needs_goals?: string | null
          notes?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          pending_parent_review?: boolean
          rate_type?: Database["public"]["Enums"]["rate_type"]
          scheduling_mode?: string
          sms_opt_in?: boolean
          student_name: string
          travel_rate_cents?: number | null
          tutor_id: string
        }
        Update: {
          archived?: boolean
          auto_invoice_enabled?: boolean
          auto_invoice_next_date?: string | null
          auto_invoice_trigger?: string
          bill_travel?: boolean | null
          class_id?: string | null
          created_at?: string
          custom_rate_cents?: number | null
          id?: string
          is_philanthropic?: boolean
          needs_goals?: string | null
          notes?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payer_phone?: string | null
          pending_parent_review?: boolean
          rate_type?: Database["public"]["Enums"]["rate_type"]
          scheduling_mode?: string
          sms_opt_in?: boolean
          student_name?: string
          travel_rate_cents?: number | null
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          amount_cents: number
          client_id: string
          created_at: string
          id: string
          reason: string | null
          remaining_cents: number
          session_id: string | null
          tutor_id: string
        }
        Insert: {
          amount_cents: number
          client_id: string
          created_at?: string
          id?: string
          reason?: string | null
          remaining_cents: number
          session_id?: string | null
          tutor_id: string
        }
        Update: {
          amount_cents?: number
          client_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          remaining_cents?: number
          session_id?: string | null
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "parent_visible_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          from_location: string | null
          id: string
          incurred_on: string
          mileage_rate_cents: number | null
          miles: number | null
          note: string | null
          receipt_path: string | null
          session_id: string | null
          student_id: string | null
          to_location: string | null
          tutor_id: string
          vendor: string | null
        }
        Insert: {
          amount_cents: number
          category: string
          created_at?: string
          from_location?: string | null
          id?: string
          incurred_on: string
          mileage_rate_cents?: number | null
          miles?: number | null
          note?: string | null
          receipt_path?: string | null
          session_id?: string | null
          student_id?: string | null
          to_location?: string | null
          tutor_id: string
          vendor?: string | null
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          from_location?: string | null
          id?: string
          incurred_on?: string
          mileage_rate_cents?: number | null
          miles?: number | null
          note?: string | null
          receipt_path?: string | null
          session_id?: string | null
          student_id?: string | null
          to_location?: string | null
          tutor_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "parent_visible_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_call_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_call_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "founder_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_feedback: {
        Row: {
          body: string
          build_queue_ref: string | null
          context: Json | null
          created_at: string
          date: string
          id: string
          lead_id: string | null
          source: string
          status: string
          tag: string | null
          tutor_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          build_queue_ref?: string | null
          context?: Json | null
          created_at?: string
          date?: string
          id?: string
          lead_id?: string | null
          source: string
          status?: string
          tag?: string | null
          tutor_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          build_queue_ref?: string | null
          context?: Json | null
          created_at?: string
          date?: string
          id?: string
          lead_id?: string | null
          source?: string
          status?: string
          tag?: string | null
          tutor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_feedback_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "founder_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_feedback_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_leads: {
        Row: {
          context: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          owner: string | null
          phone: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          owner?: string | null
          phone?: string | null
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          owner?: string | null
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invite_sends: {
        Row: {
          channel: string
          id: string
          parent_email: string
          parent_name: string | null
          sent_at: string
          student_id: string
          tutor_id: string
        }
        Insert: {
          channel: string
          id?: string
          parent_email: string
          parent_name?: string | null
          sent_at?: string
          student_id: string
          tutor_id: string
        }
        Update: {
          channel?: string
          id?: string
          parent_email?: string
          parent_name?: string | null
          sent_at?: string
          student_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_sends_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_sends_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          status: string
          student_id: string
          tutor_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          status?: string
          student_id: string
          tutor_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          status?: string
          student_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_tutor_id_fkey"
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
          line_type: string
          quantity_minutes: number | null
          session_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_type?: string
          quantity_minutes?: number | null
          session_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_type?: string
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
            referencedRelation: "parent_visible_sessions"
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
          auto_generated: boolean
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          paid_at: string | null
          paid_method: string | null
          payment_timing: string
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
          auto_generated?: boolean
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          paid_method?: string | null
          payment_timing?: string
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
          auto_generated?: boolean
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          paid_method?: string | null
          payment_timing?: string
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
      packages: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          is_public: boolean
          name: string
          price_cents: number
          purchase_invoice_id: string | null
          remaining_sessions: number
          service_id: string | null
          status: string
          total_sessions: number
          tutor_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          name: string
          price_cents: number
          purchase_invoice_id?: string | null
          remaining_sessions?: number
          service_id?: string | null
          status?: string
          total_sessions: number
          tutor_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          price_cents?: number
          purchase_invoice_id?: string | null
          remaining_sessions?: number
          service_id?: string | null
          status?: string
          total_sessions?: number
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_email: string
          parent_name: string
          parent_user_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_email: string
          parent_name: string
          parent_user_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_email?: string
          parent_name?: string
          parent_user_id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_sessions: {
        Row: {
          client_id: string
          created_at: string
          duration_minutes: number
          end_date: string | null
          id: string
          location: string | null
          service_id: string | null
          start_date: string
          start_time: string
          status: string
          travel_minutes: number
          tutor_id: string
          weekday: number
        }
        Insert: {
          client_id: string
          created_at?: string
          duration_minutes: number
          end_date?: string | null
          id?: string
          location?: string | null
          service_id?: string | null
          start_date: string
          start_time: string
          status?: string
          travel_minutes?: number
          tutor_id: string
          weekday: number
        }
        Update: {
          client_id?: string
          created_at?: string
          duration_minutes?: number
          end_date?: string | null
          id?: string
          location?: string | null
          service_id?: string | null
          start_date?: string
          start_time?: string
          status?: string
          travel_minutes?: number
          tutor_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_sessions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_sessions_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          channel: string
          id: string
          invoice_id: string | null
          kind: string
          sent_at: string
          session_id: string | null
          template_key: string
        }
        Insert: {
          channel?: string
          id?: string
          invoice_id?: string | null
          kind?: string
          sent_at?: string
          session_id?: string | null
          template_key: string
        }
        Update: {
          channel?: string
          id?: string
          invoice_id?: string | null
          kind?: string
          sent_at?: string
          session_id?: string | null
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "parent_visible_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_gates: {
        Row: {
          created_at: string
          id: string
          price_cents: number
          resource_id: string
          status: string
          unlock_invoice_id: string | null
          unlock_line_item_id: string | null
          unlocked_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          price_cents: number
          resource_id: string
          status?: string
          unlock_invoice_id?: string | null
          unlock_line_item_id?: string | null
          unlocked_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          price_cents?: number
          resource_id?: string
          status?: string
          unlock_invoice_id?: string | null
          unlock_line_item_id?: string | null
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_gates_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: true
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_gates_unlock_invoice_id_fkey"
            columns: ["unlock_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_gates_unlock_line_item_id_fkey"
            columns: ["unlock_line_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          id: string
          student_id: string
          title: string
          tutor_id: string
          type: Database["public"]["Enums"]["resource_type"]
          url_or_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: string
          title: string
          tutor_id: string
          type: Database["public"]["Enums"]["resource_type"]
          url_or_path: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: string
          title?: string
          tutor_id?: string
          type?: Database["public"]["Enums"]["resource_type"]
          url_or_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          tutor_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          sort_order?: number
          tutor_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          session_id: string
          shared: boolean
          tutor_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          session_id: string
          shared?: boolean
          tutor_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          session_id?: string
          shared?: boolean
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "parent_visible_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_tutor_id_fkey"
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
          booking_link_id: string | null
          cancellation_handling: string | null
          cancelled_at: string | null
          client_id: string
          created_at: string
          duration_minutes: number
          effective_rate_cents: number
          id: string
          invoice_id: string | null
          location: string | null
          meeting_link: string | null
          notes: string | null
          occurred_on: string
          package_id: string | null
          recurring_session_id: string | null
          service_id: string | null
          service_price_cents: number | null
          start_time: string | null
          status: Database["public"]["Enums"]["session_status"]
          travel_minutes: number
          travel_rate_cents: number | null
          tutor_id: string
        }
        Insert: {
          bill_travel: boolean
          booking_link_id?: string | null
          cancellation_handling?: string | null
          cancelled_at?: string | null
          client_id: string
          created_at?: string
          duration_minutes: number
          effective_rate_cents: number
          id?: string
          invoice_id?: string | null
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          occurred_on: string
          package_id?: string | null
          recurring_session_id?: string | null
          service_id?: string | null
          service_price_cents?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          travel_minutes?: number
          travel_rate_cents?: number | null
          tutor_id: string
        }
        Update: {
          bill_travel?: boolean
          booking_link_id?: string | null
          cancellation_handling?: string | null
          cancelled_at?: string | null
          client_id?: string
          created_at?: string
          duration_minutes?: number
          effective_rate_cents?: number
          id?: string
          invoice_id?: string | null
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          occurred_on?: string
          package_id?: string | null
          recurring_session_id?: string | null
          service_id?: string | null
          service_price_cents?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          travel_minutes?: number
          travel_rate_cents?: number | null
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_booking_link_id_fkey"
            columns: ["booking_link_id"]
            isOneToOne: false
            referencedRelation: "booking_links"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "sessions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_recurring_session_id_fkey"
            columns: ["recurring_session_id"]
            isOneToOne: false
            referencedRelation: "recurring_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
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
          avatar_path: string | null
          bill_travel_default: boolean
          bio: string | null
          booking_cta_label: string
          cancellation_window_hours: number
          created_at: string
          custom_email_templates: Json
          default_cancellation_policy: string
          default_payment_timing: string
          email: string
          handle: string | null
          headline: string | null
          ical_token: string | null
          id: string
          invoice_terms: string
          is_public: boolean
          mileage_rate_cents: number
          name: string
          notification_settings: Json
          phone: string | null
          public_display_name: string | null
          reminder_cadence: Json
          reminder_templates: Json
          session_reminder_lead_hours: number
          show_bio: boolean
          show_phone: boolean
          show_prices: boolean
          sms_enabled: boolean
          standard_rate_cents: number
          stripe_account_id: string | null
          subjects: string | null
          travel_rate_cents: number | null
          tutor_code: string
          welcome_note: string | null
        }
        Insert: {
          auth_user_id: string
          avatar_path?: string | null
          bill_travel_default?: boolean
          bio?: string | null
          booking_cta_label?: string
          cancellation_window_hours?: number
          created_at?: string
          custom_email_templates?: Json
          default_cancellation_policy?: string
          default_payment_timing?: string
          email: string
          handle?: string | null
          headline?: string | null
          ical_token?: string | null
          id?: string
          invoice_terms?: string
          is_public?: boolean
          mileage_rate_cents?: number
          name: string
          notification_settings?: Json
          phone?: string | null
          public_display_name?: string | null
          reminder_cadence?: Json
          reminder_templates?: Json
          session_reminder_lead_hours?: number
          show_bio?: boolean
          show_phone?: boolean
          show_prices?: boolean
          sms_enabled?: boolean
          standard_rate_cents?: number
          stripe_account_id?: string | null
          subjects?: string | null
          travel_rate_cents?: number | null
          tutor_code?: string
          welcome_note?: string | null
        }
        Update: {
          auth_user_id?: string
          avatar_path?: string | null
          bill_travel_default?: boolean
          bio?: string | null
          booking_cta_label?: string
          cancellation_window_hours?: number
          created_at?: string
          custom_email_templates?: Json
          default_cancellation_policy?: string
          default_payment_timing?: string
          email?: string
          handle?: string | null
          headline?: string | null
          ical_token?: string | null
          id?: string
          invoice_terms?: string
          is_public?: boolean
          mileage_rate_cents?: number
          name?: string
          notification_settings?: Json
          phone?: string | null
          public_display_name?: string | null
          reminder_cadence?: Json
          reminder_templates?: Json
          session_reminder_lead_hours?: number
          show_bio?: boolean
          show_phone?: boolean
          show_prices?: boolean
          sms_enabled?: boolean
          standard_rate_cents?: number
          stripe_account_id?: string | null
          subjects?: string | null
          travel_rate_cents?: number | null
          tutor_code?: string
          welcome_note?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string
          id: string
          name: string
          role: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          role: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      parent_visible_sessions: {
        Row: {
          client_id: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string | null
          location: string | null
          meeting_link: string | null
          occurred_on: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["session_status"] | null
          travel_minutes: number | null
          tutor_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string | null
          location?: string | null
          meeting_link?: string | null
          occurred_on?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status"] | null
          travel_minutes?: number | null
          tutor_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string | null
          location?: string | null
          meeting_link?: string | null
          occurred_on?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["session_status"] | null
          travel_minutes?: number | null
          tutor_id?: string | null
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
    }
    Functions: {
      activate_package_for_invoice: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      add_gated_resource_line_item: {
        Args: { p_invoice_id: string; p_resource_id: string }
        Returns: string
      }
      add_manual_line_item: {
        Args: {
          p_amount_cents: number
          p_description: string
          p_invoice_id: string
        }
        Returns: string
      }
      approve_booking: { Args: { p_booking_id: string }; Returns: undefined }
      cancel_booking: { Args: { p_booking_id: string }; Returns: undefined }
      cancel_booking_link: {
        Args: { p_booking_link_id: string }
        Returns: undefined
      }
      cancel_session: {
        Args: { p_override_handling?: string; p_session_id: string }
        Returns: Json
      }
      confirm_booking_link: {
        Args: {
          p_parent_email: string
          p_parent_name: string
          p_slot_id: string
          p_student_name?: string
          p_token: string
        }
        Returns: string
      }
      confirm_open_booking_link: {
        Args: {
          p_parent_email: string
          p_parent_name: string
          p_start_ts: string
          p_student_name?: string
          p_token: string
        }
        Returns: Json
      }
      confirm_pending_student: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      confirm_public_service_booking: {
        Args: {
          p_handle: string
          p_parent_email: string
          p_parent_name: string
          p_service_id: string
          p_start_ts: string
          p_student_name?: string
        }
        Returns: Json
      }
      create_booking: {
        Args: {
          p_duration_minutes: number
          p_requested_start: string
          p_service_id?: string
          p_student_id: string
        }
        Returns: string
      }
      create_booking_link: {
        Args: {
          p_duration_minutes: number
          p_service_id: string
          p_slot_starts: string[]
          p_student_id: string
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
      create_invite: { Args: { p_student_id: string }; Returns: string }
      create_open_availability_booking_link: {
        Args: {
          p_buffer_minutes: number
          p_duration_minutes: number
          p_service_id: string
          p_student_id: string
        }
        Returns: string
      }
      create_package: {
        Args: {
          p_client_id: string
          p_custom_price_per_session_cents: number
          p_discount_amount_cents: number
          p_discount_percent: number
          p_discount_type: string
          p_is_public: boolean
          p_name: string
          p_service_id: string
          p_total_sessions: number
        }
        Returns: Json
      }
      create_session_for_booking: {
        Args: {
          p_client_id: string
          p_duration_minutes: number
          p_occurred_on: string
          p_service_id?: string
          p_start_time: string
          p_tutor_id: string
        }
        Returns: string
      }
      create_session_with_package: {
        Args: {
          p_client_id: string
          p_duration_minutes: number
          p_location: string
          p_notes: string
          p_occurred_on: string
          p_package_id: string
          p_start_time: string
          p_travel_minutes: number
        }
        Returns: string
      }
      create_student: {
        Args: {
          p_bill_travel: boolean
          p_custom_rate_cents: number
          p_is_philanthropic: boolean
          p_needs_goals: string
          p_notes: string
          p_payer_email: string
          p_payer_name: string
          p_payer_phone: string
          p_rate_type: Database["public"]["Enums"]["rate_type"]
          p_scheduling_mode: string
          p_sms_opt_in: boolean
          p_student_name: string
          p_travel_rate_cents: number
        }
        Returns: {
          archived: boolean
          auto_invoice_enabled: boolean
          auto_invoice_next_date: string | null
          auto_invoice_trigger: string
          bill_travel: boolean | null
          class_id: string | null
          created_at: string
          custom_rate_cents: number | null
          id: string
          is_philanthropic: boolean
          needs_goals: string | null
          notes: string | null
          payer_email: string | null
          payer_name: string | null
          payer_phone: string | null
          pending_parent_review: boolean
          rate_type: Database["public"]["Enums"]["rate_type"]
          scheduling_mode: string
          sms_opt_in: boolean
          student_name: string
          travel_rate_cents: number | null
          tutor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_tutor_id: { Args: never; Returns: string }
      decline_booking: { Args: { p_booking_id: string }; Returns: undefined }
      delete_draft_invoice: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      delete_service: { Args: { p_service_id: string }; Returns: undefined }
      delete_session: { Args: { p_session_id: string }; Returns: undefined }
      delete_student: { Args: { p_student_id: string }; Returns: undefined }
      end_recurring_series: {
        Args: {
          p_from_date: string
          p_override_handling?: string
          p_recurring_session_id: string
        }
        Returns: Json
      }
      founder_is_allowlisted: { Args: never; Returns: boolean }
      generate_open_slots: {
        Args: {
          p_buffer_minutes: number
          p_date: string
          p_duration_minutes: number
          p_tutor_id: string
        }
        Returns: string[]
      }
      generate_tutor_code: { Args: never; Returns: string }
      get_booking_link_public: { Args: { p_token: string }; Returns: Json }
      get_ical_feed: { Args: { p_token: string }; Returns: Json }
      get_invoice_document: { Args: { p_invoice_id: string }; Returns: Json }
      get_open_availability_slots: {
        Args: { p_date: string; p_token: string }
        Returns: Json
      }
      get_parent_resource_url: {
        Args: { p_resource_id: string }
        Returns: {
          locked: boolean
          type: Database["public"]["Enums"]["resource_type"]
          url_or_path: string
        }[]
      }
      get_parent_resources: {
        Args: never
        Returns: {
          created_at: string
          gate_price_cents: number
          gate_status: string
          id: string
          student_id: string
          student_name: string
          title: string
          type: Database["public"]["Enums"]["resource_type"]
          url_or_path: string
        }[]
      }
      get_public_service: {
        Args: { p_handle: string; p_service_id: string }
        Returns: Json
      }
      get_public_service_slots: {
        Args: { p_date: string; p_handle: string; p_service_id: string }
        Returns: Json
      }
      get_public_tutor_profile: { Args: { p_handle: string }; Returns: Json }
      get_tutor_name_for_code: { Args: { p_code: string }; Returns: string }
      get_unclaimed_students_for_tutor_code: {
        Args: { p_code: string }
        Returns: Json
      }
      is_handle_available: { Args: { p_handle: string }; Returns: boolean }
      is_parent_of_session: { Args: { p_session_id: string }; Returns: boolean }
      is_parent_of_student: { Args: { p_student_id: string }; Returns: boolean }
      is_slot_bookable: {
        Args: {
          p_buffer_minutes: number
          p_duration_minutes: number
          p_start_ts: string
          p_tutor_id: string
        }
        Returns: boolean
      }
      is_tutor_of_client: { Args: { p_client_id: string }; Returns: boolean }
      log_invite_send: {
        Args: {
          p_channel: string
          p_parent_email: string
          p_parent_name: string
          p_student_id: string
        }
        Returns: undefined
      }
      log_reminder: {
        Args: {
          p_channel?: string
          p_invoice_id: string
          p_template_key: string
        }
        Returns: string
      }
      manually_unlock_resource_gate: {
        Args: { p_gate_id: string }
        Returns: undefined
      }
      mark_invoice_paid: {
        Args: { p_invoice_id: string; p_method: string }
        Returns: undefined
      }
      merge_pending_student: {
        Args: { p_pending_student_id: string; p_target_student_id: string }
        Returns: undefined
      }
      move_service: {
        Args: { p_direction: string; p_service_id: string }
        Returns: undefined
      }
      recompute_invoice_totals: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      redeem_invite: { Args: { p_code: string }; Returns: string }
      redeem_tutor_code: {
        Args: {
          p_child_name?: string
          p_code: string
          p_existing_student_id?: string
        }
        Returns: string
      }
      regenerate_ical_token: { Args: never; Returns: string }
      regenerate_invite: { Args: { p_student_id: string }; Returns: string }
      remove_line_item: { Args: { p_line_item_id: string }; Returns: undefined }
      remove_resource_gate: {
        Args: { p_resource_id: string }
        Returns: undefined
      }
      revoke_invite: { Args: { p_student_id: string }; Returns: undefined }
      run_client_auto_invoice: {
        Args: { p_client_id: string }
        Returns: string
      }
      send_invoice: { Args: { p_invoice_id: string }; Returns: undefined }
      session_amount_cents: {
        Args: {
          p_bill_travel: boolean
          p_duration_minutes: number
          p_effective_rate_cents: number
          p_service_price_cents?: number
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
      set_package_public: {
        Args: { p_is_public: boolean; p_package_id: string }
        Returns: undefined
      }
      set_resource_gate: {
        Args: { p_price_cents: number; p_resource_id: string }
        Returns: string
      }
      unlock_gated_resources_for_invoice: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      update_session: {
        Args: {
          p_duration_minutes: number
          p_location: string
          p_meeting_link?: string
          p_notes: string
          p_occurred_on: string
          p_session_id: string
          p_start_time: string
          p_travel_minutes: number
        }
        Returns: undefined
      }
      void_invoice: { Args: { p_invoice_id: string }; Returns: undefined }
    }
    Enums: {
      booking_mode: "request" | "calendar" | "message"
      booking_status: "requested" | "confirmed" | "declined" | "cancelled"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "void"
      rate_type:
        | "standard"
        | "professional_discount"
        | "friend"
        | "low_income"
        | "pro_bono"
      resource_type: "file" | "link"
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
      booking_mode: ["request", "calendar", "message"],
      booking_status: ["requested", "confirmed", "declined", "cancelled"],
      invoice_status: ["draft", "sent", "paid", "overdue", "void"],
      rate_type: [
        "standard",
        "professional_discount",
        "friend",
        "low_income",
        "pro_bono",
      ],
      resource_type: ["file", "link"],
      session_status: ["logged", "billed"],
    },
  },
} as const
