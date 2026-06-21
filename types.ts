export interface IdentidadeVisual {
  cor_primaria: string;
  cor_secundaria: string;
  cor_texto: string;
  cor_fundo: string;
  cor_acento: string;
  tom: 'formal' | 'amigável' | 'jovem' | 'premium' | 'técnico' | 'artístico';
  tipografia: 'serifada' | 'sans-moderna' | 'display' | 'bold-impacto';
}

export interface SegmentoClassificacao {
  macro: string;
  nivel2: string;
  micro: string[];
  confianca: number;
  fontes: string[];
  status: 'aprovado' | 'bloqueado';
  motivo_bloqueio?: string;
}

export interface PerfilCadencia {
  melhor_canal: 'whatsapp' | 'email' | 'instagram';
  melhor_horario: 'manhã' | 'tarde' | 'noite';
  tom_followup: string;
}

export interface FollowUpEntry {
  dia: number;
  canal: string;
  horario: string;
  variacao: string;
  enviado_em: string;
  resultado: 'sem_resposta' | 'respondeu' | 'recusou' | 'pendente';
}

export interface CadenciaLead {
  lead_id: string;
  slug: string;
  nome_negocio: string;
  telefone: string;
  canal_primario: 'whatsapp' | 'email' | 'instagram';
  canal_secundario: 'whatsapp' | 'email' | 'instagram';
  etapa_atual: 0 | 1 | 3 | 7 | 14 | 21;
  status: 'ativo' | 'respondeu' | 'recusou' | 'inativo' | 'reativacao';
  data_primeiro_contato: string;
  data_proximo_contato: string | null;
  historico: FollowUpEntry[];
  segmento_micro: string;
  cidade: string;
}

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
  tipo_produto: 'site' | 'automacao';
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
  canal_recomendado: 'whatsapp' | 'email' | 'sms' | 'instagram' | 'linkedin';
  proposta_de_valor: string;
  landing_page_url: string | null;
  landing_page_path: string | null;
  data_diagnostico: string;
  tipo_produto: 'site' | 'automacao';
  segmento?: SegmentoClassificacao;
  identidade_visual?: IdentidadeVisual;
  perfil_cadencia?: PerfilCadencia;
}

export interface Mensagem {
  id: string;
  lead_id: string;
  nome_negocio: string;
  canal: 'whatsapp' | 'email' | 'sms' | 'instagram' | 'linkedin';
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
  tipo_produto: 'site' | 'automacao';
}

export interface Config {
  cidades_alvo: string[];
  segmentos_site: string[];
  segmentos_automacao: string[];
  leads_por_dia_site: number;
  leads_por_dia_automacao: number;
  horario_ciclo: string;
  intervalo_agent7_minutos: number;
  surge_prefix: string;
  notificacoes_ativas: boolean;
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
  surge_prefix: string;
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
