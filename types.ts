export interface Lead {
  id: string;
  nome: string;
  endereco: string;
  telefone: string;
  categoria: string;
  website: string | null;
  cidade: string;
  avaliacao: number;
  total_avaliacoes: number;
  google_place_id: string;
  score_oportunidade: number;
  data_prospeccao: string;
}

export interface Diagnostico {
  lead_id: string;
  nome: string;
  categoria: string;
  cidade: string;
  telefone: string;
  slug: string;
  problema_principal: string;
  angulo_de_venda: string;
  tom_da_abordagem: string;
  canal_recomendado: 'email' | 'sms' | 'instagram' | 'linkedin';
  proposta_de_valor: string;
  landing_page_url: string | null;
  landing_page_path: string | null;
  data_diagnostico: string;
}

export interface Mensagem {
  id: string;
  lead_id: string;
  nome_negocio: string;
  canal: 'email' | 'sms' | 'instagram' | 'linkedin';
  assunto?: string;
  corpo: string;
  landing_page_url: string;
  video_path: string | null;
  status:
    | 'aguardando_revisao'
    | 'aprovacao_pendente'
    | 'aprovado'
    | 'rejeitado'
    | 'enviado';
  revisao_score?: number;
  revisao_notas?: string;
  data_criacao: string;
  data_envio?: string;
  slug: string;
}

export interface PipelineState {
  data: string;
  ultimo_agente_concluido: number;
  leads_ids: string[];
  em_execucao: boolean;
  iniciado_em: string;
  concluido_em: string | null;
}

export interface DailyReport {
  data: string;
  leads_encontrados: number;
  leads_diagnosticados: number;
  landing_pages_geradas: number;
  mensagens_prontas: number;
  tempo_total_segundos: number;
  erros: ReportError[];
}

export interface ReportError {
  agente: string;
  lead_id?: string;
  mensagem: string;
  timestamp: string;
}

export interface Config {
  cidades_alvo: string[];
  segmentos: string[];
  leads_por_dia: number;
  horario_ciclo: string;
  intervalo_agent7_minutos: number;
  netlify_site_prefix: string;
  notificacoes_ativas: boolean;
}

export interface CalendarSlot {
  inicio: string;
  fim: string;
  link_calendly?: string;
}

export interface RespostaLead {
  mensagem_id: string;
  lead_id: string;
  nome_negocio: string;
  email_from: string;
  assunto_original: string;
  corpo_resposta: string;
  gmail_thread_id: string;
  gmail_message_id: string;
  horarios_propostos: CalendarSlot[];
  draft_reply: string;
  data_recebimento: string;
  status: 'pendente_aprovacao' | 'aprovado' | 'enviado';
}
