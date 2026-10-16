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
      bed_events: {
        Row: {
          action: Database["public"]["Enums"]["bed_action"]
          actor_display: string | null
          actor_user_id: string | null
          bed_id: string | null
          bed_number: number | null
          bed_type: string | null
          created_at: string
          hospital_name: string
          id: string
          place_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["bed_action"]
          actor_display?: string | null
          actor_user_id?: string | null
          bed_id?: string | null
          bed_number?: number | null
          bed_type?: string | null
          created_at?: string
          hospital_name: string
          id?: string
          place_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["bed_action"]
          actor_display?: string | null
          actor_user_id?: string | null
          bed_id?: string | null
          bed_number?: number | null
          bed_type?: string | null
          created_at?: string
          hospital_name?: string
          id?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bed_events_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "hospital_beds"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_beds: {
        Row: {
          bed_number: number
          bed_type: Database["public"]["Enums"]["bed_type"]
          hospital_name: string
          id: string
          occupied_reason: string | null
          place_id: string
          reserved_at: string | null
          reserved_by: string | null
          reserved_by_user: string | null
          status: Database["public"]["Enums"]["bed_status"]
          updated_at: string
        }
        Insert: {
          bed_number: number
          bed_type: Database["public"]["Enums"]["bed_type"]
          hospital_name: string
          id?: string
          occupied_reason?: string | null
          place_id: string
          reserved_at?: string | null
          reserved_by?: string | null
          reserved_by_user?: string | null
          status?: Database["public"]["Enums"]["bed_status"]
          updated_at?: string
        }
        Update: {
          bed_number?: number
          bed_type?: Database["public"]["Enums"]["bed_type"]
          hospital_name?: string
          id?: string
          occupied_reason?: string | null
          place_id?: string
          reserved_at?: string | null
          reserved_by?: string | null
          reserved_by_user?: string | null
          status?: Database["public"]["Enums"]["bed_status"]
          updated_at?: string
        }
        Relationships: []
      }
      hospital_state: {
        Row: {
          emergency_mode: boolean
          hospital_name: string
          place_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          emergency_mode?: boolean
          hospital_name: string
          place_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          emergency_mode?: boolean
          hospital_name?: string
          place_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      release_my_bed: {
        Args: { _device_id: string }
        Returns: {
          bed_number: number
          bed_type: Database["public"]["Enums"]["bed_type"]
          hospital_name: string
          id: string
          occupied_reason: string | null
          place_id: string
          reserved_at: string | null
          reserved_by: string | null
          reserved_by_user: string | null
          status: Database["public"]["Enums"]["bed_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hospital_beds"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      release_my_bed_user: {
        Args: never
        Returns: {
          bed_number: number
          bed_type: Database["public"]["Enums"]["bed_type"]
          hospital_name: string
          id: string
          occupied_reason: string | null
          place_id: string
          reserved_at: string | null
          reserved_by: string | null
          reserved_by_user: string | null
          status: Database["public"]["Enums"]["bed_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hospital_beds"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reserve_bed: {
        Args: { _bed_id: string; _device_id: string }
        Returns: {
          bed_number: number
          bed_type: Database["public"]["Enums"]["bed_type"]
          hospital_name: string
          id: string
          occupied_reason: string | null
          place_id: string
          reserved_at: string | null
          reserved_by: string | null
          reserved_by_user: string | null
          status: Database["public"]["Enums"]["bed_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "hospital_beds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_bed_for_user: {
        Args: { _bed_id: string }
        Returns: {
          bed_number: number
          bed_type: Database["public"]["Enums"]["bed_type"]
          hospital_name: string
          id: string
          occupied_reason: string | null
          place_id: string
          reserved_at: string | null
          reserved_by: string | null
          reserved_by_user: string | null
          status: Database["public"]["Enums"]["bed_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "hospital_beds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_bed_status: {
        Args: {
          _bed_id: string
          _status: Database["public"]["Enums"]["bed_status"]
        }
        Returns: {
          bed_number: number
          bed_type: Database["public"]["Enums"]["bed_type"]
          hospital_name: string
          id: string
          occupied_reason: string | null
          place_id: string
          reserved_at: string | null
          reserved_by: string | null
          reserved_by_user: string | null
          status: Database["public"]["Enums"]["bed_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "hospital_beds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      toggle_emergency_mode: {
        Args: { _hospital_name: string; _on: boolean; _place_id: string }
        Returns: {
          emergency_mode: boolean
          hospital_name: string
          place_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "hospital_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "patient"
      bed_action:
        | "reserved"
        | "released"
        | "occupied"
        | "available"
        | "emergency_set"
        | "emergency_clear"
      bed_status: "available" | "reserved" | "occupied"
      bed_type: "ICU" | "ER" | "WARD"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "staff", "patient"],
      bed_action: [
        "reserved",
        "released",
        "occupied",
        "available",
        "emergency_set",
        "emergency_clear",
      ],
      bed_status: ["available", "reserved", "occupied"],
      bed_type: ["ICU", "ER", "WARD"],
    },
  },
} as const
