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
          max_bookings: number
          sitter_id: string
          start_minute: number
          weekday: number
        }
        Insert: {
          created_at?: string
          end_minute: number
          id?: string
          max_bookings?: number
          sitter_id: string
          start_minute: number
          weekday: number
        }
        Update: {
          created_at?: string
          end_minute?: number
          id?: string
          max_bookings?: number
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
      booking_notification_attempts: {
        Row: {
          attempt_number: number
          attempted_by: string | null
          booking_id: string
          created_at: string
          error_message: string | null
          id: string
          message: string
          notification_type: string
          status: string
          trigger_source: string
        }
        Insert: {
          attempt_number: number
          attempted_by?: string | null
          booking_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message: string
          notification_type: string
          status: string
          trigger_source: string
        }
        Update: {
          attempt_number?: number
          attempted_by?: string | null
          booking_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          notification_type?: string
          status?: string
          trigger_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_notification_attempts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_request_groups: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          label: string | null
          notes: string | null
          sitter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          label?: string | null
          notes?: string | null
          sitter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          label?: string | null
          notes?: string | null
          sitter_id?: string
          status?: string
          updated_at?: string
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
          base_price_cents: number | null
          booking_kind: string
          bundle_position: number
          cancelled_at: string | null
          created_at: string
          customer_id: string
          deposit_cents: number
          end_at: string
          extra_time_fee_cents: number
          extra_time_minutes: number
          group_assignment_label: string | null
          id: string
          internal_notes: string | null
          late_pickup_fee_cents: number
          notes: string | null
          paid_at: string | null
          payment_amount_cents: number | null
          payment_status: string
          pet_id: string
          recurrence_label: string | null
          recurrence_pattern: Json | null
          refund_amount_cents: number
          refund_id: string | null
          request_group_id: string | null
          request_group_label: string | null
          requested_date: string | null
          requested_end_date: string | null
          requested_window_end_minute: number | null
          requested_window_label: string | null
          requested_window_start_minute: number | null
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          service_id: string
          service_variant_id: string | null
          sitter_id: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id: string | null
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          total_cents: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          base_price_cents?: number | null
          booking_kind?: string
          bundle_position?: number
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          deposit_cents: number
          end_at: string
          extra_time_fee_cents?: number
          extra_time_minutes?: number
          group_assignment_label?: string | null
          id?: string
          internal_notes?: string | null
          late_pickup_fee_cents?: number
          notes?: string | null
          paid_at?: string | null
          payment_amount_cents?: number | null
          payment_status?: string
          pet_id: string
          recurrence_label?: string | null
          recurrence_pattern?: Json | null
          refund_amount_cents?: number
          refund_id?: string | null
          request_group_id?: string | null
          request_group_label?: string | null
          requested_date?: string | null
          requested_end_date?: string | null
          requested_window_end_minute?: number | null
          requested_window_label?: string | null
          requested_window_start_minute?: number | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          service_id: string
          service_variant_id?: string | null
          sitter_id: string
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          total_cents: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          base_price_cents?: number | null
          booking_kind?: string
          bundle_position?: number
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          deposit_cents?: number
          end_at?: string
          extra_time_fee_cents?: number
          extra_time_minutes?: number
          group_assignment_label?: string | null
          id?: string
          internal_notes?: string | null
          late_pickup_fee_cents?: number
          notes?: string | null
          paid_at?: string | null
          payment_amount_cents?: number | null
          payment_status?: string
          pet_id?: string
          recurrence_label?: string | null
          recurrence_pattern?: Json | null
          refund_amount_cents?: number
          refund_id?: string | null
          request_group_id?: string | null
          request_group_label?: string | null
          requested_date?: string | null
          requested_end_date?: string | null
          requested_window_end_minute?: number | null
          requested_window_label?: string | null
          requested_window_start_minute?: number | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          service_id?: string
          service_variant_id?: string | null
          sitter_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
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
            foreignKeyName: "bookings_request_group_id_fkey"
            columns: ["request_group_id"]
            isOneToOne: false
            referencedRelation: "booking_request_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_variant_id_fkey"
            columns: ["service_variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_admin_profiles: {
        Row: {
          client_id: string
          created_at: string
          id: string
          internal_notes: string | null
          last_updated_by: string | null
          star_rating: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          last_updated_by?: string | null
          star_rating?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          last_updated_by?: string | null
          star_rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_message_reads: {
        Row: {
          client_message_id: string
          created_at: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          client_message_id: string
          created_at?: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          client_message_id?: string
          created_at?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_message_reads_client_message_id_fkey"
            columns: ["client_message_id"]
            isOneToOne: false
            referencedRelation: "client_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      client_messages: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivered_email_at: string | null
          delivered_sms_at: string | null
          id: string
          kind: Database["public"]["Enums"]["client_message_kind"]
          message: string
          send_email: boolean
          send_sms: boolean
          sitter_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          delivered_email_at?: string | null
          delivered_sms_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["client_message_kind"]
          message: string
          send_email?: boolean
          send_sms?: boolean
          sitter_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          delivered_email_at?: string | null
          delivered_sms_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["client_message_kind"]
          message?: string
          send_email?: boolean
          send_sms?: boolean
          sitter_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          is_anonymous: boolean
          rating: number
          sitter_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_anonymous?: boolean
          rating: number
          sitter_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_anonymous?: boolean
          rating?: number
          sitter_id?: string
          updated_at?: string
        }
        Relationships: []
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
      invoice_line_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          kind: string
          label: string
          quantity: number
          sort_order: number
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          kind?: string
          label: string
          quantity?: number
          sort_order?: number
          total_cents?: number
          unit_price_cents?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          kind?: string
          label?: string
          quantity?: number
          sort_order?: number
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid_cents: number
          booking_id: string | null
          created_at: string
          customer_id: string
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          promotion_id: string | null
          public_token: string
          request_group_id: string | null
          sent_at: string | null
          sitter_id: string
          status: string
          subtotal_cents: number
          tax_cents: number
          tax_label: string | null
          tax_rate_percent: number | null
          total_cents: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_paid_cents?: number
          booking_id?: string | null
          created_at?: string
          customer_id: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          promotion_id?: string | null
          public_token?: string
          request_group_id?: string | null
          sent_at?: string | null
          sitter_id: string
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          tax_label?: string | null
          tax_rate_percent?: number | null
          total_cents?: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_paid_cents?: number
          booking_id?: string | null
          created_at?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          promotion_id?: string | null
          public_token?: string
          request_group_id?: string | null
          sent_at?: string | null
          sitter_id?: string
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          tax_label?: string | null
          tax_rate_percent?: number | null
          total_cents?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_request_group_id_fkey"
            columns: ["request_group_id"]
            isOneToOne: false
            referencedRelation: "booking_request_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sitter_id_fkey"
            columns: ["sitter_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount_cents: number | null
          booking_id: string | null
          channel: string | null
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          kind: string
          metadata: Json
        }
        Insert: {
          amount_cents?: number | null
          booking_id?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          kind: string
          metadata?: Json
        }
        Update: {
          amount_cents?: number | null
          booking_id?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          metadata?: Json
        }
        Relationships: []
      }
      pet_fit_alerts: {
        Row: {
          approval_id: string | null
          booking_id: string | null
          conflicting_tag_ids: string[]
          created_at: string
          id: string
          is_resolved: boolean
          message: string
          pet_id: string
          resolved_at: string | null
          resolved_by: string | null
          service_id: string
          severity: string
          title: string
          triggered_by: string
          updated_at: string
        }
        Insert: {
          approval_id?: string | null
          booking_id?: string | null
          conflicting_tag_ids?: string[]
          created_at?: string
          id?: string
          is_resolved?: boolean
          message: string
          pet_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          service_id: string
          severity?: string
          title: string
          triggered_by: string
          updated_at?: string
        }
        Update: {
          approval_id?: string | null
          booking_id?: string | null
          conflicting_tag_ids?: string[]
          created_at?: string
          id?: string
          is_resolved?: boolean
          message?: string
          pet_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          service_id?: string
          severity?: string
          title?: string
          triggered_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_fit_alerts_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "sitter_pet_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_fit_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_fit_alerts_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_fit_alerts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_tag_assignments: {
        Row: {
          created_at: string
          created_by: string
          id: string
          pet_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          pet_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          pet_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_tag_assignments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "pet_temperament_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_temperament_tags: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          risk_message: string | null
          risk_services: string[]
          slug: string
          sort_order: number
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          risk_message?: string | null
          risk_services?: string[]
          slug: string
          sort_order?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          risk_message?: string | null
          risk_services?: string[]
          slug?: string
          sort_order?: number
          updated_at?: string
          visibility?: string
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
          temperament_notes: string | null
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
          temperament_notes?: string | null
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
          temperament_notes?: string | null
          updated_at?: string
          vet_address?: string | null
          vet_info?: string | null
          vet_name?: string | null
          vet_phone?: string | null
          weight_lbs?: number | null
        }
        Relationships: []
      }
      processed_stripe_events: {
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
      profiles: {
        Row: {
          address_geocoded_at: string | null
          address_lat: number | null
          address_line1: string | null
          address_line2: string | null
          address_lng: number | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          default_payment_method_id: string | null
          full_name: string | null
          id: string
          mobile_phone: string | null
          phone: string | null
          postal_code: string | null
          province: string | null
          sms_opt_in: boolean
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          address_geocoded_at?: string | null
          address_lat?: number | null
          address_line1?: string | null
          address_line2?: string | null
          address_lng?: number | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          default_payment_method_id?: string | null
          full_name?: string | null
          id: string
          mobile_phone?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          sms_opt_in?: boolean
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          address_geocoded_at?: string | null
          address_lat?: number | null
          address_line1?: string | null
          address_line2?: string | null
          address_lng?: number | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          default_payment_method_id?: string | null
          full_name?: string | null
          id?: string
          mobile_phone?: string | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          sms_opt_in?: boolean
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          applicable_service_ids: string[] | null
          code: string | null
          created_at: string
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          name: string
          sitter_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          applicable_service_ids?: string[] | null
          code?: string | null
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name: string
          sitter_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          applicable_service_ids?: string[] | null
          code?: string | null
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name?: string
          sitter_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          auto_enabled: boolean
          cadence: Json
          created_at: string
          default_tone: string
          sitter_id: string
          updated_at: string
        }
        Insert: {
          auto_enabled?: boolean
          cadence?: Json
          created_at?: string
          default_tone?: string
          sitter_id: string
          updated_at?: string
        }
        Update: {
          auto_enabled?: boolean
          cadence?: Json
          created_at?: string
          default_tone?: string
          sitter_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_alert_reads: {
        Row: {
          created_at: string
          id: string
          read_at: string
          service_alert_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          read_at?: string
          service_alert_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          read_at?: string
          service_alert_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_alert_reads_service_alert_id_fkey"
            columns: ["service_alert_id"]
            isOneToOne: false
            referencedRelation: "service_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_alerts: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["service_alert_kind"]
          message: string
          pin_to_profile: boolean
          sitter_id: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["service_alert_kind"]
          message: string
          pin_to_profile?: boolean
          sitter_id: string
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["service_alert_kind"]
          message?: string
          pin_to_profile?: boolean
          sitter_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_variants: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          payment_mode: string
          price_cents: number
          service_id: string
          sibling_discount_percent: number
          slug: string
          sort_order: number
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          payment_mode?: string
          price_cents: number
          service_id: string
          sibling_discount_percent?: number
          slug: string
          sort_order?: number
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          payment_mode?: string
          price_cents?: number
          service_id?: string
          sibling_discount_percent?: number
          slug?: string
          sort_order?: number
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          approval_required: boolean
          boarding_checkin_minute: number | null
          boarding_checkout_minute: number | null
          capacity_mode: Database["public"]["Enums"]["service_capacity_mode"]
          created_at: string
          description: string | null
          duration_minutes: number
          extra_time_fee_cents: number | null
          extra_time_increment_minutes: number | null
          id: string
          is_active: boolean
          late_pickup_fee_cents: number | null
          max_capacity: number
          name: string
          payment_mode: string
          price_cents: number
          requires_pet_approval: boolean
          scheduling_mode: Database["public"]["Enums"]["service_scheduling_mode"]
          slug: string
          sort_order: number
          stripe_price_id: string | null
          turnaround_buffer_minutes: number
          unit_label: string | null
        }
        Insert: {
          approval_required?: boolean
          boarding_checkin_minute?: number | null
          boarding_checkout_minute?: number | null
          capacity_mode?: Database["public"]["Enums"]["service_capacity_mode"]
          created_at?: string
          description?: string | null
          duration_minutes: number
          extra_time_fee_cents?: number | null
          extra_time_increment_minutes?: number | null
          id?: string
          is_active?: boolean
          late_pickup_fee_cents?: number | null
          max_capacity?: number
          name: string
          payment_mode?: string
          price_cents: number
          requires_pet_approval?: boolean
          scheduling_mode?: Database["public"]["Enums"]["service_scheduling_mode"]
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          turnaround_buffer_minutes?: number
          unit_label?: string | null
        }
        Update: {
          approval_required?: boolean
          boarding_checkin_minute?: number | null
          boarding_checkout_minute?: number | null
          capacity_mode?: Database["public"]["Enums"]["service_capacity_mode"]
          created_at?: string
          description?: string | null
          duration_minutes?: number
          extra_time_fee_cents?: number | null
          extra_time_increment_minutes?: number | null
          id?: string
          is_active?: boolean
          late_pickup_fee_cents?: number | null
          max_capacity?: number
          name?: string
          payment_mode?: string
          price_cents?: number
          requires_pet_approval?: boolean
          scheduling_mode?: Database["public"]["Enums"]["service_scheduling_mode"]
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          turnaround_buffer_minutes?: number
          unit_label?: string | null
        }
        Relationships: []
      }
      sitter_notifications: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message: string
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sitter_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      sitter_pet_approvals: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          pet_id: string
          service_id: string
          sitter_id: string
          status: Database["public"]["Enums"]["pet_approval_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          pet_id: string
          service_id: string
          sitter_id: string
          status?: Database["public"]["Enums"]["pet_approval_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          pet_id?: string
          service_id?: string
          sitter_id?: string
          status?: Database["public"]["Enums"]["pet_approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sitter_pet_approvals_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sitter_pet_approvals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      sitter_settings: {
        Row: {
          auto_invoice_on_confirm: boolean
          created_at: string
          default_due_days: number
          sitter_id: string
          tax_enabled: boolean
          tax_label: string
          tax_rate_percent: number
          tax_registration_number: string | null
          updated_at: string
        }
        Insert: {
          auto_invoice_on_confirm?: boolean
          created_at?: string
          default_due_days?: number
          sitter_id: string
          tax_enabled?: boolean
          tax_label?: string
          tax_rate_percent?: number
          tax_registration_number?: string | null
          updated_at?: string
        }
        Update: {
          auto_invoice_on_confirm?: boolean
          created_at?: string
          default_due_days?: number
          sitter_id?: string
          tax_enabled?: boolean
          tax_label?: string
          tax_rate_percent?: number
          tax_registration_number?: string | null
          updated_at?: string
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
          max_bookings: number
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
          max_bookings?: number
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
          max_bookings?: number
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
      profiles_public: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_sibling_discount: {
        Args: { _booking_id: string; _request_group_id: string }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_expired_service_alerts: { Args: never; Returns: number }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_invoice_number: { Args: never; Returns: string }
      get_blocked_dates: {
        Args: { _sitter_id?: string }
        Returns: {
          blocked_date: string
          id: string
          sitter_id: string
        }[]
      }
      get_public_invoice: { Args: { _token: string }; Returns: Json }
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
      booking_update_kind:
        | "pickup"
        | "dropoff"
        | "note"
        | "approval"
        | "arrived"
        | "departed"
      client_message_kind: "service_update" | "customer_service" | "offer"
      pet_approval_status: "pending" | "approved" | "declined"
      service_alert_kind: "hours_update" | "closure" | "announcement" | "promo"
      service_capacity_mode: "single" | "shared"
      service_scheduling_mode: "instant" | "request" | "boarding"
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
      booking_update_kind: [
        "pickup",
        "dropoff",
        "note",
        "approval",
        "arrived",
        "departed",
      ],
      client_message_kind: ["service_update", "customer_service", "offer"],
      pet_approval_status: ["pending", "approved", "declined"],
      service_alert_kind: ["hours_update", "closure", "announcement", "promo"],
      service_capacity_mode: ["single", "shared"],
      service_scheduling_mode: ["instant", "request", "boarding"],
    },
  },
} as const
