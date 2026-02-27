// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://gjxlapydpafwvyohovhj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeGxhcHlkcGFmd3Z5b2hvdmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDc3NTIsImV4cCI6MjA4NzcyMzc1Mn0.ni9szYqdrFWz3HcwYuOZaBFgcFddDoYSyZEakSQho-c';

let supabaseClient = null;

// ==========================================
// CONFIGURAÇÃO DOS OVOS (HARDCODED - NÃO MUDA)
// ==========================================
const configOvos = {
    comum: {
        id: 'comum',
        nome: 'Ovo Comum',
        emoji: '🥚',
        cor: '#8B4513',
        quantidadeTotal: 50,
        pontos: 5,
        limitePorUsuario: Infinity,
        descricao: 'Ovos espalhados por toda a companhia. Fáceis de encontrar em páginas ou quartos comuns.',
        recompensaExtra: null,
        chancePremio: 0
    },
    incomum: {
        id: 'incomum',
        nome: 'Ovo Incomum',
        emoji: '🥚',
        cor: '#22c55e',
        quantidadeTotal: 25,
        pontos: 10,
        limitePorUsuario: 10,
        descricao: 'Ovos escondidos em locais que requerem mais atenção. Valor médio de recompensa.',
        recompensaExtra: null,
        chancePremio: 0
    },
    raro: {
        id: 'raro',
        nome: 'Ovo Raro',
        emoji: '🥚',
        cor: '#3b82f6',
        quantidadeTotal: 15,
        pontos: 30,
        limitePorUsuario: 5,
        descricao: 'Ovos bem escondidos. Requer dedicação para encontrar. Boas recompensas!',
        recompensaExtra: null,
        chancePremio: 0.1
    },
    epico: {
        id: 'epico',
        nome: 'Ovo Épico',
        emoji: '🥚',
        cor: '#a855f7',
        quantidadeTotal: 7,
        pontos: 50,
        limitePorUsuario: 1,
        descricao: 'Ovos extremamente raros! Grande chance de ganhar prêmios épicos.',
        recompensaExtra: 'Chance de prêmio épico',
        chancePremio: 0.4
    },
    lendario: {
        id: 'lendario',
        nome: 'Ovo Lendário',
        emoji: '🥚',
        cor: '#f59e0b',
        quantidadeTotal: 3,
        pontos: 100,
        limitePorUsuario: 1,
        descricao: 'Ovos quase impossíveis de encontrar! Alta chance de prêmios lendários.',
        recompensaExtra: 'Chance de prêmio lendário',
        chancePremio: 0.6
    },
    coelhao: {
        id: 'coelhao',
        nome: 'Coelhão',
        emoji: '🐰',
        cor: 'gradient',
        quantidadeTotal: 1,
        pontos: 500,
        limitePorUsuario: 1,
        descricao: 'O GRANDE PRÊMIO! Existe apenas UM na companhia inteira. Prêmio único garantido!',
        recompensaExtra: 'Prêmio Lendário Único Garantido',
        chancePremio: 1,
        premioGarantido: true
    }
};

// Códigos hardcoded (em produção, considere carregar do Supabase)
const codigosSistema = {
    'SRC-COMUM-001': { tipo: 'comum', usado: false },
    'SRC-COMUM-002': { tipo: 'comum', usado: false },
    'SRC-COMUM-003': { tipo: 'comum', usado: false },
    'SRC-COMUM-004': { tipo: 'comum', usado: false },
    'SRC-COMUM-005': { tipo: 'comum', usado: false },
    'SRC-INCOMUM-001': { tipo: 'incomum', usado: false },
    'SRC-INCOMUM-002': { tipo: 'incomum', usado: false },
    'SRC-INCOMUM-003': { tipo: 'incomum', usado: false },
    'SRC-RARO-001': { tipo: 'raro', usado: false },
    'SRC-RARO-002': { tipo: 'raro', usado: false },
    'SRC-EPICO-001': { tipo: 'epico', usado: false },
    'SRC-LENDARIO-001': { tipo: 'lendario', usado: false },
    'SRC-COELHAO-001': { tipo: 'coelhao', usado: false }
};

// ==========================================
// VARIÁVEIS GLOBAIS
// ==========================================
const CARGOS_IGNORADOS = ['fiscalizador', 'diretor', 'vice-presidente', 'presidente'];

let membros = [];
let usuarioAtual = null;
let todosResgates = [];
let resgatePendente = null;
let tipoRankingAtual = 'pontos';
let catalogoPremios = {
    comum: [],
    incomum: [],
    raro: [],
    epico: [],
    lendario: []
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
}

// ==========================================
// AUTENTICAÇÃO E USUÁRIO
// ==========================================
async function pegarUsernameForum() {
    try {
        const resposta = await fetch("/forum");
        const html = await resposta.text();
        
        // Tentar extrair username do fórum
        const regexes = [
            /_userdata\["username"\]\s*=\s*"([^"]+)"/,
            /"username"\s*:\s*"([^"]+)"/,
            /class="username[^"]*">([^<]+)</
        ];
        
        let username = null;
        for (const regex of regexes) {
            const match = html.match(regex);
            if (match && match[1]) {
                username = match[1].trim();
                break;
            }
        }
        
        if (!username) {
            // Fallback: tentar pegar de meta tags ou outro elemento
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const userElement = doc.querySelector('.username, [data-username], #username');
            if (userElement) {
                username = userElement.textContent || userElement.dataset.username;
            }
        }

        if (username) {
            localStorage.setItem("forumUser", username);
            return username;
        }
        throw new Error('Não autenticado no fórum');
    } catch (err) {
        console.error("Erro ao buscar username:", err);
        const fallback = localStorage.getItem("forumUser");
        if (fallback) return fallback;
        throw err;
    }
}

async function buscarHabboName(forumName) {
    // Aqui você pode implementar uma lógica para mapear forumName -> habboName
    // Por enquanto, assume que são iguais ou busca no Supabase
    if (!supabaseClient) return forumName;
    
    const { data } = await supabaseClient
        .from('usuarios')
        .select('habbo_name')
        .eq('forum_name', forumName)
        .single();
    
    return data?.habbo_name || forumName;
}

async function verificarPermissaoNoSupabase(habboName) {
    if (!supabaseClient) return 'usuario';
    
    const { data } = await supabaseClient
        .from('usuarios')
        .select('grupo_permissao')
        .eq('habbo_name', habboName)
        .single();
    
    return data?.grupo_permissao || 'usuario';
}

async function inicializarUsuario() {
    try {
        const forumName = await pegarUsernameForum();
        const habboName = await buscarHabboName(forumName);
        
        // Buscar membros da planilha
        const response = await fetch('https://script.google.com/macros/s/AKfycbzhJdbeZfxkHgh3cQrK_YlhBCuhZyLhM_9jYkAnCPmbz-aYpv7845740KySuhjTzdIb/exec');
        const data = await response.json();
        
        membros = data.filter(m => !CARGOS_IGNORADOS.includes(m.cargo.toLowerCase()));
        
        const membro = membros.find(m => m.nick === forumName || m.nick === habboName);
        
        if (!membro) {
            mostrarErroLogin('Você não é membro autorizado desta companhia.');
            return false;
        }
        
        const permissao = await verificarPermissaoNoSupabase(habboName);
        
        usuarioAtual = {
            id: null,
            forumName: forumName,
            habboName: habboName,
            nome: habboName, // Exibe o Habbo name
            cargo: membro.cargo,
            cargoOriginal: membro.cargoOriginal || membro.cargo,
            pontos: 0,
            ovosResgatados: { comum: 0, incomum: 0, raro: 0, epico: 0, lendario: 0, coelhao: 0 },
            premiosGanhos: [],
            historico: [],
            grupoPermissao: permissao
        };
        
        await carregarOuCriarUsuario();
        return true;
        
    } catch (err) {
        console.error(err);
        mostrarErroLogin('Você precisa estar logado no fórum para acessar.');
        return false;
    }
}

async function carregarOuCriarUsuario() {
    if (!supabaseClient) return;
    
    // Tentar buscar usuário existente
    let { data, error } = await supabaseClient
        .from('usuarios')
        .select('*')
        .eq('habbo_name', usuarioAtual.habboName)
        .single();
    
    if (!data) {
        // Criar novo usuário
        const { data: newUser, error: createError } = await supabaseClient
            .from('usuarios')
            .insert([{
                habbo_name: usuarioAtual.habboName,
                forum_name: usuarioAtual.forumName,
                pontos: 0,
                grupo_permissao: usuarioAtual.grupoPermissao,
                ovos_resgatados: { comum: 0, incomum: 0, raro: 0, epico: 0, lendario: 0, coelhao: 0 }
            }])
            .select()
            .single();
        
        data = newUser;
    }
    
    if (data) {
        usuarioAtual.id = data.id;
        usuarioAtual.pontos = data.pontos || 0;
        usuarioAtual.grupoPermissao = data.grupo_permissao || 'usuario';
        usuarioAtual.ovosResgatados = data.ovos_resgatados || {
            comum: 0, incomum: 0, raro: 0, epico: 0, lendario: 0, coelhao: 0
        };
    }
}

function mostrarErroLogin(mensagem) {
    document.body.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            font-family: 'Inter', sans-serif;
            text-align: center;
            padding: 20px;
        ">
            <div style="font-size: 64px; margin-bottom: 20px;">🚫</div>
            <h1 style="font-size: 24px; margin-bottom: 16px; font-weight: 700;">Acesso Negado</h1>
            <p style="font-size: 16px; opacity: 0.9; max-width: 400px; line-height: 1.6;">${mensagem}</p>
            <button onclick="window.location.reload()" style="
                margin-top: 24px;
                padding: 12px 24px;
                background: white;
                color: #1e40af;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                font-size: 14px;
            ">Tentar Novamente</button>
        </div>
    `;
}

// ==========================================
// CARREGAMENTO DE DADOS
// ==========================================
async function carregarPremios() {
    if (!supabaseClient) {
        // Fallback para testes sem Supabase
        catalogoPremios = {
            comum: [
                { id: 'c1', nome: 'Badge Bronze', descricao: 'Badge especial de bronze', icone: '🥉', estoque: 10 },
                { id: 'c2', nome: 'Chocolates', descricao: 'Cesta de chocolates', icone: '🍫', estoque: 20 }
            ],
            incomum: [
                { id: 'i1', nome: 'Badge Prata', descricao: 'Badge especial de prata', icone: '🥈', estoque: 8 }
            ],
            raro: [
                { id: 'r1', nome: 'Badge Ouro', descricao: 'Badge especial de ouro', icone: '🥇', estoque: 5 }
            ],
            epico: [
                { id: 'e1', nome: 'Badge Diamante', descricao: 'Badge diamante exclusivo', icone: '💎', estoque: 3 }
            ],
            lendario: [
                { id: 'l1', nome: 'Badge Supremo', descricao: 'Badge supremo da páscoa', icone: '🏆', estoque: 1 }
            ]
        };
        return;
    }
    
    const { data, error } = await supabaseClient
        .from('premios')
        .select('*')
        .eq('ativo', true)
        .order('nome');
    
    if (data) {
        catalogoPremios = { comum: [], incomum: [], raro: [], epico: [], lendario: [] };
        data.forEach(p => {
            if (catalogoPremios[p.categoria]) {
                catalogoPremios[p.categoria].push({
                    id: p.id,
                    nome: p.nome,
                    descricao: p.descricao,
                    icone: p.icone,
                    estoque: p.estoque
                });
            }
        });
    }
}

async function carregarResgates() {
    if (!supabaseClient || !usuarioAtual) return;
    
    // Carregar histórico do usuário
    const { data } = await supabaseClient
        .from('resgates')
        .select('*, premio:premio_id(*)')
        .eq('habbo_name', usuarioAtual.habboName)
        .order('created_at', { ascending: false });
    
    if (data) {
        usuarioAtual.historico = data.map(r => ({
            id: r.id,
            tipo: r.tipo_ovo,
            nomeOvo: configOvos[r.tipo_ovo]?.nome || r.tipo_ovo,
            emoji: configOvos[r.tipo_ovo]?.emoji || '🥚',
            codigo: r.codigo,
            pontos: r.pontos,
            premio: r.premio,
            premio_id: r.premio_id,
            data: r.created_at,
            descricao: r.descricao,
            status: r.status,
            comprovante: r.comprovante_url ? { dataUrl: r.comprovante_url } : null
        }));
    }
    
    // Se for admin, carregar todos
    if (isAdmin()) {
        const { data: todosData } = await supabaseClient
            .from('resgates')
            .select('*, premio:premio_id(*)')
            .order('created_at', { ascending: false });
        
        if (todosData) {
            todosResgates = todosData.map(r => ({
                id: r.id,
                usuario_id: r.usuario_id,
                habboName: r.habbo_name,
                forumName: r.forum_name,
                usuario: r.forum_name || r.habbo_name,
                tipo: r.tipo_ovo,
                nomeOvo: configOvos[r.tipo_ovo]?.nome || r.tipo_ovo,
                emoji: configOvos[r.tipo_ovo]?.emoji || '🥚',
                codigo: r.codigo,
                pontos: r.pontos,
                premio: r.premio,
                premio_id: r.premio_id,
                data: r.created_at,
                descricao: r.descricao,
                status: r.status,
                comprovante: r.comprovante_url ? { dataUrl: r.comprovante_url } : null
            }));
        }
    }
}

function findPremioById(id) {
    for (const cat in catalogoPremios) {
        const premio = catalogoPremios[cat].find(p => p.id === id);
        if (premio) return premio;
    }
    return null;
}

// ==========================================
// UTILITÁRIOS HABBO
// ==========================================
function getHabboFullBodyUrl(username, size = 'l', direction = 3, headDirection = 3, gesture = 'std') {
    return `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&size=${size}&direction=${direction}&head_direction=${headDirection}&gesture=${gesture}`;
}

function getHabboHeadUrl(username, size = 'l', direction = 3, headDirection = 3, gesture = 'std') {
    return `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&size=${size}&direction=${direction}&head_direction=${headDirection}&gesture=${gesture}&headonly=1`;
}

function getAvatarFullBodyHtml(username, tamanho = '120px') {
    if (!username || username === 'undefined') {
        return '<div style="font-size: 40px;">🐰</div>';
    }
    return `<img src="${getHabboFullBodyUrl(username)}" 
                onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'font-size: 40px;\\'>🐰</div>';" 
                style="width: auto; height: ${tamanho}; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));" 
                alt="${username}">`;
}

function getAvatarHeadHtml(username, tamanho = '48px') {
    if (!username || username === 'undefined') {
        return '<div style="font-size: 24px;">🐰</div>';
    }
    return `<img src="${getHabboHeadUrl(username)}" 
                onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'font-size: 24px;\\'>🐰</div>';" 
                style="width: ${tamanho}; height: ${tamanho}; border-radius: 50%; object-fit: cover; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" 
                alt="${username}">`;
}

// ==========================================
// UI - NAVEGAÇÃO
// ==========================================
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebarNav');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('mobileMenuBtn');
    const body = document.body;

    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    btn.classList.toggle('active');

    body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
}

function closeMobileMenu() {
    const sidebar = document.getElementById('sidebarNav');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('mobileMenuBtn');
    const body = document.body;

    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    btn.classList.remove('active');
    body.style.overflow = '';
}

function showSection(section) {
    document.querySelectorAll('.section-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetSection = document.getElementById(`section-${section}`);
    const targetNav = document.querySelector(`[data-section="${section}"]`);
    
    if (targetSection) targetSection.classList.remove('hidden');
    if (targetNav) targetNav.classList.add('active');

    if (section === 'meus') renderizarMeusResgates();
    if (section === 'ranking') renderizarRanking();
    if (section === 'admin') renderizarAdmin();
    if (section === 'premios') renderizarPremios();
}

// ==========================================
// UI - RENDERIZAÇÃO
// ==========================================
function renderizarGuiaOvos() {
    const container = document.getElementById('guiaOvosLista');
    if (!container) return;
    
    const ovos = Object.values(configOvos);

    container.innerHTML = ovos.map(ovo => `
        <div class="guia-item ${ovo.id}">
            <div class="guia-header">
                <div class="guia-emoji">${ovo.emoji}</div>
                <div class="guia-titulo">
                    <div class="guia-nome" style="color: ${ovo.cor === 'gradient' ? '#f59e0b' : ovo.cor};">${ovo.nome}</div>
                    <div class="guia-quantidade">${ovo.quantidadeTotal} disponíveis</div>
                </div>
            </div>
            
            <div class="guia-recompensa">
                <span class="guia-pontos"><i class="fa-solid fa-coins"></i> ${ovo.pontos} pontos</span>
                ${ovo.recompensaExtra ? `<span class="guia-bonus"><i class="fa-solid fa-gift"></i> ${ovo.recompensaExtra}</span>` : ''}
            </div>
            
            <p class="guia-desc">${ovo.descricao}</p>
            
            <div class="guia-limites">
                <i class="fa-solid fa-user-check"></i>
                ${ovo.limitePorUsuario === Infinity
                    ? 'Sem limite de resgates'
                    : `Limite: ${ovo.limitePorUsuario} resgate${ovo.limitePorUsuario > 1 ? 's' : ''} por usuário`}
            </div>
        </div>
    `).join('');
}

function renderizarPremios() {
    const renderCategoria = (categoria, containerId, corClasse) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const premios = catalogoPremios[categoria] || [];
        
        if (premios.length === 0) {
            container.innerHTML = '<p style="color: var(--text-tertiary); text-align: center; padding: 20px;">Nenhum prêmio disponível nesta categoria.</p>';
            return;
        }
        
        container.innerHTML = premios.map(p => `
            <div class="premio-card ${corClasse}">
                <span class="premio-raridade">${categoria.charAt(0).toUpperCase() + categoria.slice(1)}</span>
                <div class="premio-icon">${p.icone}</div>
                <h4 class="premio-nome">${p.nome}</h4>
                <p class="premio-desc">${p.descricao}</p>
                <span class="premio-origem ovo"><i class="fa-solid fa-egg"></i> Ovo ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}</span>
                ${isAdmin() ? `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-light);">
                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px;">
                            <span>Estoque: <strong>${p.estoque}</strong></span>
                            <div style="display: flex; gap: 4px;">
                                <button class="btn-icon" onclick="atualizarEstoque('${p.id}', 1)" title="Adicionar"><i class="fa-solid fa-plus"></i></button>
                                <button class="btn-icon" onclick="atualizarEstoque('${p.id}', -1)" title="Remover"><i class="fa-solid fa-minus"></i></button>
                            </div>
                        </div>
                    </div>
                ` : `<div style="margin-top: 8px; font-size: 12px; color: var(--text-tertiary);">Estoque: ${p.estoque}</div>`}
            </div>
        `).join('');
    };

    renderCategoria('comum', 'premiosComum', 'comum');
    renderCategoria('incomum', 'premiosIncomum', 'incomum');
    renderCategoria('raro', 'premiosRaro', 'raro');
    renderCategoria('epico', 'premiosEpico', 'epico');
    renderCategoria('lendario', 'premiosLendario', 'lendario');
    
    const totalPremios = Object.values(catalogoPremios).flat().length;
    const totalBadge = document.getElementById('totalPremios');
    if (totalBadge) totalBadge.textContent = `${totalPremios} prêmios`;
}

function isAdmin() {
    return usuarioAtual && ['admin', 'moderador'].includes(usuarioAtual.grupoPermissao);
}

// ==========================================
// LÓGICA DE RESGATE
// ==========================================
function iniciarResgateCodigo() {
    const input = document.getElementById('codigoInput');
    const codigo = input.value.trim().toUpperCase();

    if (!codigo) {
        showToast('Erro', 'Digite um código válido!', 'error');
        return;
    }

    const codigoData = codigosSistema[codigo];

    if (!codigoData) {
        showToast('Código Inválido', 'Este código não existe ou está incorreto.', 'error');
        input.value = '';
        return;
    }

    if (codigoData.usado) {
        showToast('Código Usado', 'Este código já foi resgatado por alguém!', 'error');
        input.value = '';
        return;
    }

    const config = configOvos[codigoData.tipo];
    
    // Verificar limite por usuário
    if (config.limitePorUsuario !== Infinity) {
        const jaResgatados = usuarioAtual.ovosResgatados[codigoData.tipo] || 0;
        if (jaResgatados >= config.limitePorUsuario) {
            showToast('Limite Atingido', `Você já resgatou o limite de ${config.nome}(s)!`, 'error');
            return;
        }
    }

    resgatePendente = {
        codigo: codigo,
        codigoData: codigoData,
        config: config
    };

    abrirComprovacaoModal();
}

function abrirComprovacaoModal() {
    if (!resgatePendente) return;
    
    const config = resgatePendente.config;
    const codigoData = resgatePendente.codigoData;

    const infoDiv = document.getElementById('comprovacaoInfo');
    if (infoDiv) {
        infoDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                <div style="font-size: 48px;">${config.emoji}</div>
                <div>
                    <h4 style="color: ${config.cor === 'gradient' ? '#f59e0b' : config.cor}; margin-bottom: 4px;">${config.nome}</h4>
                    <p style="font-size: 14px; color: var(--text-tertiary);">Código: <code>${resgatePendente.codigo}</code></p>
                </div>
            </div>
            <div style="background: var(--bg-white); padding: 12px; border-radius: 8px; text-align: center;">
                <p style="font-size: 18px; font-weight: 700; color: var(--gold-dark);">
                    <i class="fa-solid fa-coins"></i> ${config.pontos} pontos
                </p>
                ${config.chancePremio > 0 ? `
                    <p style="color: var(--warning); font-size: 14px; margin-top: 4px;">
                        <i class="fa-solid fa-dice"></i> Chance de prêmio: ${Math.round(config.chancePremio * 100)}%
                    </p>
                ` : ''}
                ${config.premioGarantido ? `
                    <p style="color: var(--success); font-size: 14px; margin-top: 4px;">
                        <i class="fa-solid fa-gift"></i> Prêmio Lendário Garantido!
                    </p>
                ` : ''}
            </div>
        `;
    }

    const modal = document.getElementById('comprovacaoModal');
    if (modal) modal.classList.add('active');
}

function fecharComprovacaoModal() {
    const modal = document.getElementById('comprovacaoModal');
    if (modal) modal.classList.remove('active');
    
    const form = document.getElementById('formComprovacao');
    if (form) form.reset();
    
    const preview = document.getElementById('filePreview');
    if (preview) preview.style.display = 'none';
    
    resgatePendente = null;
}

function previewComprovacao(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const previewImg = document.getElementById('previewImage');
            const previewDiv = document.getElementById('filePreview');
            if (previewImg) previewImg.src = e.target.result;
            if (previewDiv) previewDiv.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function confirmarComprovacao(e) {
    e.preventDefault();
    if (!resgatePendente || !usuarioAtual) return;

    const descricao = document.getElementById('comprovacaoDesc')?.value || '';
    const fileInput = document.getElementById('comprovacaoFile');
    const file = fileInput?.files[0];

    const { codigo, codigoData, config } = resgatePendente;

    // Determinar prêmio
    let premioGanho = null;
    let premioId = null;
    
    if (config.premioGarantido) {
        // Coelhão sempre dá prêmio lendário
        const premiosLendarios = catalogoPremios.lendario.filter(p => p.estoque > 0);
        if (premiosLendarios.length > 0) {
            premioGanho = premiosLendarios[0]; // Pega o primeiro disponível
            premioId = premioGanho.id;
        }
    } else if (config.chancePremio > 0 && Math.random() < config.chancePremio) {
        // Chance aleatória baseada na raridade
        const categoria = config.id === 'lendario' ? 'lendario' :
                         config.id === 'epico' ? 'epico' :
                         config.id === 'raro' ? 'raro' : 'comum';
        const premiosDisponiveis = catalogoPremios[categoria].filter(p => p.estoque > 0);
        if (premiosDisponiveis.length > 0) {
            premioGanho = premiosDisponiveis[Math.floor(Math.random() * premiosDisponiveis.length)];
            premioId = premioGanho.id;
        }
    }

    let comprovanteUrl = null;
    
    // Upload do arquivo se houver
    if (file && supabaseClient) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${usuarioAtual.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('comprovantes')
            .upload(fileName, file);
        
        if (uploadData) {
            const { data: { publicUrl } } = supabaseClient
                .storage
                .from('comprovantes')
                .getPublicUrl(fileName);
            comprovanteUrl = publicUrl;
        }
    } else if (file) {
        // Fallback: usar data URL
        comprovanteUrl = document.getElementById('previewImage')?.src;
    }

    // Salvar no Supabase
    if (supabaseClient) {
        const { data, error } = await supabaseClient
            .from('resgates')
            .insert([{
                usuario_id: usuarioAtual.id,
                habbo_name: usuarioAtual.habboName,
                forum_name: usuarioAtual.forumName,
                tipo_ovo: config.id,
                codigo: codigo,
                pontos: config.pontos,
                premio_id: premioId,
                descricao: descricao,
                comprovante_url: comprovanteUrl,
                status: 'pendente'
            }])
            .select()
            .single();
        
        if (error) {
            showToast('Erro', 'Falha ao salvar resgate: ' + error.message, 'error');
            return;
        }

        // Marcar código como usado localmente
        codigosSistema[codigo].usado = true;
        
        // Adicionar ao histórico local
        const registro = {
            id: data.id,
            tipo: config.id,
            nomeOvo: config.nome,
            emoji: config.emoji,
            codigo: codigo,
            pontos: config.pontos,
            premio: premioGanho,
            premio_id: premioId,
            data: data.created_at,
            descricao: descricao,
            status: 'pendente',
            comprovante: comprovanteUrl ? { dataUrl: comprovanteUrl } : null
        };
        
        usuarioAtual.historico.unshift(registro);
        todosResgates.unshift({
            ...registro,
            usuario_id: usuarioAtual.id,
            habboName: usuarioAtual.habboName,
            forumName: usuarioAtual.forumName,
            usuario: usuarioAtual.forumName
        });
    } else {
        // Modo offline (testes)
        codigosSistema[codigo].usado = true;
    }

    fecharComprovacaoModal();
    
    const input = document.getElementById('codigoInput');
    if (input) input.value = '';

    showToast('Resgate Enviado!', 'Seu resgate foi enviado para aprovação.', 'success');
    renderizarMeusResgates();
    if (isAdmin()) renderizarAdmin();
}

function fecharResultadoModal() {
    const modal = document.getElementById('resultadoModal');
    if (modal) modal.classList.remove('active');
}

// ==========================================
// UI - MEUS RESGATES
// ==========================================
function renderizarMeusResgates() {
    if (!usuarioAtual) return;
    
    // Últimos resgates (máximo 5)
    const ultimosContainer = document.getElementById('meusUltimosResgates');
    const ultimos = usuarioAtual.historico.slice(0, 5);

    if (ultimosContainer) {
        if (ultimos.length === 0) {
            ultimosContainer.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 64px; margin-bottom: 16px;">🧺</div>
                    <h3>Sua cesta está vazia</h3>
                    <p>Encontre e resgate ovos para preenchê-la!</p>
                </div>
            `;
        } else {
            ultimosContainer.innerHTML = ultimos.map(h => `
                <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-white); border-radius: 12px; margin-bottom: 12px; border: 1px solid var(--border-light); border-left: 4px solid ${h.status === 'aprovado' ? 'var(--success)' : h.status === 'pendente' ? 'var(--warning)' : 'var(--danger)'};">
                    <div style="font-size: 40px;">${h.emoji}</div>
                    <div style="flex: 1;">
                        <h4 style="margin-bottom: 4px;">${h.nomeOvo}</h4>
                        <p style="font-size: 13px; color: var(--text-tertiary);">${new Date(h.data).toLocaleDateString('pt-BR')} • +${h.pontos} pts</p>
                        <span class="status-badge status-${h.status}" style="margin-top: 4px; display: inline-flex;">
                            <i class="fa-solid fa-${h.status === 'aprovado' ? 'check' : h.status === 'pendente' ? 'clock' : 'xmark'}"></i> 
                            ${h.status === 'aprovado' ? 'Aprovado' : h.status === 'pendente' ? 'Pendente' : 'Rejeitado'}
                        </span>
                    </div>
                    ${h.premio ? `<div style="font-size: 24px;" title="${h.premio.nome}">${h.premio.icone}</div>` : ''}
                </div>
            `).join('');
        }
    }

    // Histórico completo
    const historicoContainer = document.getElementById('meuHistoricoCompleto');
    if (historicoContainer) {
        historicoContainer.innerHTML = usuarioAtual.historico.length === 0 ?
            `<div class="empty-state"><i class="fa-solid fa-basket-shopping" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i><h3>Nenhum resgate ainda</h3><p>Comece a caçar ovos!</p></div>` :
            usuarioAtual.historico.map(h => `
                <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-white); border-radius: 12px; margin-bottom: 12px; border-left: 4px solid ${h.status === 'aprovado' ? (configOvos[h.tipo]?.cor === 'gradient' ? '#f59e0b' : configOvos[h.tipo]?.cor || '#ccc') : h.status === 'pendente' ? 'var(--warning)' : 'var(--danger)'};">
                    <div style="font-size: 40px;">${h.emoji}</div>
                    <div style="flex: 1;">
                        <h4 style="margin-bottom: 4px;">${h.nomeOvo}</h4>
                        <p style="font-size: 13px; color: var(--text-tertiary); margin-bottom: 4px;">${new Date(h.data).toLocaleDateString('pt-BR')} às ${new Date(h.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p style="font-size: 12px; color: var(--text-tertiary);"><i class="fa-solid fa-hashtag"></i> ${h.codigo}</p>
                        <span class="status-badge status-${h.status}" style="margin-top: 8px; display: inline-flex;">
                            <i class="fa-solid fa-${h.status === 'aprovado' ? 'check' : h.status === 'pendente' ? 'clock' : 'xmark'}"></i> 
                            ${h.status === 'aprovado' ? 'Aprovado' : h.status === 'pendente' ? 'Aguardando Aprovação' : 'Rejeitado'}
                        </span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 20px; font-weight: 800; color: ${h.status === 'aprovado' ? 'var(--gold-dark)' : 'var(--text-tertiary)'};">+${h.pontos}</div>
                        ${h.premio ? `<div style="font-size: 24px; margin-top: 4px;" title="${h.premio.nome}">${h.premio.icone}</div>` : ''}
                    </div>
                </div>
            `).join('');
    }

    // Atualizar estatísticas
    const ovosAprovados = usuarioAtual.historico.filter(h => h.status === 'aprovado');
    const pontosAprovados = ovosAprovados.reduce((sum, h) => sum + h.pontos, 0);
    const premiosAprovados = ovosAprovados.filter(h => h.premio).length;

    const elPontos = document.getElementById('meusPontosTotal');
    const elOvos = document.getElementById('meusOvosTotal');
    const elPremios = document.getElementById('meusPremiosTotal');
    
    if (elPontos) elPontos.textContent = pontosAprovados;
    if (elOvos) elOvos.textContent = ovosAprovados.length;
    if (elPremios) elPremios.textContent = premiosAprovados;
}

function atualizarStats() {
    if (!usuarioAtual) return;
    
    const ovosAprovados = usuarioAtual.historico.filter(h => h.status === 'aprovado');
    const pontosAprovados = ovosAprovados.reduce((sum, h) => sum + h.pontos, 0);
    const premiosAprovados = ovosAprovados.filter(h => h.premio).length;

    const elPoints = document.getElementById('userPoints');
    const elOvos = document.getElementById('userTotalOvos');
    const elPremios = document.getElementById('userTotalPremios');
    
    if (elPoints) elPoints.textContent = pontosAprovados;
    if (elOvos) elOvos.textContent = ovosAprovados.length;
    if (elPremios) elPremios.textContent = premiosAprovados;
}

// ==========================================
// UI - RANKING
// ==========================================
function renderizarRanking() {
    // Preparar dados dos jogadores
    const jogadores = membros.map(m => {
        const souEu = usuarioAtual && (m.nick === usuarioAtual.habboName || m.nick === usuarioAtual.forumName);
        const meusDados = souEu ? usuarioAtual : null;
        
        // Calcular estatísticas reais ou simuladas
        const ovosCount = meusDados ? 
            Object.values(meusDados.ovosResgatados).reduce((a, b) => a + b, 0) : 
            Math.floor(Math.random() * 15);
        const pontosCount = meusDados ? meusDados.pontos : Math.floor(Math.random() * 500);
        
        return {
            nome: m.nick,
            habboName: m.nick, // Assumindo que o nick da planilha é o Habbo name
            pontos: pontosCount,
            ovos: ovosCount,
            souEu: souEu
        };
    });

    const ordenarPor = tipoRankingAtual === 'pontos' ? 'pontos' : 'ovos';
    jogadores.sort((a, b) => b[ordenarPor] - a[ordenarPor]);

    // Pódium (top 3)
    const podium = jogadores.slice(0, 3);
    const podiumContainer = document.getElementById('podiumTop3');
    
    if (podiumContainer && podium.length >= 3) {
        const iconesPodium = { 1: 'fa-crown', 2: 'fa-medal', 3: 'fa-award' };
        
        podiumContainer.innerHTML = `
            <div class="podium-item pos-2">
                <div class="podium-avatar-wrapper">
                    <div class="podium-badge"><i class="fa-solid ${iconesPodium[2]}"></i></div>
                    <div class="podium-avatar-container">
                        ${getAvatarFullBodyHtml(podium[1]?.habboName, '140px')}
                    </div>
                </div>
                <div class="podium-base">
                    <div class="podium-info">
                        <div class="podium-nome">${podium[1]?.nome || '-'}</div>
                        <div class="podium-stats">
                            <div class="podium-pontos"><i class="fa-solid fa-coins"></i> ${podium[1]?.[ordenarPor] || 0}</div>
                            <div class="podium-label">${ordenarPor === 'pontos' ? 'pontos' : 'ovos'}</div>
                        </div>
                    </div>
                    <div class="podium-rank-number">2</div>
                </div>
            </div>
            <div class="podium-item pos-1">
                <div class="podium-avatar-wrapper">
                    <div class="podium-badge"><i class="fa-solid ${iconesPodium[1]}"></i></div>
                    <div class="podium-avatar-container">
                        ${getAvatarFullBodyHtml(podium[0]?.habboName, '170px')}
                    </div>
                </div>
                <div class="podium-base">
                    <div class="podium-info">
                        <div class="podium-nome">${podium[0]?.nome || '-'}</div>
                        <div class="podium-stats">
                            <div class="podium-pontos"><i class="fa-solid fa-coins"></i> ${podium[0]?.[ordenarPor] || 0}</div>
                            <div class="podium-label">${ordenarPor === 'pontos' ? 'pontos' : 'ovos'}</div>
                        </div>
                    </div>
                    <div class="podium-rank-number">1</div>
                </div>
            </div>
            <div class="podium-item pos-3">
                <div class="podium-avatar-wrapper">
                    <div class="podium-badge"><i class="fa-solid ${iconesPodium[3]}"></i></div>
                    <div class="podium-avatar-container">
                        ${getAvatarFullBodyHtml(podium[2]?.habboName, '140px')}
                    </div>
                </div>
                <div class="podium-base">
                    <div class="podium-info">
                        <div class="podium-nome">${podium[2]?.nome || '-'}</div>
                        <div class="podium-stats">
                            <div class="podium-pontos"><i class="fa-solid fa-coins"></i> ${podium[2]?.[ordenarPor] || 0}</div>
                            <div class="podium-label">${ordenarPor === 'pontos' ? 'pontos' : 'ovos'}</div>
                        </div>
                    </div>
                    <div class="podium-rank-number">3</div>
                </div>
            </div>
        `;
    }

    // Lista completa
    const rankingContainer = document.getElementById('rankingCompleto');
    if (rankingContainer) {
        rankingContainer.innerHTML = jogadores.map((j, index) => `
            <div class="ranking-item-novo ${j.souEu ? 'destaque' : ''}" data-pos="${index + 1}">
                <div class="ranking-pos ${index < 3 ? 'top' : 'normal'}">${index + 1}</div>
                <div class="ranking-avatar-novo" style="overflow: hidden; padding: 0; border-radius: 50%;">
                    ${getAvatarHeadHtml(j.habboName, '48px')}
                </div>
                <div class="ranking-info-novo">
                    <div class="ranking-nome-novo">
                        ${j.nome}
                        ${j.souEu ? '<span class="ranking-badge">VOCÊ</span>' : ''}
                    </div>
                    <div class="ranking-stats">
                        <span class="ranking-stat pontos"><i class="fa-solid fa-coins"></i> ${j.pontos} pts</span>
                        <span class="ranking-stat ovos"><i class="fa-solid fa-egg"></i> ${j.ovos} ovos</span>
                    </div>
                </div>
                <div class="ranking-valor">
                    <div class="ranking-numero">${j[ordenarPor]}</div>
                    <div class="ranking-label">${ordenarPor === 'pontos' ? 'pontos' : 'ovos'}</div>
                </div>
            </div>
        `).join('');
    }
}

function alternarRanking(tipo) {
    tipoRankingAtual = tipo;
    
    const btnPontos = document.getElementById('btnRankPontos');
    const btnOvos = document.getElementById('btnRankOvos');
    
    if (btnPontos) btnPontos.classList.toggle('btn-rank-ativo', tipo === 'pontos');
    if (btnOvos) btnOvos.classList.toggle('btn-rank-ativo', tipo === 'ovos');
    
    renderizarRanking();
}

// ==========================================
// UI - ADMIN
// ==========================================
function renderizarAdmin(filtro = 'pendente') {
    const tableBody = document.getElementById('adminTable');
    if (!tableBody) return;
    
    if (!isAdmin()) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--danger);">
                    <i class="fa-solid fa-lock" style="font-size: 48px; margin-bottom: 16px; display: block;"></i>
                    Acesso restrito a administradores
                </td>
            </tr>
        `;
        return;
    }

    const pendentes = todosResgates.filter(r => r.status === 'pendente');
    const pendingBadge = document.getElementById('pendingCount');
    if (pendingBadge) pendingBadge.textContent = `${pendentes.length} pendentes`;

    let resgatesFiltrados = filtro === 'todos' ? todosResgates : todosResgates.filter(r => r.status === filtro);

    if (resgatesFiltrados.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-tertiary);">
                    <i class="fa-solid fa-inbox" style="font-size: 48px; margin-bottom: 16px; display: block; opacity: 0.3;"></i>
                    Nenhum resgate ${filtro === 'todos' ? '' : filtro}
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = resgatesFiltrados.map(r => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
                        ${getAvatarHeadHtml(r.habboName, '32px')}
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 13px;">${r.forumName || r.usuario}</div>
                        <div style="font-size: 11px; color: var(--text-tertiary);">${r.habboName}</div>
                    </div>
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 20px;">${r.emoji}</span>
                    <span>${r.nomeOvo}</span>
                </div>
            </td>
            <td><code style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-size: 12px;">${r.codigo}</code></td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: var(--gold-dark); font-weight: 700;"><i class="fa-solid fa-coins"></i> ${r.pontos}</span>
                    ${r.premio ? `<span style="font-size: 20px;" title="${r.premio.nome}">${r.premio.icone}</span>` : ''}
                </div>
            </td>
            <td style="font-size: 13px; color: var(--text-tertiary);">${new Date(r.data).toLocaleDateString('pt-BR')}</td>
            <td><span class="status-badge status-${r.status}"><i class="fa-solid fa-${r.status === 'aprovado' ? 'check' : r.status === 'rejeitado' ? 'xmark' : 'clock'}"></i> ${r.status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-view" onclick="verDetalhes('${r.id}')" title="Ver detalhes"><i class="fa-solid fa-eye"></i></button>
                    ${r.status === 'pendente' ? `
                        <button class="btn-icon btn-approve" onclick="aprovarResgate('${r.id}')" title="Aprovar"><i class="fa-solid fa-check"></i></button>
                        <button class="btn-icon btn-reject" onclick="rejeitarResgate('${r.id}')" title="Rejeitar"><i class="fa-solid fa-xmark"></i></button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function filtrarAdmin(status) {
    renderizarAdmin(status);
}

async function aprovarResgate(id) {
    const resgate = todosResgates.find(r => r.id === id);
    if (!resgate || resgate.status !== 'pendente') return;
    
    if (!confirm(`Aprovar resgate de ${resgate.nomeOvo} para ${resgate.usuario}?`)) return;

    resgate.status = 'aprovado';
    
    if (supabaseClient) {
        // Atualizar resgate
        await supabaseClient
            .from('resgates')
            .update({ 
                status: 'aprovado', 
                aprovado_em: new Date().toISOString(),
                aprovado_por: usuarioAtual?.id
            })
            .eq('id', id);
        
        // Decrementar estoque se houver prêmio
        if (resgate.premio_id) {
            await supabaseClient.rpc('decrementar_estoque', { premio_id: resgate.premio_id });
        }
        
        // Adicionar pontos ao usuário
        await supabaseClient.rpc('adicionar_pontos_usuario', { 
            p_habbo_name: resgate.habboName, 
            p_pontos: resgate.pontos 
        });
        
        // Incrementar contador de ovos
        await supabaseClient.rpc('incrementar_ovo_usuario', {
            p_habbo_name: resgate.habboName,
            p_tipo: resgate.tipo
        });
    }

    // Atualizar localmente se for o usuário atual
    if (resgate.habboName === usuarioAtual?.habboName) {
        usuarioAtual.pontos += resgate.pontos;
        usuarioAtual.ovosResgatados[resgate.tipo] = (usuarioAtual.ovosResgatados[resgate.tipo] || 0) + 1;
        if (resgate.premio) {
            usuarioAtual.premiosGanhos.push(resgate.premio);
        }
    }
    
    // Atualizar estoque local
    if (resgate.premio) {
        const premio = findPremioById(resgate.premio.id);
        if (premio && premio.estoque > 0) {
            premio.estoque--;
        }
    }

    renderizarAdmin();
    atualizarStats();
    renderizarMeusResgates();
    renderizarPremios();
    showToast('Sucesso', 'Resgate aprovado! Pontos creditados.', 'success');
}

async function rejeitarResgate(id) {
    const resgate = todosResgates.find(r => r.id === id);
    if (!resgate || resgate.status !== 'pendente') return;
    
    const motivo = prompt('Motivo da rejeição (opcional):');
    if (motivo === null) return; // Cancelado

    resgate.status = 'rejeitado';
    codigosSistema[resgate.codigo].usado = false; // Liberar código
    
    if (supabaseClient) {
        await supabaseClient
            .from('resgates')
            .update({ 
                status: 'rejeitado', 
                rejeitado_em: new Date().toISOString(),
                rejeitado_por: usuarioAtual?.id,
                motivo_rejeicao: motivo || null
            })
            .eq('id', id);
    }
    
    renderizarAdmin();
    renderizarMeusResgates();
    showToast('Resgate Rejeitado', 'O resgate foi rejeitado e o código liberado.', 'error');
}

function verDetalhes(id) {
    const resgate = todosResgates.find(r => r.id === id);
    if (!resgate) return;

    const content = document.getElementById('viewModalContent');
    if (!content) return;
    
    content.innerHTML = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 64px; margin-bottom: 12px;">${resgate.emoji}</div>
            <div style="height: 150px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 12px;">
                ${getAvatarFullBodyHtml(resgate.habboName, '150px')}
            </div>
            <h3 style="color: var(--primary);">${resgate.nomeOvo}</h3>
            <p style="color: var(--text-tertiary); font-size: 14px;">Código: ${resgate.codigo}</p>
        </div>
        
        <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
            <h4 style="margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: var(--text-tertiary);">Informações do Resgate</h4>
            <div style="display: grid; gap: 8px; font-size: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Habbo:</span> 
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden;">
                            ${getAvatarHeadHtml(resgate.habboName, '32px')}
                        </div>
                        <strong>${resgate.habboName}</strong>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Fórum:</span> <strong>${resgate.forumName || resgate.usuario}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;"><span>Data:</span> <strong>${new Date(resgate.data).toLocaleString('pt-BR')}</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Status:</span> <span class="status-badge status-${resgate.status}">${resgate.status}</span></div>
                <div style="display: flex; justify-content: space-between;"><span>Pontos:</span> <strong style="color: var(--gold-dark);">+${resgate.pontos}</strong></div>
                ${resgate.premio ? `<div style="display: flex; justify-content: space-between; align-items: center;"><span>Prêmio:</span> <span>${resgate.premio.icone} ${resgate.premio.nome}</span></div>` : ''}
            </div>
        </div>

        ${resgate.descricao ? `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                <h4 style="margin-bottom: 8px; font-size: 14px; text-transform: uppercase; color: var(--text-tertiary);">Descrição do Usuário</h4>
                <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">${resgate.descricao}</p>
            </div>
        ` : ''}

        ${resgate.comprovante ? `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                <h4 style="margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: var(--text-tertiary);">Screenshot Anexado</h4>
                <img src="${resgate.comprovante.dataUrl}" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border);" alt="Comprovante" onclick="window.open(this.src, '_blank')">
            </div>
        ` : ''}

        <div style="display: flex; gap: 12px;">
            <button class="btn btn-secondary" style="flex: 1;" onclick="fecharViewModal()">Fechar</button>
            ${resgate.status === 'pendente' && isAdmin() ? `
                <button class="btn btn-success" style="flex: 1;" onclick="aprovarResgate('${resgate.id}'); fecharViewModal();"><i class="fa-solid fa-check"></i> Aprovar</button>
                <button class="btn btn-danger" style="flex: 1;" onclick="rejeitarResgate('${resgate.id}'); fecharViewModal();"><i class="fa-solid fa-xmark"></i> Rejeitar</button>
            ` : ''}
        </div>
    `;
    
    const modal = document.getElementById('viewModal');
    if (modal) modal.classList.add('active');
}

function fecharViewModal() {
    const modal = document.getElementById('viewModal');
    if (modal) modal.classList.remove('active');
}

// ==========================================
// FUNÇÕES ADMIN - GERENCIAMENTO
// ==========================================
async function adicionarPremio(categoria, nome, descricao, icone, estoqueInicial) {
    if (!isAdmin()) return;
    
    if (supabaseClient) {
        const { data, error } = await supabaseClient
            .from('premios')
            .insert([{
                nome,
                descricao,
                icone,
                estoque: estoqueInicial,
                categoria,
                ativo: true
            }])
            .select();
        
        if (data) {
            catalogoPremios[categoria].push({
                id: data[0].id,
                nome,
                descricao,
                icone,
                estoque: estoqueInicial
            });
            renderizarPremios();
            showToast('Sucesso', 'Prêmio adicionado!', 'success');
            return data[0];
        } else if (error) {
            showToast('Erro', error.message, 'error');
        }
    }
}

async function removerPremio(premioId) {
    if (!isAdmin()) return;
    if (!confirm('Tem certeza que deseja remover este prêmio?')) return;
    
    if (supabaseClient) {
        await supabaseClient
            .from('premios')
            .update({ ativo: false })
            .eq('id', premioId);
    }
    
    for (const cat in catalogoPremios) {
        const index = catalogoPremios[cat].findIndex(p => p.id === premioId);
        if (index !== -1) {
            catalogoPremios[cat].splice(index, 1);
            break;
        }
    }
    renderizarPremios();
    showToast('Prêmio Removido', 'O prêmio foi desativado.', 'success');
}

async function atualizarEstoque(premioId, quantidade) {
    if (!isAdmin()) return;
    
    const premio = findPremioById(premioId);
    if (!premio) return;
    
    const novoEstoque = Math.max(0, premio.estoque + quantidade);
    
    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('premios')
            .update({ estoque: novoEstoque })
            .eq('id', premioId);
        
        if (error) {
            showToast('Erro', error.message, 'error');
            return;
        }
    }
    
    premio.estoque = novoEstoque;
    renderizarPremios();
    showToast('Estoque Atualizado', `Novo estoque: ${novoEstoque}`, 'success');
}

async function adicionarPontos(habboName, pontos) {
    if (!isAdmin()) return;
    
    if (supabaseClient) {
        await supabaseClient.rpc('adicionar_pontos_usuario', {
            p_habbo_name: habboName,
            p_pontos: pontos
        });
    }
    
    if (usuarioAtual && habboName === usuarioAtual.habboName) {
        usuarioAtual.pontos += pontos;
        atualizarStats();
    }
    
    showToast('Pontos Adicionados', `${pontos} pontos para ${habboName}`, 'success');
}

async function removerPontos(habboName, pontos) {
    if (!isAdmin()) return;
    
    if (supabaseClient) {
        await supabaseClient.rpc('remover_pontos_usuario', {
            p_habbo_name: habboName,
            p_pontos: pontos
        });
    }
    
    if (usuarioAtual && habboName === usuarioAtual.habboName) {
        usuarioAtual.pontos = Math.max(0, usuarioAtual.pontos - pontos);
        atualizarStats();
    }
    
    showToast('Pontos Removidos', `${pontos} pontos de ${habboName}`, 'success');
}

async function alterarPermissao(habboName, novoGrupo) {
    if (!isAdmin()) return;
    
    if (supabaseClient) {
        const { error } = await supabaseClient
            .from('usuarios')
            .update({ grupo_permissao: novoGrupo })
            .eq('habbo_name', habboName);
        
        if (error) {
            showToast('Erro', error.message, 'error');
            return;
        }
    }
    
    if (usuarioAtual && habboName === usuarioAtual.habboName) {
        usuarioAtual.grupoPermissao = novoGrupo;
    }
    
    showToast('Permissão Alterada', `${habboName} agora é ${novoGrupo}`, 'success');
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function showToast(title, message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.className = `toast ${type}`;
    
    const titleEl = document.getElementById('toastTitle');
    const msgEl = document.getElementById('toastMessage');
    
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initSupabase();
    
    const autenticado = await inicializarUsuario();
    if (!autenticado) return;
    
    await carregarPremios();
    await carregarResgates();
    
    // Atualizar UI com dados do usuário
    const userAvatar = document.querySelector('.user-avatar');
    const mobileAvatar = document.getElementById('mobileProfileAvatar');
    const mobileName = document.getElementById('mobileUserName');
    const mobileRole = document.getElementById('mobileUserRole');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    if (userAvatar) userAvatar.innerHTML = getAvatarHeadHtml(usuarioAtual.habboName, '48px');
    if (mobileAvatar) mobileAvatar.innerHTML = getAvatarHeadHtml(usuarioAtual.habboName, '56px');
    if (mobileName) mobileName.textContent = usuarioAtual.habboName;
    if (mobileRole) mobileRole.textContent = usuarioAtual.cargoOriginal || usuarioAtual.cargo;
    if (userName) userName.textContent = usuarioAtual.habboName;
    if (userRole) userRole.textContent = usuarioAtual.cargoOriginal || usuarioAtual.cargo;

    // Renderizar todas as seções
    renderizarGuiaOvos();
    renderizarPremios();
    atualizarStats();
    renderizarMeusResgates();
    renderizarRanking();
    renderizarAdmin();
    
    // Mostrar seção inicial
    showSection('guia');
});
