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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          archived_at: string | null
          board_sort_order: number | null
          business_id: string
          client_id: string | null
          completed_at: string | null
          created_at: string | null
          end_time: string
          id: string
          internal_notes: string | null
          location_type: Database["public"]["Enums"]["location_type"] | null
          metadata: Json | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pipeline_stage_id: string
          price_total: number | null
          service_id: string | null
          staff_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          target_address: string | null
          title: string | null
          team_id: string | null
          visibility: string
          created_by: string | null
        }
        Insert: {
          archived_at?: string | null
          board_sort_order?: number | null
          business_id: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          internal_notes?: string | null
          location_type?: Database["public"]["Enums"]["location_type"] | null
          metadata?: Json | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          pipeline_stage_id?: string
          price_total?: number | null
          service_id?: string | null
          staff_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          target_address?: string | null
          title?: string | null
          team_id?: string | null
          visibility?: string
          created_by?: string | null
        }
        Update: {
          archived_at?: string | null
          board_sort_order?: number | null
          business_id?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          internal_notes?: string | null
          location_type?: Database["public"]["Enums"]["location_type"] | null
          metadata?: Json | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          pipeline_stage_id?: string
          price_total?: number | null
          service_id?: string | null
          staff_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          target_address?: string | null
          title?: string | null
          team_id?: string | null
          visibility?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          appointment_id: string
          business_id: string
          created_at: string
          id: string
          new_record: Json | null
          old_record: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          appointment_id: string
          business_id: string
          created_at?: string
          id?: string
          new_record?: Json | null
          old_record?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          appointment_id?: string
          business_id?: string
          created_at?: string
          id?: string
          new_record?: Json | null
          old_record?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_teams: {
        Row: {
          appointment_id: string
          team_id: string
        }
        Insert: {
          appointment_id: string
          team_id: string
        }
        Update: {
          appointment_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_teams_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          is_lead: boolean
          joined_at: string | null
          staff_id: string
          team_id: string
        }
        Insert: {
          id?: string
          is_lead?: boolean
          joined_at?: string | null
          staff_id: string
          team_id: string
        }
        Update: {
          id?: string
          is_lead?: boolean
          joined_at?: string | null
          staff_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          business_id: string
          color: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          business_id: string
          color: string | null
          created_at: string | null
          id: string
          label: string
          slug: string
          sort_order: number
          stage_category: string
        }
        Insert: {
          business_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          label: string
          slug: string
          sort_order?: number
          stage_category?: string
        }
        Update: {
          business_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          label?: string
          slug?: string
          sort_order?: number
          stage_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          business_id: string
          close_time: string
          created_at: string | null
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string
          shift_name: string | null
        }
        Insert: {
          business_id: string
          close_time: string
          created_at?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time: string
          shift_name?: string | null
        }
        Update: {
          business_id?: string
          close_time?: string
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string
          shift_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          booking_settings: Json | null
          business_name: string | null
          clock_in_method: string | null
          config_json: Json | null
          country: string | null
          created_at: string | null
          currency: string | null
          geofence_lat: number | null
          geofence_lng: number | null
          geofence_radius_meters: number | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string | null
          notification_settings: Json | null
          onboarding_completed: boolean | null
          owner_name: string | null
          owner_phone: string | null
          owner_uid: string
          permission_matrix: Json | null
          plan: string | null
          slug: string | null
          timezone: string | null
          wa_connected_phone: string | null
          wa_instance_name: string | null
          wa_status: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          booking_settings?: Json | null
          business_name?: string | null
          clock_in_method?: string | null
          config_json?: Json | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_meters?: number | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string | null
          notification_settings?: Json | null
          onboarding_completed?: boolean | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_uid: string
          permission_matrix?: Json | null
          plan?: string | null
          slug?: string | null
          timezone?: string | null
          wa_connected_phone?: string | null
          wa_instance_name?: string | null
          wa_status?: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          booking_settings?: Json | null
          business_name?: string | null
          clock_in_method?: string | null
          config_json?: Json | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_meters?: number | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string | null
          notification_settings?: Json | null
          onboarding_completed?: boolean | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_uid?: string
          permission_matrix?: Json | null
          plan?: string | null
          slug?: string | null
          timezone?: string | null
          wa_connected_phone?: string | null
          wa_instance_name?: string | null
          wa_status?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          business_id: string
          created_at: string | null
          email: string | null
          id: string
          last_visit: string | null
          metadata: Json | null
          name: string
          notes: string | null
          phone: string
          tags: string[] | null
          total_spent: number | null
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          last_visit?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          phone: string
          tags?: string[] | null
          total_spent?: number | null
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          last_visit?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          phone?: string
          tags?: string[] | null
          total_spent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          category: string
          created_at: string | null
          date: string
          description: string | null
          id: string
          notes: string | null
          receipt_url: string | null
        }
        Insert: {
          amount: number
          business_id: string
          category: string
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          notes?: string | null
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          category?: string
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          notes?: string | null
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_verification_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          business_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          permissions: Json | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          category: string | null
          color: string | null
          created_at: string | null
          deposit_amount: number | null
          description: string | null
          duration: number
          id: string
          is_active: boolean
          name: string
          price: number
          requires_deposit: boolean | null
        }
        Insert: {
          business_id: string
          category?: string | null
          color?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          duration: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          requires_deposit?: boolean | null
        }
        Update: {
          business_id?: string
          category?: string | null
          color?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          duration?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          requires_deposit?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          access_level: string | null
          address: string | null
          avatar_url: string | null
          business_id: string
          color: string | null
          contract_hours_per_week: number | null
          contract_type: string | null
          created_at: string | null
          deleted_at: string | null
          dni: string | null
          email: string | null
          end_date: string | null
          hire_date: string | null
          id: string
          invitation_status: string | null
          is_active: boolean | null
          metadata: Json | null
          name: string
          nif: string | null
          phone: string | null
          role: string | null
          schedule: Json | null
          vacation_days_per_year: number | null
        }
        Insert: {
          access_level?: string | null
          address?: string | null
          avatar_url?: string | null
          business_id: string
          color?: string | null
          contract_hours_per_week?: number | null
          contract_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dni?: string | null
          email?: string | null
          end_date?: string | null
          hire_date?: string | null
          id?: string
          invitation_status?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          nif?: string | null
          phone?: string | null
          role?: string | null
          schedule?: Json | null
          vacation_days_per_year?: number | null
        }
        Update: {
          access_level?: string | null
          address?: string | null
          avatar_url?: string | null
          business_id?: string
          color?: string | null
          contract_hours_per_week?: number | null
          contract_type?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dni?: string | null
          email?: string | null
          end_date?: string | null
          hire_date?: string | null
          id?: string
          invitation_status?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          nif?: string | null
          phone?: string | null
          role?: string | null
          schedule?: Json | null
          vacation_days_per_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_absence_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_id: string
          created_at: string | null
          end_date: string
          id: string
          notes: string | null
          rejection_reason: string | null
          staff_id: string
          start_date: string
          status: string
          type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_id: string
          created_at?: string | null
          end_date: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          staff_id: string
          start_date: string
          status?: string
          type?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          staff_id?: string
          start_date?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_absence_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_absence_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_documents: {
        Row: {
          business_id: string
          category: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          requires_signature: boolean
          staff_id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          business_id: string
          category?: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          requires_signature?: boolean
          staff_id: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          business_id?: string
          category?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          requires_signature?: boolean
          staff_id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invite_token: string
          staff_id: string
          used: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invite_token: string
          staff_id: string
          used?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          staff_id?: string
          used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shifts: {
        Row: {
          business_id: string
          created_at: string | null
          date: string
          duration_hours: number | null
          end_time: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          recurrence_parent_id: string | null
          recurrence_pattern: Json | null
          shift_type: string | null
          staff_id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          date: string
          duration_hours?: number | null
          end_time: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          recurrence_parent_id?: string | null
          recurrence_pattern?: Json | null
          shift_type?: string | null
          staff_id: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          date?: string
          duration_hours?: number | null
          end_time?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          recurrence_parent_id?: string | null
          recurrence_pattern?: Json | null
          shift_type?: string | null
          staff_id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_shifts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shifts_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "staff_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_signatures: {
        Row: {
          business_id: string
          content_hash: string | null
          created_at: string | null
          document_type: string
          id: string
          notes: string | null
          reference_id: string | null
          reference_period: string | null
          requested_at: string | null
          signed_at: string | null
          signed_ip: string | null
          signature_asset_url: string | null
          signed_device: string | null
          staff_id: string
          status: string
        }
        Insert: {
          business_id: string
          content_hash?: string | null
          created_at?: string | null
          document_type: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_period?: string | null
          requested_at?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signature_asset_url?: string | null
          signed_device?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          business_id?: string
          content_hash?: string | null
          created_at?: string | null
          document_type?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_period?: string | null
          requested_at?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signature_asset_url?: string | null
          signed_device?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_signatures_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_signatures_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      sign_sessions: {
        Row: {
          id: string
          signature_id: string
          token: string
          expires_at: string
          used: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          signature_id: string
          token: string
          expires_at: string
          used?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          signature_id?: string
          token?: string
          expires_at?: string
          used?: boolean
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sign_sessions_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "staff_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_vacation_balance: {
        Row: {
          business_id: string
          created_at: string | null
          days_allocated: number
          id: string
          notes: string | null
          staff_id: string
          updated_at: string | null
          year: number
        }
        Insert: {
          business_id: string
          created_at?: string | null
          days_allocated?: number
          id?: string
          notes?: string | null
          staff_id: string
          updated_at?: string | null
          year: number
        }
        Update: {
          business_id?: string
          created_at?: string | null
          days_allocated?: number
          id?: string
          notes?: string | null
          staff_id?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_vacation_balance_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_vacation_balance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          break_end: string | null
          break_start: string | null
          business_id: string
          clock_in: string
          clock_out: string | null
          created_at: string | null
          edited_by: string | null
          hours_worked: number | null
          id: string
          notes: string | null
          source: string | null
          staff_id: string
          verified_lat: number | null
          verified_lng: number | null
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          business_id: string
          clock_in: string
          clock_out?: string | null
          created_at?: string | null
          edited_by?: string | null
          hours_worked?: number | null
          id?: string
          notes?: string | null
          source?: string | null
          staff_id: string
          verified_lat?: number | null
          verified_lng?: number | null
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          business_id?: string
          clock_in?: string
          clock_out?: string | null
          created_at?: string | null
          edited_by?: string | null
          hours_worked?: number | null
          id?: string
          notes?: string | null
          source?: string | null
          staff_id?: string
          verified_lat?: number | null
          verified_lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_completed_appointments: { Args: never; Returns: number }
      check_business_access: {
        Args: { business_id_param: string }
        Returns: boolean
      }
      get_my_staff_business_id: { Args: never; Returns: string }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
        | "in_progress"
      location_type: "business_site" | "client_site" | "virtual"
      payment_status: "unpaid" | "partial" | "paid" | "refunded"
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
      appointment_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
        "in_progress",
      ],
      location_type: ["business_site", "client_site", "virtual"],
      payment_status: ["unpaid", "partial", "paid", "refunded"],
    },
  },
} as const
