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
  public: {
    Tables: {
      availability: {
        Row: {
          created_at: string
          end_minute: number
          id: string
          sitter_id: string
          start_minute: number
          weekday: number
        }
        Insert: {
          created_at?: string
          end_minute: number
          id?: string
          sitter_id: string
          start_minute: number
          weekday: number
        }
        Update: {
          created_at?: string
          end_minute?: number
          id?: string
          sitter_id?: string
          start_minute?: number
          weekday?: number
        }
        Relationships: []
      }
      availability_services: {
        Row: {
          availability_id: string
          created_at: string
          service_id: string
        }
        Insert: {
          availability_id: string
          created_at?: string
          service_id: string
        }
        Update: {
          availability_id?: string
          created_at?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_services_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          id: string
          reason: string | null
          sitter_id: string
        }
        Insert: {
          blocked_date: string
          created_at?: string
          id?: string
          reason?: string | null
          sitter_id: string
        }
        Update: {
          blocked_date?: string
          created_at?: string
          id?: string
          reason?: string | null
          sitter_id?: string
        }
        Relationships: []
      }
      booking_updates: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string
          id: string
          kind: Database["public"]["Enums"]["booking_update_kind"]
          message: string | null
          sent_via_sms: boolean
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by: string
          id?: string
          kind: Database["public"]["Enums"]["booking_update_kind"]
          message?: string | null
          sent_via_sms?: boolean
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_update_kind"]
          message?: string | null
          sent_via_sms?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          booking_kind: string
          cancelled_at: string | null
          created_at: string
          customer_id: string
          deposit_cents: number
          end_at: string
          group_assignment_label: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          paid_at: string | null
          payment_amount_cents: number | null
          pet_id: string
          refund_id: string | null
          requested_date: string | null
          requested_window_end_minute: number | null
          requested_window_label: string | null
          requested_window_start_minute: number | null
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          service_id: string
          sitter_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id: string | null
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          total_cents: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          booking_kind?: string
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          deposit_cents: number
          end_at: string
          group_assignment_label?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_amount_cents?: number | null
          pet_id: string
          refund_id?: string | null
          requested_date?: string | null
          requested_window_end_minute?: number | null
          requested_window_label?: string | null
          requested_window_start_minute?: number | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          service_id: string
          sitter_id: string
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          total_cents: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          booking_kind?: string
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          deposit_cents?: number
          end_at?: string
          group_assignment_label?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_amount_cents?: number | null
          pet_id?: string
          refund_id?: string | null
          requested_date?: string | null
          requested_window_end_minute?: number | null
          requested_window_label?: string | null
          requested_window_start_minute?: number | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          service_id?: string
          sitter_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      pets: {
        Row: {
          age_years: number | null
          allergies: string | null
          authorized_pickup_name: string | null
          authorized_pickup_phone: string | null
          behavioral_notes: string | null
          breed: string | null
          color: string | null
          created_at: string
          dietary_notes: string | null
          emergency_contact: string | null
          entry_code: string | null
          entry_instructions: string | null
          id: string
          insurance_policy: string | null
          insurance_provider: string | null
          medications: string | null
          microchip_id: string | null
          name: string
          notes: string | null
          owner_id: string
          owner_phone: string | null
          photo_url: string | null
          secondary_contact_name: string | null
          secondary_contact_phone: string | null
          sex: string | null
          spayed_neutered: boolean | null
          species: string
          updated_at: string
          vet_address: string | null
          vet_info: string | null
          vet_name: string | null
          vet_phone: string | null
          weight_lbs: number | null
        }
        Insert: {
          age_years?: number | null
          allergies?: string | null
          authorized_pickup_name?: string | null
          authorized_pickup_phone?: string | null
          behavioral_notes?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          dietary_notes?: string | null
          emergency_contact?: string | null
          entry_code?: string | null
          entry_instructions?: string | null
          id?: string
          insurance_policy?: string | null
          insurance_provider?: string | null
          medications?: string | null
          microchip_id?: string | null
          name: string
          notes?: string | null
          owner_id: string
          owner_phone?: string | null
          photo_url?: string | null
          secondary_contact_name?: string | null
          secondary_contact_phone?: string | null
          sex?: string | null
          spayed_neutered?: boolean | null
          species?: string
          updated_at?: string
          vet_address?: string | null
          vet_info?: string | null
          vet_name?: string | null
          vet_phone?: string | null
          weight_lbs?: number | null
        }
        Update: {
          age_years?: number | null
          allergies?: string | null
          authorized_pickup_name?: string | null
          authorized_pickup_phone?: string | null
          behavioral_notes?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          dietary_notes?: string | null
          emergency_contact?: string | null
          entry_code?: string | null
          entry_instructions?: string | null
          id?: string
          insurance_policy?: string | null
          insurance_provider?: string | null
          medications?: string | null
          microchip_id?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          owner_phone?: string | null
          photo_url?: string | null
          secondary_contact_name?: string | null
          secondary_contact_phone?: string | null
          sex?: string | null
          spayed_neutered?: boolean | null
          species?: string
          updated_at?: string
          vet_address?: string | null
          vet_info?: string | null
          vet_name?: string | null
          vet_phone?: string | null
          weight_lbs?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          mobile_phone: string | null
          phone: string | null
          sms_opt_in: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          mobile_phone?: string | null
          phone?: string | null
          sms_opt_in?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          mobile_phone?: string | null
          phone?: string | null
          sms_opt_in?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          payment_mode: string
          price_cents: number
          slug: string
          sort_order: number
          stripe_price_id: string | null
          unit_label: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          payment_mode?: string
          price_cents: number
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          unit_label?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          payment_mode?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          unit_label?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      walk_windows: {
        Row: {
          created_at: string
          end_minute: number
          id: string
          service_id: string
          sitter_id: string
          sort_order: number
          start_minute: number
          weekday: number
          window_label: string
        }
        Insert: {
          created_at?: string
          end_minute: number
          id?: string
          service_id: string
          sitter_id: string
          sort_order?: number
          start_minute: number
          weekday: number
          window_label: string
        }
        Update: {
          created_at?: string
          end_minute?: number
          id?: string
          service_id?: string
          sitter_id?: string
          sort_order?: number
          start_minute?: number
          weekday?: number
          window_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "walk_windows_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "customer" | "sitter" | "admin"
      booking_status:
        | "pending_payment"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "refunded"
        | "requested"
        | "awaiting_payment"
      booking_update_kind: "pickup" | "dropoff" | "note"
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
      app_role: ["customer", "sitter", "admin"],
      booking_status: [
        "pending_payment",
        "confirmed",
        "cancelled",
        "completed",
        "refunded",
        "requested",
        "awaiting_payment",
      ],
      booking_update_kind: ["pickup", "dropoff", "note"],
    },
  },
} as const
