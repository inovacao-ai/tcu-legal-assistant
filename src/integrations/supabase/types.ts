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
      agent_outputs: {
        Row: {
          acordaos_referenced: string[] | null
          agent_name: string
          consultation_id: string | null
          created_at: string
          id: string
          input_data: Json | null
          output_data: Json | null
          processing_time_ms: number | null
          status: string
        }
        Insert: {
          acordaos_referenced?: string[] | null
          agent_name: string
          consultation_id?: string | null
          created_at?: string
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          processing_time_ms?: number | null
          status?: string
        }
        Update: {
          acordaos_referenced?: string[] | null
          agent_name?: string
          consultation_id?: string | null
          created_at?: string
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          processing_time_ms?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_outputs_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_messages: {
        Row: {
          agent_name: string | null
          citations: Json | null
          consultation_id: string
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          agent_name?: string | null
          citations?: Json | null
          consultation_id: string
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          agent_name?: string | null
          citations?: Json | null
          consultation_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_messages_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          created_at: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_pipeline_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          document_type: string | null
          error_message: string | null
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          indexed_at: string | null
          name: string
          numero_processo: string | null
          orgao: string | null
          page_count: number | null
          processo_id: string | null
          risks_found: number | null
          status: string
          total_chunks: number | null
          total_embeddings: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          error_message?: string | null
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          indexed_at?: string | null
          name: string
          numero_processo?: string | null
          orgao?: string | null
          page_count?: number | null
          processo_id?: string | null
          risks_found?: number | null
          status?: string
          total_chunks?: number | null
          total_embeddings?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string | null
          error_message?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          indexed_at?: string | null
          name?: string
          numero_processo?: string | null
          orgao?: string | null
          page_count?: number | null
          processo_id?: string | null
          risks_found?: number | null
          status?: string
          total_chunks?: number | null
          total_embeddings?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      legal_analysis: {
        Row: {
          analysis_type: string
          consultation_id: string | null
          created_at: string
          document_id: string | null
          id: string
          legal_basis: Json | null
          recommendations: Json | null
          risks: Json | null
          status: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_type: string
          consultation_id?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          legal_basis?: Json | null
          recommendations?: Json | null
          risks?: Json | null
          status?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_type?: string
          consultation_id?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          legal_basis?: Json | null
          recommendations?: Json | null
          risks?: Json | null
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_analysis_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_analysis_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_pipeline_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_analysis_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          organization: string | null
          role_description: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          organization?: string | null
          role_description?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          organization?: string | null
          role_description?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tcu_acordaos: {
        Row: {
          ano: number
          colegiado: string | null
          conteudo_completo: string | null
          created_at: string
          data_sessao: string | null
          embedding: string | null
          ementa: string | null
          id: string
          numero: string
          relator: string | null
          temas: string[] | null
          url_original: string | null
        }
        Insert: {
          ano: number
          colegiado?: string | null
          conteudo_completo?: string | null
          created_at?: string
          data_sessao?: string | null
          embedding?: string | null
          ementa?: string | null
          id?: string
          numero: string
          relator?: string | null
          temas?: string[] | null
          url_original?: string | null
        }
        Update: {
          ano?: number
          colegiado?: string | null
          conteudo_completo?: string | null
          created_at?: string
          data_sessao?: string | null
          embedding?: string | null
          ementa?: string | null
          id?: string
          numero?: string
          relator?: string | null
          temas?: string[] | null
          url_original?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      document_pipeline_status: {
        Row: {
          chunks_in_db: number | null
          created_at: string | null
          document_type: string | null
          embeddings_in_db: number | null
          error_message: string | null
          file_size: number | null
          has_embeddings: boolean | null
          id: string | null
          indexed_at: string | null
          name: string | null
          rag_ready: boolean | null
          status: string | null
          total_chunks: number | null
          total_embeddings: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_admin_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_acordaos: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          ano: number
          colegiado: string
          data_sessao: string
          ementa: string
          id: string
          numero: string
          relator: string
          similarity: number
          temas: string[]
        }[]
      }
      match_all_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          document_name: string
          id: string
          similarity: number
        }[]
      }
      match_chunks_by_processo: {
        Args: {
          match_count?: number
          match_threshold?: number
          processo_id: string
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          document_name: string
          id: string
          similarity: number
        }[]
      }
      match_document_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_document_id: string
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "viewer"
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
      app_role: ["admin", "moderator", "user", "viewer"],
    },
  },
} as const
