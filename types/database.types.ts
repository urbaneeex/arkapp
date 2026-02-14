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
      appointments: {
        Row: {
          business_id: string
          client_id: string | null
          created_at: string | null
          end_time: string
          id: string
          internal_notes: string | null
          location_type: Database["public"]["Enums"]["location_type"] | null
          metadata: Json | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          price_total: number | null
          service_id: string | null
          staff_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          target_address: string | null
        }
        Insert: {
          business_id: string
          client_id?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          internal_notes?: string | null
          location_type?: Database["public"]["Enums"]["location_type"] | null
          metadata?: Json | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          price_total?: number | null
          service_id?: string | null
          staff_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          target_address?: string | null
        }
        Update: {
          business_id?: string
          client_id?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          internal_notes?: string | null
          location_type?: Database["public"]["Enums"]["location_type"] | null
          metadata?: Json | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          price_total?: number | null
          service_id?: string | null
          staff_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          target_address?: string | null
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
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
          config_json: Json | null
          created_at: string | null
          currency: string | null
          id: string
          name: string
          owner_uid: string
          slug: string
          timezone: string | null
          whatsapp_number: string | null
        }
        Insert: {
          config_json?: Json | null
          created_at?: string | null
          currency?: string | null
          id?: string
          name: string
          owner_uid: string
          slug: string
          timezone?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          config_json?: Json | null
          created_at?: string | null
          currency?: string | null
          id?: string
          name?: string
          owner_uid?: string
          slug?: string
          timezone?: string | null
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
          metadata: Json | null
          name: string
          notes: string | null
          phone: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          phone: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          phone?: string
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
      services: {
        Row: {
          business_id: string
          created_at: string | null
          deposit_amount: number | null
          description: string | null
          duration: number
          id: string
          name: string
          price: number
          requires_deposit: boolean | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          duration: number
          id?: string
          name: string
          price: number
          requires_deposit?: boolean | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          duration?: number
          id?: string
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
          business_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          phone?: string | null
          role?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
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
