// ==========================================
// CONFIGURAÇÃO
// ==========================================
const SUPABASE_URL = 'https://gjxlapydpafwvyohovhj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeGxhcHlkcGFmd3Z5b2hvdmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDc3NTIsImV4cCI6MjA4NzcyMzc1Mn0.ni9szYqdrFWz3HcwYuOZaBFgcFddDoYSyZEakSQho-c';

let supabaseClient = null;

// Config dos ovos (apenas metadados, códigos vêm do Supabase)
const configOvos = {
    comum: { id: 'comum', nome: 'Ovo Comum', emoji: '🥚', cor: '#8B4513', pontos: 5, limite: Infinity, desc: 'Fácil de encontrar' },
    incomum: { id: 'incomum', nome: 'Ovo Incomum', emoji: '🥚', cor: '#22c55e', pontos: 10, limite: 10, desc: 'Requer atenção' },
    raro: { id: 'raro', nome: 'Ovo Raro', emoji: '🥚', cor: '#3b82f6', pontos: 30, limite: 5, desc: 'Bem escondido', chancePremio: 0.1 },
    epico: { id: 'epico', nome: 'Ovo Épico', emoji: '🥚', cor: '#a855f7', pontos: 50, limite: 1, desc: 'Extremamente raro', chancePremio: 0.4 },
    lendario: { id: 'lendario', nome: 'Ovo Lendário', emoji: '🥚', cor: '#f59e0b', pontos: 100, limite: 1, desc: 'Quase impossível', chancePremio: 0.6 },
    coelhao: { id: 'coelhao', nome: 'Coelhão', emoji: '🐰', cor: 'gradient', pontos: 500, limite: 1, desc: 'ÚNICO! Grande prêmio garantido', premioGarantido: true }
};

// Variáveis globais
let usuarioAtual = null;
let membros = [];
let catalogoPremios = { comum: [], incomum: [], raro: [], epico: [], lendario: [] };
let todosResgates = [];
let resgatePendente = null;
let codigosCache = {}; // Cache local dos códigos
let tipoRankingAtual = 'pontos';

const CARGOS_IGNORADOS = ['fiscalizador', 'diretor', 'vice-presidente', 'presidente'];

// ==========================================
// INICIALIZAÇÃO
// ==========================================
function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================
async function pegarUsernameForum() {
    try {
        const resposta = await fetch("/forum");
        const html = await resposta.text();
        const regex = /_userdata\["username"\]\s*=\s*"([^"]+)"/;
        const match = html.match(regex);
        
        if (match && match[1]) {
            const username = match[1].trim();
            localStorage.setItem("forumUser", username);
            return username;
        }
        throw new Error('Não autenticado');
    } catch (err) {
        const fallback = localStorage.getItem("forumUser");
        if (fallback) return fallback;
        throw err;
    }
}

async function inicializarUsuario() {
    try {
        const forumName = await pegarUsernameForum();
        
        // Buscar membros
        const response = await fetch('https://script.google.com/macros/s/AKfycbzhJdbeZfxkHgh3cQrK_YlhBCuhZyLhM_9jYkAnCPmbz-aYpv7845740KySuhjTzdIb/exec');
        const data = await response.json();
        membros = data.filter(m => !CARGOS_IGNORADOS.includes(m.cargo.toLowerCase()));
        
        const membro = membros.find(m => m.nick === forumName);
        if (!membro) {
            mostrarErro('Você não é membro autorizado.');
            return false;
        }

        // Buscar/criar no Supabase
        let { data: userData } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('forum_name', forumName)
            .single();

        if (!userData) {
            const { data: newUser } = await supabaseClient
                .from('usuarios')
                .insert([{
                    forum_name: forumName,
                    habbo_name: forumName, // Inicialmente igual, pode editar depois
                    pontos: 0,
                    grupo_permissao: forumName === '???JUKA' ? 'admin' : 'usuario',
                    ovos_resgatados: { comum: 0, incomum: 0, raro: 0, epico: 0, lendario: 0, coelhao: 0 }
                }])
                .select()
                .single();
            userData = newUser;
        }

        usuarioAtual = {
            id: userData.id,
            forumName: userData.forum_name,
            habboName: userData.habbo_name,
            nome: userData.habbo_name, // Exibe Habbo name
            cargo: membro.cargo,
            pontos: userData.pontos || 0,
            ovosResgatados: userData.ovos_resgatados || {},
            historico: [],
            grupoPermissao: userData.grupo_permissao || 'usuario'
        };

        await carregarDados();
        return true;
        
    } catch (err) {
        mostrarErro('Erro de autenticação: ' + err.message);
        return false;
    }
}

async function carregarDados() {
    await carregarPremios();
    await carregarResgates();
    await carregarCodigosStats(); // Estatísticas dos códigos
}

function mostrarErro(msg) {
    document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;font-family:Inter,sans-serif;text-align:center;padding:20px;">
            <div style="font-size:64px;margin-bottom:20px;">🚫</div>
            <h1 style="font-size:24px;margin-bottom:16px;">Acesso Negado</h1>
            <p>${msg}</p>
            <button onclick="location.reload()" style="margin-top:24px;padding:12px 24px;background:white;color:#1e40af;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Tentar Novamente</button>
        </div>
    `;
}

// ==========================================
// CÓDIGOS - AGORA DO SUPABASE
// ==========================================
async function verificarCodigoNoSupabase(codigo) {
    const { data, error } = await supabaseClient
        .from('codigos_ovos')
        .select('*')
        .eq('codigo', codigo.toUpperCase())
        .single();
    
    if (error || !data) return { valido: false, motivo: 'Código não encontrado' };
    if (data.usado) return { valido: false, motivo: 'Código já foi usado' };
    
    return { 
        valido: true, 
        tipo: data.tipo,
        codigoId: data.id 
    };
}

async function marcarCodigoUsado(codigoId) {
    const { error } = await supabaseClient.rpc('usar_codigo', {
        p_codigo: null, // Não usamos aqui, usamos update direto
        p_usuario_id: usuarioAtual.id
    });
    
    // Ou faça update direto:
    await supabaseClient
        .from('codigos_ovos')
        .update({ 
            usado: true, 
            usado_por: usuarioAtual.id, 
            usado_em: new Date().toISOString() 
        })
        .eq('id', codigoId);
}

async function carregarCodigosStats() {
    // Buscar estatísticas de códigos para o admin
    if (!isAdmin()) return;
    
    const { data } = await supabaseClient
        .from('codigos_ovos')
        .select('tipo, usado');
    
    if (data) {
        codigosCache = {};
        data.forEach(c => {
            if (!codigosCache[c.tipo]) codigosCache[c.tipo] = { total: 0, usados: 0 };
            codigosCache[c.tipo].total++;
            if (c.usado) codigosCache[c.tipo].usados++;
        });
    }
}

// ==========================================
// PRÊMIOS
// ==========================================
async function carregarPremios() {
    const { data } = await supabaseClient
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
                    estoque: p.estoque,
                    categoria: p.categoria
                });
            }
        });
    }
}

// ==========================================
// RESGATES
// ==========================================
async function carregarResgates() {
    // Histórico do usuário
    const { data } = await supabaseClient
        .from('resgates')
        .select('*, premio:premio_id(*)')
        .eq('habbo_name', usuarioAtual.habboName)
        .order('created_at', { ascending: false });
    
    if (data) {
        usuarioAtual.historico = data.map(r => ({
            id: r.id,
            tipo: r.tipo_ovo,
            nomeOvo: configOvos[r.tipo_ovo]?.nome,
            emoji: configOvos[r.tipo_ovo]?.emoji,
            codigo: r.codigo,
            pontos: r.pontos,
            premio: r.premio,
            data: r.created_at,
            status: r.status,
            descricao: r.descricao
        }));
    }
    
    // Todos os resgates (para admin)
    if (isAdmin()) {
        const { data: todos } = await supabaseClient
            .from('resgates')
            .select('*, premio:premio_id(*)')
            .order('created_at', { ascending: false });
        
        if (todos) {
            todosResgates = todos.map(r => ({
                id: r.id,
                usuario_id: r.usuario_id,
                habboName: r.habbo_name,
                forumName: r.forum_name,
                usuario: r.forum_name || r.habbo_name,
                tipo: r.tipo_ovo,
                nomeOvo: configOvos[r.tipo_ovo]?.nome,
                emoji: configOvos[r.tipo_ovo]?.emoji,
                codigo: r.codigo,
                pontos: r.pontos,
                premio: r.premio,
                data: r.created_at,
                status: r.status,
                descricao: r.descricao
            }));
        }
    }
}

// ==========================================
// LÓGICA DE RESGATE
// ==========================================
async function iniciarResgateCodigo() {
    const input = document.getElementById('codigoInput');
    const codigo = input.value.trim();

    if (!codigo) {
        showToast('Erro', 'Digite um código!', 'error');
        return;
    }

    // Verificar no Supabase
    const verificacao = await verificarCodigoNoSupabase(codigo);
    
    if (!verificacao.valido) {
        showToast('Código Inválido', verificacao.motivo, 'error');
        input.value = '';
        return;
    }

    const config = configOvos[verificacao.tipo];
    
    // Verificar limite do usuário
    const jaResgatados = usuarioAtual.ovosResgatados[verificacao.tipo] || 0;
    if (jaResgatados >= config.limite) {
        showToast('Limite Atingido', `Você já resgatou o máximo de ${config.nome}(s)!`, 'error');
        return;
    }

    resgatePendente = {
        codigo: codigo.toUpperCase(),
        codigoId: verificacao.codigoId,
        tipo: verificacao.tipo,
        config: config
    };

    abrirComprovacaoModal();
}

async function confirmarComprovacao(e) {
    e.preventDefault();
    if (!resgatePendente) return;

    const descricao = document.getElementById('comprovacaoDesc')?.value || '';
    const fileInput = document.getElementById('comprovacaoFile');
    const file = fileInput?.files[0];
    const config = resgatePendente.config;

    // Determinar prêmio
    let premioGanho = null;
    let premioId = null;
    
    if (config.premioGarantido) {
        const disponiveis = catalogoPremios.lendario.filter(p => p.estoque > 0);
        if (disponiveis.length > 0) {
            premioGanho = disponiveis[0];
            premioId = premioGanho.id;
        }
    } else if (config.chancePremio && Math.random() < config.chancePremio) {
        const cat = config.id === 'lendario' ? 'lendario' : config.id === 'epico' ? 'epico' : 'raro';
        const disponiveis = catalogoPremios[cat].filter(p => p.estoque > 0);
        if (disponiveis.length > 0) {
            premioGanho = disponiveis[Math.floor(Math.random() * disponiveis.length)];
            premioId = premioGanho.id;
        }
    }

    // Upload imagem
    let comprovanteUrl = null;
    if (file) {
        const fileName = `${usuarioAtual.id}/${Date.now()}.${file.name.split('.').pop()}`;
        const { data: upload } = await supabaseClient.storage.from('comprovantes').upload(fileName, file);
        if (upload) {
            const { data: { publicUrl } } = supabaseClient.storage.from('comprovantes').getPublicUrl(fileName);
            comprovanteUrl = publicUrl;
        }
    }

    // Salvar resgate
    const { data: resgateData, error } = await supabaseClient
        .from('resgates')
        .insert([{
            usuario_id: usuarioAtual.id,
            habbo_name: usuarioAtual.habboName,
            forum_name: usuarioAtual.forumName,
            tipo_ovo: resgatePendente.tipo,
            codigo: resgatePendente.codigo,
            pontos: config.pontos,
            premio_id: premioId,
            descricao: descricao,
            comprovante_url: comprovanteUrl,
            status: 'pendente'
        }])
        .select()
        .single();

    if (error) {
        showToast('Erro', 'Falha ao salvar: ' + error.message, 'error');
        return;
    }

    // Marcar código como usado
    await supabaseClient
        .from('codigos_ovos')
        .update({ usado: true, usado_por: usuarioAtual.id, usado_em: new Date().toISOString() })
        .eq('id', resgatePendente.codigoId);

    // Atualizar local
    usuarioAtual.historico.unshift({
        id: resgateData.id,
        tipo: resgatePendente.tipo,
        nomeOvo: config.nome,
        emoji: config.emoji,
        codigo: resgatePendente.codigo,
        pontos: config.pontos,
        premio: premioGanho,
        data: resgateData.created_at,
        status: 'pendente'
    });

    fecharComprovacaoModal();
    document.getElementById('codigoInput').value = '';
    showToast('Sucesso!', 'Resgate enviado para aprovação.', 'success');
    renderizarMeusResgates();
    if (isAdmin()) renderizarAdmin();
}

// ==========================================
// ADMIN - GERENCIAMENTO DE PRÊMIOS (INTERFACE)
// ==========================================
function renderizarAdmin() {
    if (!isAdmin()) {
        document.getElementById('adminContent').innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock"></i><h3>Acesso Restrito</h3></div>';
        return;
    }

    const container = document.getElementById('adminContent');
    
    container.innerHTML = `
        <!-- ABAS DO ADMIN -->
        <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
            <button class="btn btn-sm ${abaAdminAtiva === 'resgates' ? 'btn-primary' : 'btn-secondary'}" onclick="mudarAbaAdmin('resgates')">
                <i class="fa-solid fa-clipboard-check"></i> Aprovar Resgates
            </button>
            <button class="btn btn-sm ${abaAdminAtiva === 'premios' ? 'btn-primary' : 'btn-secondary'}" onclick="mudarAbaAdmin('premios')">
                <i class="fa-solid fa-gift"></i> Gerenciar Prêmios
            </button>
            <button class="btn btn-sm ${abaAdminAtiva === 'codigos' ? 'btn-primary' : 'btn-secondary'}" onclick="mudarAbaAdmin('codigos')">
                <i class="fa-solid fa-key"></i> Gerenciar Códigos
            </button>
            <button class="btn btn-sm ${abaAdminAtiva === 'usuarios' ? 'btn-primary' : 'btn-secondary'}" onclick="mudarAbaAdmin('usuarios')">
                <i class="fa-solid fa-users"></i> Usuários
            </button>
        </div>

        <!-- CONTEÚDO DAS ABAS -->
        <div id="adminAbaContent"></div>
    `;

    renderizarAbaAdmin();
}

let abaAdminAtiva = 'resgates';

function mudarAbaAdmin(aba) {
    abaAdminAtiva = aba;
    renderizarAdmin();
}

function renderizarAbaAdmin() {
    const content = document.getElementById('adminAbaContent');
    
    switch(abaAdminAtiva) {
        case 'resgates':
            content.innerHTML = renderizarAbaResgates();
            break;
        case 'premios':
            content.innerHTML = renderizarAbaPremios();
            break;
        case 'codigos':
            content.innerHTML = renderizarAbaCodigos();
            break;
        case 'usuarios':
            content.innerHTML = renderizarAbaUsuarios();
            break;
    }
}

// ---------- ABA: RESGATES ----------
function renderizarAbaResgates() {
    const pendentes = todosResgates.filter(r => r.status === 'pendente');
    
    return `
        <div class="panel">
            <div class="panel-header">
                <div class="panel-title">
                    <i class="fa-solid fa-clock"></i> Resgates Pendentes (${pendentes.length})
                </div>
                <select class="filter-select" onchange="filtrarResgates(this.value)" style="width: auto;">
                    <option value="pendente">Pendentes</option>
                    <option value="todos">Todos</option>
                    <option value="aprovado">Aprovados</option>
                    <option value="rejeitado">Rejeitados</option>
                </select>
            </div>
            <div class="panel-content">
                <div style="overflow-x: auto;">
                    <table class="resgates-table">
                        <thead>
                            <tr>
                                <th>Usuário</th>
                                <th>Ovo</th>
                                <th>Código</th>
                                <th>Recompensa</th>
                                <th>Data</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendentes.length === 0 ? `
                                <tr><td colspan="6" class="empty-state" style="padding: 40px;">
                                    <i class="fa-solid fa-check-circle" style="font-size: 48px; color: var(--success);"></i>
                                    <h3>Tudo em ordem!</h3>
                                    <p>Nenhum resgate pendente.</p>
                                </td></tr>
                            ` : pendentes.map(r => `
                                <tr>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden;">
                                                ${getAvatarHeadHtml(r.habboName, '32px')}
                                            </div>
                                            <div>
                                                <div style="font-weight: 600;">${r.forumName}</div>
                                                <div style="font-size: 11px; color: var(--text-tertiary);">${r.habboName}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span style="font-size: 20px;">${r.emoji}</span> ${r.nomeOvo}</td>
                                    <td><code style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px;">${r.codigo}</code></td>
                                    <td>
                                        <span style="color: var(--gold-dark); font-weight: 700;"><i class="fa-solid fa-coins"></i> ${r.pontos}</span>
                                        ${r.premio ? `<br><span style="font-size: 16px;">${r.premio.icone} ${r.premio.nome}</span>` : ''}
                                    </td>
                                    <td style="font-size: 13px;">${new Date(r.data).toLocaleDateString('pt-BR')}</td>
                                    <td>
                                        <div class="action-btns">
                                            <button class="btn-icon btn-view" onclick="verDetalhesResgate('${r.id}')" title="Ver detalhes"><i class="fa-solid fa-eye"></i></button>
                                            <button class="btn-icon btn-approve" onclick="aprovarResgate('${r.id}')" title="Aprovar"><i class="fa-solid fa-check"></i></button>
                                            <button class="btn-icon btn-reject" onclick="rejeitarResgate('${r.id}')" title="Rejeitar"><i class="fa-solid fa-xmark"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// ---------- ABA: PRÊMIOS (GERENCIAMENTO COMPLETO) ----------
function renderizarAbaPremios() {
    const todasCategorias = ['comum', 'incomum', 'raro', 'epico', 'lendario'];
    
    return `
        <div style="display: grid; gap: 20px;">
            <!-- FORMULÁRIO PARA ADICIONAR PRÊMIO -->
            <div class="panel" style="border: 2px solid var(--primary);">
                <div class="panel-header" style="background: var(--gradient-primary); color: white;">
                    <div class="panel-title" style="color: white;">
                        <i class="fa-solid fa-plus-circle"></i> Adicionar Novo Prêmio
                    </div>
                </div>
                <div class="panel-content">
                    <form onsubmit="adicionarNovoPremio(event)" style="display: grid; gap: 16px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                            <div class="form-group">
                                <label class="form-label">Nome do Prêmio *</label>
                                <input type="text" class="form-input" id="novoPremioNome" required placeholder="Ex: Badge Ouro">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Categoria *</label>
                                <select class="form-select" id="novoPremioCategoria" required>
                                    ${todasCategorias.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Ícone (Emoji) *</label>
                                <input type="text" class="form-input" id="novoPremioIcone" required placeholder="🏆" maxlength="2">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Estoque Inicial *</label>
                                <input type="number" class="form-input" id="novoPremioEstoque" required min="1" value="1">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Descrição</label>
                            <input type="text" class="form-input" id="novoPremioDescricao" placeholder="Descrição do prêmio...">
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: auto; justify-self: start;">
                            <i class="fa-solid fa-plus"></i> Adicionar Prêmio
                        </button>
                    </form>
                </div>
            </div>

            <!-- LISTA DE PRÊMIOS POR CATEGORIA -->
            ${todasCategorias.map(cat => `
                <div class="panel">
                    <div class="panel-header">
                        <div class="panel-title">
                            <i class="fa-solid fa-${cat === 'comum' ? 'star' : cat === 'incomum' ? 'star-half' : cat === 'raro' ? 'gem' : cat === 'epico' ? 'crown' : 'trophy'}"></i>
                            Prêmios ${cat.charAt(0).toUpperCase() + cat.slice(1)}
                            <span class="panel-badge">${catalogoPremios[cat].length}</span>
                        </div>
                    </div>
                    <div class="panel-content">
                        ${catalogoPremios[cat].length === 0 ? '<p style="color: var(--text-tertiary);">Nenhum prêmio nesta categoria.</p>' : `
                            <div style="display: grid; gap: 12px;">
                                ${catalogoPremios[cat].map(p => `
                                    <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-white); border-radius: 12px; border: 1px solid var(--border-light);">
                                        <div style="font-size: 40px; width: 60px; text-align: center;">${p.icone}</div>
                                        <div style="flex: 1;">
                                            <h4 style="margin-bottom: 4px;">${p.nome}</h4>
                                            <p style="font-size: 13px; color: var(--text-tertiary);">${p.descricao || 'Sem descrição'}</p>
                                        </div>
                                        <div style="text-align: center; min-width: 100px;">
                                            <div style="font-size: 24px; font-weight: 800; color: ${p.estoque > 0 ? 'var(--success)' : 'var(--danger)'};">${p.estoque}</div>
                                            <div style="font-size: 11px; color: var(--text-tertiary);">em estoque</div>
                                        </div>
                                        <div style="display: flex; flex-direction: column; gap: 8px;">
                                            <div style="display: flex; gap: 4px; justify-content: center;">
                                                <button class="btn-icon" onclick="ajustarEstoque('${p.id}', 1)" title="Aumentar estoque" style="background: var(--success); color: white;">
                                                    <i class="fa-solid fa-plus"></i>
                                                </button>
                                                <button class="btn-icon" onclick="ajustarEstoque('${p.id}', -1)" title="Diminuir estoque" style="background: var(--warning); color: white;">
                                                    <i class="fa-solid fa-minus"></i>
                                                </button>
                                            </div>
                                            <button class="btn btn-sm btn-danger" onclick="removerPremio('${p.id}')" style="font-size: 11px; padding: 4px 8px;">
                                                <i class="fa-solid fa-trash"></i> Remover
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ---------- ABA: CÓDIGOS ----------
function renderizarAbaCodigos() {
    return `
        <div class="panel">
            <div class="panel-header">
                <div class="panel-title">
                    <i class="fa-solid fa-key"></i> Gerenciar Códigos de Ovos
                </div>
                <button class="btn btn-primary btn-sm" onclick="abrirModalNovoCodigo()">
                    <i class="fa-solid fa-plus"></i> Novo Código
                </button>
            </div>
            <div class="panel-content">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    ${Object.entries(configOvos).map(([key, ovo]) => `
                        <div style="background: var(--bg-white); padding: 20px; border-radius: 12px; border-left: 4px solid ${ovo.cor === 'gradient' ? '#f59e0b' : ovo.cor};">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                <span style="font-size: 32px;">${ovo.emoji}</span>
                                <div>
                                    <h4 style="color: ${ovo.cor === 'gradient' ? '#f59e0b' : ovo.cor};">${ovo.nome}</h4>
                                    <p style="font-size: 12px; color: var(--text-tertiary);">${ovo.pontos} pontos</p>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px;">
                                <span>Total: <strong>${codigosCache[key]?.total || 0}</strong></span>
                                <span>Disponíveis: <strong style="color: var(--success);">${(codigosCache[key]?.total || 0) - (codigosCache[key]?.usados || 0)}</strong></span>
                                <span>Usados: <strong style="color: var(--danger);">${codigosCache[key]?.usados || 0}</strong></span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <button class="btn btn-secondary" onclick="carregarCodigosStats(); renderizarAbaAdmin();">
                    <i class="fa-solid fa-rotate"></i> Atualizar Estatísticas
                </button>
            </div>
        </div>
    `;
}

// ---------- ABA: USUÁRIOS ----------
function renderizarAbaUsuarios() {
    return `
        <div class="panel">
            <div class="panel-header">
                <div class="panel-title">
                    <i class="fa-solid fa-users"></i> Gerenciar Usuários
                </div>
            </div>
            <div class="panel-content">
                <p style="color: var(--text-tertiary);">Funcionalidade em desenvolvimento...</p>
            </div>
        </div>
    `;
}

// ==========================================
// FUNÇÕES ADMIN - AÇÕES
// ==========================================

// Adicionar novo prêmio
async function adicionarNovoPremio(e) {
    e.preventDefault();
    
    const nome = document.getElementById('novoPremioNome').value;
    const categoria = document.getElementById('novoPremioCategoria').value;
    const icone = document.getElementById('novoPremioIcone').value;
    const estoque = parseInt(document.getElementById('novoPremioEstoque').value);
    const descricao = document.getElementById('novoPremioDescricao').value;

    const { data, error } = await supabaseClient
        .from('premios')
        .insert([{ nome, categoria, icone, estoque, descricao, ativo: true }])
        .select()
        .single();

    if (error) {
        showToast('Erro', error.message, 'error');
        return;
    }

    // Atualizar local
    catalogoPremios[categoria].push({
        id: data.id,
        nome, descricao, icone, estoque, categoria
    });

    showToast('Sucesso!', 'Prêmio adicionado com sucesso!', 'success');
    
    // Limpar formulário e recarregar
    e.target.reset();
    renderizarAbaAdmin();
}

// Ajustar estoque
async function ajustarEstoque(premioId, quantidade) {
    const premio = findPremioById(premioId);
    if (!premio) return;
    
    const novoEstoque = Math.max(0, premio.estoque + quantidade);
    
    const { error } = await supabaseClient
        .from('premios')
        .update({ estoque: novoEstoque })
        .eq('id', premioId);

    if (error) {
        showToast('Erro', error.message, 'error');
        return;
    }

    premio.estoque = novoEstoque;
    renderizarAbaAdmin();
    showToast('Estoque Atualizado', `Novo estoque: ${novoEstoque}`, 'success');
}

// Remover prêmio
async function removerPremio(premioId) {
    if (!confirm('Tem certeza que deseja remover este prêmio?')) return;
    
    await supabaseClient
        .from('premios')
        .update({ ativo: false })
        .eq('id', premioId);

    // Remover do cache local
    for (const cat in catalogoPremios) {
        const idx = catalogoPremios[cat].findIndex(p => p.id === premioId);
        if (idx !== -1) {
            catalogoPremios[cat].splice(idx, 1);
            break;
        }
    }

    renderizarAbaAdmin();
    showToast('Prêmio Removido', 'O prêmio foi desativado.', 'success');
}

// Aprovar resgate
async function aprovarResgate(id) {
    const resgate = todosResgates.find(r => r.id === id);
    if (!resgate) return;

    await supabaseClient
        .from('resgates')
        .update({ status: 'aprovado', aprovado_em: new Date().toISOString() })
        .eq('id', id);

    // Atualizar pontos do usuário
    await supabaseClient.rpc('adicionar_pontos_usuario', {
        p_habbo_name: resgate.habboName,
        p_pontos: resgate.pontos
    });

    // Decrementar estoque se houver prêmio
    if (resgate.premio) {
        await supabaseClient.rpc('decrementar_estoque', { premio_id: resgate.premio.id });
        const p = findPremioById(resgate.premio.id);
        if (p) p.estoque--;
    }

    resgate.status = 'aprovado';
    renderizarAbaAdmin();
    showToast('Aprovado!', 'Resgate aprovado com sucesso.', 'success');
}

// Rejeitar resgate
async function rejeitarResgate(id) {
    const motivo = prompt('Motivo da rejeição (opcional):');
    if (motivo === null) return;

    await supabaseClient
        .from('resgates')
        .update({ 
            status: 'rejeitado', 
            rejeitado_em: new Date().toISOString(),
            motivo_rejeicao: motivo 
        })
        .eq('id', id);

    // Liberar o código para uso novamente
    await supabaseClient
        .from('codigos_ovos')
        .update({ usado: false, usado_por: null, usado_em: null })
        .eq('codigo', todosResgates.find(r => r.id === id)?.codigo);

    const r = todosResgates.find(r => r.id === id);
    if (r) r.status = 'rejeitado';
    
    renderizarAbaAdmin();
    showToast('Rejeitado', 'Resgate rejeitado e código liberado.', 'error');
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function findPremioById(id) {
    for (const cat in catalogoPremios) {
        const p = catalogoPremios[cat].find(x => x.id === id);
        if (p) return p;
    }
    return null;
}

function isAdmin() {
    return usuarioAtual?.grupoPermissao === 'admin';
}

function getAvatarHeadHtml(username, size = '48px') {
    if (!username) return '<div>🐰</div>';
    return `<img src="https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&headonly=1&size=s" 
        style="width: ${size}; height: ${size}; border-radius: 50%; object-fit: cover;" 
        onerror="this.style.display='none'; this.parentElement.innerHTML='🐰';">`;
}

function showToast(title, msg, type = 'success') {
    const toast = document.getElementById('toast');
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastMessage').textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==========================================
// UI BÁSICA
// ==========================================
function showSection(section) {
    document.querySelectorAll('.section-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`section-${section}`)?.classList.remove('hidden');
    
    if (section === 'admin') renderizarAdmin();
    if (section === 'meus') renderizarMeusResgates();
    if (section === 'premios') renderizarPremiosPublico();
    if (section === 'ranking') renderizarRanking();
}

function renderizarMeusResgates() {
    // Implementação básica
    const container = document.getElementById('meuHistoricoCompleto');
    if (!container) return;
    
    container.innerHTML = usuarioAtual?.historico?.length ? 
        usuarioAtual.historico.map(h => `
            <div style="padding: 16px; background: var(--bg-white); border-radius: 12px; margin-bottom: 12px; border-left: 4px solid ${h.status === 'aprovado' ? 'var(--success)' : h.status === 'pendente' ? 'var(--warning)' : 'var(--danger)'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-size: 24px;">${h.emoji}</span>
                        <strong>${h.nomeOvo}</strong>
                        <span class="status-badge status-${h.status}" style="margin-left: 8px;">${h.status}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 800; color: var(--gold-dark);">+${h.pontos} pts</div>
                        ${h.premio ? `<div>${h.premio.icone} ${h.premio.nome}</div>` : ''}
                    </div>
                </div>
            </div>
        `).join('') : 
        '<div class="empty-state"><h3>Nenhum resgate ainda</h3></div>';
}

function renderizarPremiosPublico() {
    // Implementação básica da visualização pública
    ['comum', 'incomum', 'raro', 'epico', 'lendario'].forEach(cat => {
        const container = document.getElementById(`premios${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
        if (!container) return;
        
        container.innerHTML = catalogoPremios[cat].map(p => `
            <div class="premio-card ${cat}">
                <span class="premio-raridade">${cat}</span>
                <div class="premio-icon">${p.icone}</div>
                <h4 class="premio-nome">${p.nome}</h4>
                <p class="premio-desc">${p.descricao}</p>
                <span class="premio-origem ovo">Estoque: ${p.estoque}</span>
            </div>
        `).join('');
    });
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initSupabase();
    if (await inicializarUsuario()) {
        // Atualizar avatares
        document.querySelector('.user-avatar').innerHTML = getAvatarHeadHtml(usuarioAtual.habboName, '48px');
        document.getElementById('mobileProfileAvatar').innerHTML = getAvatarHeadHtml(usuarioAtual.habboName, '56px');
        document.getElementById('userName').textContent = usuarioAtual.habboName;
        document.getElementById('mobileUserName').textContent = usuarioAtual.habboName;
        
        showSection('guia');
    }
});
