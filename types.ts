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
  status: 'ativo' | 'respondeu' | 'recusou' | 'inativo' | 'reativacao' | 'arquivado';
  data_primeiro_contato: string;
  data_proximo_contato: string | null;
  historico: FollowUpEntry[];
  segmento_micro: string;
  cidade: string;
  mensagem_proposta?: string;  // Proposta com link, enviada no dia seguinte à apresentação
  tipo_automacao?: string | null;
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
  segmento?: SegmentoClassificacao;
  identidade_visual?: IdentidadeVisual;
  perfil_cadencia?: PerfilCadencia;
  pitch_principal?: 'site' | 'automacao';
  tipo_automacao?: 'agendamento' | 'reativacao' | 'cardapio' | 'atendimento' | 'review' | null;
  sinal_automacao?: string | null;
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
    | 'enviado'
    | 'probe_enviado'
    | 'bot_descartado'
    | 'numero_invalido'
    | 'falha_envio';
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

export interface OnboardingInfo {
  passo: number;          // 1-5 = pergunta atual; 6 = completo
  // Site
  instagram?: string;
  logo?: string;          // 'recebida' | 'não tem' | texto livre
  site_ref?: string;
  descricao?: string;
  servicos?: string;
  // Automação
  whatsapp_bot?: string;
  duvidas_frequentes?: string;
  horario_funcionamento?: string;
  catalogo?: string;
  msg_boas_vindas?: string;
}

export interface Projeto {
  id: string;
  slug: string;
  nome_negocio: string;
  phone: string;
  opcao?: 0 | 1 | 2 | 3;
  tipo_produto?: 'site' | 'automacao';
  mensalidade?: number;                        // automação: valor mensal (297/497/697)
  status: 'aguardando_confirmacao' | 'onboarding' | 'em_producao' | 'entregue' | 'ativo';
  comprovante_em: string;
  onboarding_completo_em?: string;
  entregue_em?: string;
  ativo_desde?: string;                        // automação: data em que o bot foi ativado
  entrega_url?: string;
  onboarding_info?: Omit<OnboardingInfo, 'passo'>;
  // Site
  segunda_parcela_paga?: boolean;
  segunda_parcela_paga_em?: string;
  segunda_parcela_lembrete_enviado_em?: string;
  satisfacao_followup_enviado_em?: string;
  upsell_enviado_em?: string;
  // Automação
  ultimo_cobranca_mensal?: string;
  // Upsell pós-entrega
  upsell_automacao_enviado_em?: string;
  // Painel de ativação — token opaco pra evitar que o slug (previsível) sozinho dê acesso ao QR do cliente
  ativacao_token?: string;
}

export interface Indicacao {
  id: string;
  de_phone: string;
  de_nome_negocio: string;
  mensagem_original: string;
  data_detectada: string;
  followup_enviado_em?: string;
  status: 'detectada' | 'followup_enviado' | 'convertida';
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

export interface RascunhoWhatsApp {
  id: string;
  lead_phone: string;
  nome_negocio: string;
  slug: string;
  mensagem_recebida: string;
  rascunho_resposta: string;
  data_recebimento: string;
  status: 'pendente' | 'enviado' | 'ignorado';
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
