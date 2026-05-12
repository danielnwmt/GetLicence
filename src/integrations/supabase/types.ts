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
      licenses: {
        Row: {
          auto_renew: boolean
          created_at: string
          expires_at: string
          id: string
          license_key: string
          notes: string | null
          plan: Database["public"]["Enums"]["license_plan"]
          product_id: string
          provider: Database["public"]["Enums"]["payment_provider"] | null
          provider_subscription_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["license_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          expires_at: string
          id?: string
          license_key?: string
          notes?: string | null
          plan?: Database["public"]["Enums"]["license_plan"]
          product_id: string
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          provider_subscription_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          license_key?: string
          notes?: string | null
          plan?: Database["public"]["Enums"]["license_plan"]
          product_id?: string
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          provider_subscription_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          active_provider: Database["public"]["Enums"]["payment_provider"]
          asaas_api_key: string | null
          asaas_env: string
          created_at: string
          id: string
          notes: string | null
          sicoob_access_token: string | null
          sicoob_cert_key: string | null
          sicoob_cert_pem: string | null
          sicoob_client_id: string | null
          sicredi_cert_key: string | null
          sicredi_cert_pem: string | null
          sicredi_client_id: string | null
          sicredi_client_secret: string | null
          updated_at: string
          webhook_token: string
        }
        Insert: {
          active_provider?: Database["public"]["Enums"]["payment_provider"]
          asaas_api_key?: string | null
          asaas_env?: string
          created_at?: string
          id?: string
          notes?: string | null
          sicoob_access_token?: string | null
          sicoob_cert_key?: string | null
          sicoob_cert_pem?: string | null
          sicoob_client_id?: string | null
          sicredi_cert_key?: string | null
          sicredi_cert_pem?: string | null
          sicredi_client_id?: string | null
          sicredi_client_secret?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          active_provider?: Database["public"]["Enums"]["payment_provider"]
          asaas_api_key?: string | null
          asaas_env?: string
          created_at?: string
          id?: string
          notes?: string | null
          sicoob_access_token?: string | null
          sicoob_cert_key?: string | null
          sicoob_cert_pem?: string | null
          sicoob_client_id?: string | null
          sicredi_cert_key?: string | null
          sicredi_cert_pem?: string | null
          sicredi_client_id?: string | null
          sicredi_client_secret?: string | null
          updated_at?: string
          webhook_token?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          barcode: string | null
          boleto_url: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_url: string | null
          license_id: string
          method: string | null
          notes: string | null
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          provider: Database["public"]["Enums"]["payment_provider"] | null
          provider_charge_id: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          barcode?: string | null
          boleto_url?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          license_id: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          provider_charge_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          barcode?: string | null
          boleto_url?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          license_id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          provider_charge_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          cost_other: number
          cost_storage: number
          cost_vps: number
          created_at: string
          description: string | null
          id: string
          name: string
          price_monthly: number
          price_yearly: number
          profit_margin: number
          storage_amount: number
          storage_unit: string
          updated_at: string
          vps_specs: string | null
          vps_storage_amount: number
          vps_storage_unit: string
        }
        Insert: {
          active?: boolean
          cost_other?: number
          cost_storage?: number
          cost_vps?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_monthly?: number
          price_yearly?: number
          profit_margin?: number
          storage_amount?: number
          storage_unit?: string
          updated_at?: string
          vps_specs?: string | null
          vps_storage_amount?: number
          vps_storage_unit?: string
        }
        Update: {
          active?: boolean
          cost_other?: number
          cost_storage?: number
          cost_vps?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_monthly?: number
          price_yearly?: number
          profit_margin?: number
          storage_amount?: number
          storage_unit?: string
          updated_at?: string
          vps_specs?: string | null
          vps_storage_amount?: number
          vps_storage_unit?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          must_change_password: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
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
      refresh_license_statuses: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "client"
      license_plan: "monthly" | "yearly"
      license_status: "active" | "expired" | "cancelled" | "pending" | "blocked"
      payment_provider: "asaas" | "sicredi" | "sicoob" | "manual"
      payment_status: "pending" | "paid" | "failed" | "refunded"
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
      app_role: ["admin", "client"],
      license_plan: ["monthly", "yearly"],
      license_status: ["active", "expired", "cancelled", "pending", "blocked"],
      payment_provider: ["asaas", "sicredi", "sicoob", "manual"],
      payment_status: ["pending", "paid", "failed", "refunded"],
    },
  },
} as const
