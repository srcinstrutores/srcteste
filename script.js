const SUPABASE_URL = 'https://gjxlapydpafwvyohovhj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeGxhcHlkcGFmd3Z5b2hvdmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDc3NTIsImV4cCI6MjA4NzcyMzc1Mn0.ni9szYqdrFWz3HcwYuOZaBFgcFddDoYSyZEakSQho-c';

let supabaseClient = null;

const configOvos = {
  comum: {
    id: 'comum',
    nome: 'Ovo Comum',
    emoji: '🥚',
    cor: '#8B4513',
    quantidadeTotal: 50,
    pontos: 5,
    limitePorUsuario: Infinity,
    limitePorOvo: Infinity,
    descricao: 'Ovos espalhados por toda a companhia. Fáceis de encontrar em páginas ou quartos comuns.',
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
    limitePorOvo: 1,
    descricao: 'Ovos escondidos em locais que requerem mais atenção. Valor médio de recompensa.',
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
    limitePorOvo: 1,
    descricao: 'Ovos bem escondidos. Requer dedicação para encontrar. Boas recompensas!',
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
    limitePorOvo: 1,
    descricao: 'Ovos extremamente raros! Grande chance de ganhar prêmios épicos.',
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
    limitePorOvo: 1,
    descricao: 'Ovos quase impossíveis de encontrar! Alta chance de prêmios lendários.',
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
    limitePorOvo: 1,
    unicoGlobal: true,
    descricao: 'O GRANDE PRÊMIO! Existe apenas UM na companhia inteira. Prêmio único garantido!',
    premioGarantido: true,
    chancePremio: 1
  }
};

const CARGOS_IGNORADOS = ['fiscalizador', 'diretor', 'vice-presidente', 'presidente'];

let membros = [];
let usuarioAtual = null;
let todosResgates = [];
let todasTrocas = [];
let resgatePendente = null;
let tipoRankingAtual = 'pontos';
let abaAdminAtiva = 'resgates';
let catalogoPremios = {
  comum: [],
  incomum: [],
  raro: [],
  epico: [],
  lendario: []
};
let codigosStats = {};
let todosCodigosLista = [];
let subscriptions = [];
let isInitialized = false;

function initSupabase() {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
  }
}

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
    throw new Error('Não autenticado no fórum');
  } catch (err) {
    const fallback = localStorage.getItem("forumUser");
    if (fallback) return fallback;
    throw err;
  }
}

async function inicializarUsuario() {
  try {
    const forumName = await pegarUsernameForum();

    const response = await fetch('https://script.google.com/macros/s/AKfycbzhJdbeZfxkHgh3cQrK_YlhBCuhZyLhM_9jYkAnCPmbz-aYpv7845740KySuhjTzdIb/exec');
    const data = await response.json();

    membros = data.filter(m => !CARGOS_IGNORADOS.includes(m.cargo.toLowerCase()));

    const membro = membros.find(m => m.nick === forumName);
    if (!membro) {
      mostrarErroLogin('Você não é membro autorizado desta companhia.');
      return false;
    }

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
          habbo_name: forumName,
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
      nome: userData.habbo_name,
      cargo: membro.cargo,
      cargoOriginal: membro.cargoOriginal || membro.cargo,
      pontos: userData.pontos || 0,
      ovosResgatados: userData.ovos_resgatados || {},
      historico: [],
      premiosGanhos: [],
      grupoPermissao: userData.grupo_permissao || 'usuario'
    };

    atualizarUIUsuario();
    await carregarTodosOsDados();
    isInitialized = true;
    
    renderizarGuiaOvos();
    renderizarPremios();
    atualizarStats();
    renderizarMeusResgates();
    iniciarSubscriptions();

    if (isAdmin()) {
      document.getElementById('adminNavSection').style.display = 'block';
    }

    return true;

  } catch (err) {
    console.error(err);
    mostrarErroLogin('Erro de autenticação: ' + err.message);
    return false;
  }
}

async function carregarTodosOsDados() {
  await Promise.all([
    carregarPremios(),
    carregarResgates(),
    carregarTrocas(),
    carregarCodigosStats()
  ]);
}

function atualizarUIUsuario() {
  if (!usuarioAtual) return;

  const userBadge = document.getElementById('userBadge');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');

  if (userBadge) userBadge.style.display = 'flex';
  if (userAvatar) userAvatar.innerHTML = getAvatarHeadHtml(usuarioAtual.habboName, '48px');
  if (userName) userName.textContent = usuarioAtual.habboName;
  if (userRole) userRole.textContent = usuarioAtual.cargoOriginal || usuarioAtual.cargo;

  const mobileProfile = document.getElementById('mobileProfile');
  const mobileAvatar = document.getElementById('mobileProfileAvatar');
  const mobileName = document.getElementById('mobileUserName');
  const mobileRole = document.getElementById('mobileUserRole');

  if (mobileProfile) mobileProfile.style.display = 'block';
  if (mobileAvatar) mobileAvatar.innerHTML = getAvatarHeadHtml(usuarioAtual.habboName, '56px');
  if (mobileName) mobileName.textContent = usuarioAtual.habboName;
  if (mobileRole) mobileRole.textContent = usuarioAtual.cargoOriginal || usuarioAtual.cargo;
}

function mostrarErroLogin(mensagem) {
  document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; font-family: 'Inter', sans-serif; text-align: center; padding: 20px;">
            <div style="font-size: 64px; margin-bottom: 20px;">🚫</div>
            <h1 style="font-size: 24px; margin-bottom: 16px; font-weight: 700;">Acesso Negado</h1>
            <p style="font-size: 16px; opacity: 0.9; max-width: 400px; line-height: 1.6;">${mensagem}</p>
            <button onclick="window.location.reload()" style="margin-top: 24px; padding: 12px 24px; background: white; color: #1e40af; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Tentar Novamente</button>
        </div>
    `;
}

async function carregarPremios() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from('premios')
    .select('*')
    .eq('ativo', true)
    .order('nome');

  if (error) {
    console.error('Erro ao carregar prêmios:', error);
    return;
  }

  if (data) {
    catalogoPremios = { comum: [], incomum: [], raro: [], epico: [], lendario: [] };
    data.forEach(p => {
      if (catalogoPremios[p.categoria]) {
        catalogoPremios[p.categoria].push({
          id: p.id,
          nome: p.nome,
          descricao: p.descricao,
          icone: p.icone,
          imagem_url: p.imagem_url,
          estoque: p.estoque,
          categoria: p.categoria
        });
      }
    });
  }
}

async function carregarResgates() {
  if (!supabaseClient || !usuarioAtual) return;

  const { data, error } = await supabaseClient
    .from('resgates')
    .select('*, premio:premio_id(*)')
    .eq('habbo_name', usuarioAtual.habboName)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar resgates:', error);
    return;
  }

  if (data) {
    usuarioAtual.historico = data.map(r => ({
      id: r.id,
      tipo: r.tipo_ovo,
      nomeOvo: configOvos[r.tipo_ovo]?.nome || r.tipo_ovo,
      emoji: configOvos[r.tipo_ovo]?.emoji || '🥚',
      codigo: r.codigo,
      pontos: r.pontos,
      premio: r.premio,
      data: r.created_at,
      status: r.status,
      descricao: r.descricao,
      comprovante_url: r.comprovante_url,
      ehTroca: false
    }));
  }

  if (isAdmin()) {
    const { data: todos, error: adminError } = await supabaseClient
      .from('resgates')
      .select('*, premio:premio_id(*)')
      .order('created_at', { ascending: false });

    if (adminError) {
      console.error('Erro ao carregar resgates admin:', adminError);
      return;
    }

    if (todos) {
      todosResgates = todos.map(r => ({
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
        data: r.created_at,
        status: r.status,
        descricao: r.descricao,
        comprovante_url: r.comprovante_url
      }));
    }
  }
}

async function carregarTrocas() {
  if (!supabaseClient || !usuarioAtual) return;

  const { data, error } = await supabaseClient
    .from('trocas_premios')
    .select('*')
    .eq('habbo_name', usuarioAtual.habboName)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar trocas:', error);
    return;
  }

  if (data) {
    const trocasFormatadas = data.map(t => ({
      id: t.id,
      tipo: 'troca',
      nomeOvo: 'Troca por Prêmio',
      emoji: '🎁',
      codigo: '-',
      pontos: -t.custo_pontos,
      premio: { nome: t.premio_nome, icone: '🎁' },
      data: t.created_at,
      status: t.status,
      descricao: `Troca de ${t.custo_pontos} pontos por ${t.premio_nome}`,
      comprovante_url: null,
      ehTroca: true
    }));

    const resgatesSemTrocas = usuarioAtual.historico.filter(h => !h.ehTroca);
    usuarioAtual.historico = [...resgatesSemTrocas, ...trocasFormatadas].sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  if (isAdmin()) {
    const { data: todas, error: adminError } = await supabaseClient
      .from('trocas_premios')
      .select('*')
      .order('created_at', { ascending: false });

    if (!adminError && todas) {
      todasTrocas = todas;
    }
  }
}

async function carregarCodigosStats() {
  if (!isAdmin() || !supabaseClient) return;

  const { data, error } = await supabaseClient
    .from('codigos_ovos')
    .select('tipo, usado');

  if (error) {
    console.error('Erro ao carregar stats dos códigos:', error);
    return;
  }

  codigosStats = {};
  if (data) {
    data.forEach(c => {
      if (!codigosStats[c.tipo]) {
        codigosStats[c.tipo] = { total: 0, usados: 0 };
      }
      codigosStats[c.tipo].total++;
      if (c.usado) codigosStats[c.tipo].usados++;
    });
  }
}

async function carregarTodosCodigos() {
  if (!isAdmin() || !supabaseClient) return;

  const { data, error } = await supabaseClient
    .from('codigos_ovos')
    .select('*, usuario:usado_por(forum_name, habbo_name)')
    .order('tipo', { ascending: true })
    .order('codigo', { ascending: true });

  if (error) {
    console.error('Erro ao carregar códigos:', error);
    return;
  }

  todosCodigosLista = data || [];
}

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

function getHabboHeadUrl(username, size = 's') {
  return `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&headonly=1&size=${size}`;
}

function getHabboFullBodyUrl(username, size = 'l') {
  return `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&size=${size}`;
}

function getAvatarHeadHtml(username, tamanho = '48px') {
  if (!username) return '<div style="font-size: 24px;">🐰</div>';
  return `<img src="${getHabboHeadUrl(username)}" 
        style="width: ${tamanho}; height: ${tamanho}; border-radius: 50%; object-fit: cover;" 
        onerror="this.onerror=null; this.parentElement.innerHTML='🐰';">`;
}

function getAvatarFullBodyHtml(username, tamanho = '120px') {
  if (!username) return '<div style="font-size: 40px;">🐰</div>';
  return `<img src="${getHabboFullBodyUrl(username)}" 
        style="height: ${tamanho}; width: auto; object-fit: contain;" 
        onerror="this.onerror=null; this.parentElement.innerHTML='🐰';">`;
}

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
  if (section === 'admin') {
    renderizarAdmin();
    if (abaAdminAtiva === 'codigos') {
      carregarTodosCodigos().then(() => filtrarListaCodigos());
    }
  }
  if (section === 'premios') renderizarPremios();
}

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
                ${ovo.chancePremio > 0 ? `<span class="guia-bonus"><i class="fa-solid fa-gift"></i> Chance de prêmio: ${Math.round(ovo.chancePremio * 100)}%</span>` : ''}
                ${ovo.premioGarantido ? `<span class="guia-bonus"><i class="fa-solid fa-trophy"></i> Prêmio Lendário Garantido!</span>` : ''}
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
  const categorias = [
    { id: 'comum', nome: 'Comum', cor: 'comum', icone: 'star' },
    { id: 'incomum', nome: 'Incomum', cor: 'incomum', icone: 'star-half' },
    { id: 'raro', nome: 'Raro', cor: 'raro', icone: 'gem' },
    { id: 'epico', nome: 'Épico', cor: 'epico', icone: 'crown' },
    { id: 'lendario', nome: 'Lendário', cor: 'lendario', icone: 'trophy' }
  ];

  let totalPremios = 0;
  const saldoAtual = usuarioAtual?.pontos || 0;

  const saldoEl = document.getElementById('saldoPontosLoja');
  if (saldoEl) saldoEl.textContent = saldoAtual;

  categorias.forEach(cat => {
    const container = document.getElementById(`premios${cat.nome}`);
    if (!container) return;

    const premios = catalogoPremios[cat.id] || [];
    totalPremios += premios.length;

    if (premios.length === 0) {
      container.innerHTML = '<p style="color: var(--text-tertiary); text-align: center; padding: 20px;">Nenhum prêmio disponível.</p>';
      return;
    }

    container.innerHTML = premios.map(p => {
      const custo = cat.id === 'comum' ? 50 : cat.id === 'incomum' ? 100 : cat.id === 'raro' ? 200 : cat.id === 'epico' ? 350 : 500;
      const podeComprar = saldoAtual >= custo && p.estoque > 0;

      const iconeDisplay = p.imagem_url ? 
        `<img src="${p.imagem_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` : 
        p.icone;

      return `
                <div class="premio-card ${cat.cor}" style="${!podeComprar ? 'opacity: 0.7;' : ''}">
                    <span class="premio-raridade">${cat.nome}</span>
                    <div class="premio-icon">${iconeDisplay}</div>
                    <h4 class="premio-nome">${p.nome}</h4>
                    <p class="premio-desc">${p.descricao || 'Sem descrição'}</p>
                    
                    <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin: 12px 0; text-align: center;">
                        <div style="font-size: 20px; font-weight: 800; color: var(--gold-dark);">
                            <i class="fa-solid fa-coins"></i> ${custo} pontos
                        </div>
                        <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">
                            Estoque: ${p.estoque} unidades
                        </div>
                    </div>

                    <button class="btn ${podeComprar ? 'btn-primary' : 'btn-secondary'}" 
                            style="width: 100%;" 
                            onclick="trocarPontosPorPremio('${p.id}', '${cat.id}', ${custo})"
                            ${!podeComprar ? 'disabled' : ''}>
                        ${podeComprar ? '<i class="fa-solid fa-exchange-alt"></i> Trocar Agora' :
          saldoAtual < custo ? '<i class="fa-solid fa-lock"></i> Pontos Insuficientes' : '<i class="fa-solid fa-lock"></i> Sem Estoque'}
                    </button>
                </div>
            `;
    }).join('');
  });

  const totalBadge = document.getElementById('totalPremios');
  if (totalBadge) totalBadge.textContent = `${totalPremios} prêmios`;
}

async function trocarPontosPorPremio(premioId, categoria, custo) {
  if (!usuarioAtual || usuarioAtual.pontos < custo) {
    showToast('Erro', 'Você não tem pontos suficientes!', 'error');
    return;
  }

  const premio = findPremioById(premioId);
  if (!premio || premio.estoque <= 0) {
    showToast('Erro', 'Este prêmio está esgotado!', 'error');
    return;
  }

  if (!confirm(`Deseja trocar ${custo} pontos por: ${premio.nome}?\n\nSeu saldo atual: ${usuarioAtual.pontos} pontos\nSaldo após a troca: ${usuarioAtual.pontos - custo} pontos`)) {
    return;
  }

  const { data: trocaData, error: trocaError } = await supabaseClient
    .from('trocas_premios')
    .insert([{
      usuario_id: usuarioAtual.id,
      habbo_name: usuarioAtual.habboName,
      forum_name: usuarioAtual.forumName,
      premio_id: premioId,
      premio_nome: premio.nome,
      custo_pontos: custo,
      status: 'pendente'
    }])
    .select()
    .single();

  if (trocaError) {
    showToast('Erro', trocaError.message, 'error');
    return;
  }

  const { error: pontosError } = await supabaseClient
    .from('usuarios')
    .update({ pontos: usuarioAtual.pontos - custo })
    .eq('id', usuarioAtual.id);

  if (pontosError) {
    showToast('Erro', 'Erro ao debitar pontos: ' + pontosError.message, 'error');
    return;
  }

  await supabaseClient.rpc('decrementar_estoque', { premio_id: premioId });

  usuarioAtual.pontos -= custo;
  premio.estoque--;

  showToast('Troca Realizada!', `Você trocou ${custo} pontos por ${premio.nome}. Aguarde a entrega no Habbo!`, 'success');
  renderizarPremios();
  atualizarStats();
  renderizarMeusResgates();
}

function renderizarMeusResgates() {
  if (!usuarioAtual) return;

  const ultimosContainer = document.getElementById('meusUltimosResgates');
  const ultimos = usuarioAtual.historico?.slice(0, 5) || [];

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
      ultimosContainer.innerHTML = ultimos.map(h => {
        const isTroca = h.ehTroca || h.tipo === 'troca';
        return `
                <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-white); border-radius: 12px; margin-bottom: 12px; border: 1px solid var(--border-light); border-left: 4px solid ${h.status === 'aprovado' ? (isTroca ? 'var(--primary)' : 'var(--success)') : h.status === 'pendente' ? 'var(--warning)' : 'var(--danger)'};">
                    <div style="font-size: 40px;">${isTroca ? '🎁' : h.emoji}</div>
                    <div style="flex: 1;">
                        <h4 style="margin-bottom: 4px;">${h.nomeOvo}</h4>
                        <p style="font-size: 13px; color: var(--text-tertiary);">${new Date(h.data).toLocaleDateString('pt-BR')} • ${isTroca ? '' : '+'}${h.pontos} pts</p>
                        <span class="status-badge status-${h.status}" style="margin-top: 4px; display: inline-flex;">
                            <i class="fa-solid fa-${h.status === 'aprovado' ? 'check' : h.status === 'pendente' ? 'clock' : 'xmark'}"></i> 
                            ${h.status === 'aprovado' ? 'Aprovado' : h.status === 'pendente' ? 'Pendente' : 'Rejeitado'}
                        </span>
                    </div>
                    ${h.premio && !isTroca ? `<div style="font-size: 24px;" title="${h.premio.nome}">${h.premio.icone || '🎁'}</div>` : ''}
                </div>
            `;
      }).join('');
    }
  }

  const historicoContainer = document.getElementById('meuHistoricoCompleto');
  if (historicoContainer) {
    historicoContainer.innerHTML = !usuarioAtual.historico || usuarioAtual.historico.length === 0 ?
      `<div class="empty-state"><i class="fa-solid fa-basket-shopping" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i><h3>Nenhum resgate ainda</h3><p>Comece a caçar ovos!</p></div>` :
      usuarioAtual.historico.map(h => {
        const isTroca = h.ehTroca || h.tipo === 'troca';
        const corTipo = isTroca ? 'var(--primary)' : (configOvos[h.tipo]?.cor === 'gradient' ? '#f59e0b' : configOvos[h.tipo]?.cor || '#ccc');
        
        return `
                <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-white); border-radius: 12px; margin-bottom: 12px; border-left: 4px solid ${h.status === 'aprovado' ? corTipo : h.status === 'pendente' ? 'var(--warning)' : 'var(--danger)'};">
                    <div style="font-size: 40px;">${isTroca ? '🎁' : h.emoji}</div>
                    <div style="flex: 1;">
                        <h4 style="margin-bottom: 4px;">${h.nomeOvo}</h4>
                        <p style="font-size: 13px; color: var(--text-tertiary); margin-bottom: 4px;">${new Date(h.data).toLocaleDateString('pt-BR')} às ${new Date(h.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        ${!isTroca ? `<p style="font-size: 12px; color: var(--text-tertiary);"><i class="fa-solid fa-hashtag"></i> ${h.codigo}</p>` : ''}
                        <span class="status-badge status-${h.status}" style="margin-top: 8px; display: inline-flex;">
                            <i class="fa-solid fa-${h.status === 'aprovado' ? 'check' : h.status === 'pendente' ? 'clock' : 'xmark'}"></i> 
                            ${h.status === 'aprovado' ? 'Aprovado' : h.status === 'pendente' ? 'Aguardando Aprovação' : 'Rejeitado'}
                        </span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 20px; font-weight: 800; color: ${h.status === 'aprovado' ? (isTroca ? 'var(--danger)' : 'var(--gold-dark)') : 'var(--text-tertiary)'};">${isTroca ? '' : '+'}${h.pontos}</div>
                        ${h.premio && !isTroca ? `<div style="font-size: 24px; margin-top: 4px;" title="${h.premio.nome}">${h.premio.icone || '🎁'}</div>` : ''}
                    </div>
                </div>
            `;
      }).join('');
  }

  const ovosAprovados = usuarioAtual.historico?.filter(h => h.status === 'aprovado' && !h.ehTroca) || [];
  const trocasAprovadas = usuarioAtual.historico?.filter(h => h.status === 'aprovado' && h.ehTroca) || [];
  const pontosAprovados = ovosAprovados.reduce((sum, h) => sum + h.pontos, 0);
  const premiosAprovados = ovosAprovados.filter(h => h.premio).length;

  const elPontos = document.getElementById('meusPontosTotal');
  const elOvos = document.getElementById('meusOvosTotal');
  const elPremios = document.getElementById('meusPremiosTotal');

  if (elPontos) elPontos.textContent = pontosAprovados;
  if (elOvos) elOvos.textContent = ovosAprovados.length;
  if (elPremios) elPremios.textContent = premiosAprovados + trocasAprovadas.length;
}

function atualizarStats() {
  if (!usuarioAtual) return;

  const ovosAprovados = usuarioAtual.historico?.filter(h => h.status === 'aprovado' && !h.ehTroca) || [];
  const pontosAprovados = ovosAprovados.reduce((sum, h) => sum + h.pontos, 0);
  const premiosAprovados = ovosAprovados.filter(h => h.premio).length;

  const elPoints = document.getElementById('userPoints');
  const elOvos = document.getElementById('userTotalOvos');
  const elPremios = document.getElementById('userTotalPremios');

  if (elPoints) elPoints.textContent = pontosAprovados;
  if (elOvos) elOvos.textContent = ovosAprovados.length;
  if (elPremios) elPremios.textContent = premiosAprovados;
}

function renderizarRanking() {
  if (!membros.length) return;

  const jogadores = membros.map(m => {
    const souEu = usuarioAtual && (m.nick === usuarioAtual.habboName || m.nick === usuarioAtual.forumName);
    const meusDados = souEu ? usuarioAtual : null;

    return {
      nome: m.nick,
      habboName: m.nick,
      pontos: meusDados?.pontos || Math.floor(Math.random() * 500),
      ovos: meusDados ? Object.values(meusDados.ovosResgatados || {}).reduce((a, b) => a + b, 0) : Math.floor(Math.random() * 15),
      souEu: souEu
    };
  });

  const ordenarPor = tipoRankingAtual === 'pontos' ? 'pontos' : 'ovos';
  jogadores.sort((a, b) => b[ordenarPor] - a[ordenarPor]);

  const podium = jogadores.slice(0, 3);
  const podiumContainer = document.getElementById('podiumTop3');

  if (podiumContainer && podium.length >= 3) {
    const iconesPodium = { 1: 'fa-crown', 2: 'fa-medal', 3: 'fa-award' };

    podiumContainer.innerHTML = `
            <div class="podium-item pos-2">
                <div class="podium-avatar-wrapper">
                    <div class="podium-badge"><i class="fa-solid ${iconesPodium[2]}"></i></div>
                    <div class="podium-avatar-container">${getAvatarFullBodyHtml(podium[1]?.habboName, '140px')}</div>
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
                    <div class="podium-avatar-container">${getAvatarFullBodyHtml(podium[0]?.habboName, '170px')}</div>
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
                    <div class="podium-avatar-container">${getAvatarFullBodyHtml(podium[2]?.habboName, '140px')}</div>
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

async function iniciarResgateCodigo() {
  const input = document.getElementById('codigoInput');
  const codigo = input?.value?.trim();

  if (!codigo) {
    showToast('Erro', 'Digite um código válido!', 'error');
    return;
  }

  const verificacao = await verificarCodigoNoSupabase(codigo);

  if (!verificacao.valido) {
    showToast('Código Inválido', verificacao.motivo, 'error');
    input.value = '';
    return;
  }

  const config = configOvos[verificacao.tipo];

  const limiteCheck = await verificarLimiteUsuario(verificacao.tipo);
  if (!limiteCheck.permitido) {
    showToast('Limite Atingido', limiteCheck.motivo, 'error');
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

async function verificarLimiteUsuario(tipo) {
  const config = configOvos[tipo];

  if (tipo === 'coelhao') {
    const { data: coelhaoResgatado, error } = await supabaseClient
      .from('resgates')
      .select('id')
      .eq('tipo_ovo', 'coelhao')
      .eq('status', 'aprovado')
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar coelhão:', error);
    }

    if (coelhaoResgatado) {
      return { permitido: false, motivo: 'Você já atingiu o limite de resgates' };
    }
  }

  if (config.limitePorUsuario !== Infinity) {
    const { count, error } = await supabaseClient
      .from('resgates')
      .select('*', { count: 'exact', head: true })
      .eq('habbo_name', usuarioAtual.habboName)
      .eq('tipo_ovo', tipo)
      .eq('status', 'aprovado');

    if (error) {
      console.error('Erro ao verificar limite:', error);
    }

    if (count >= config.limitePorUsuario) {
      return {
        permitido: false,
        motivo: `Você já atingiu o limite de resgates`
      };
    }
  }

  return { permitido: true };
}

function abrirComprovacaoModal() {
  if (!resgatePendente) return;

  const config = resgatePendente.config;

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
                        <i class="fa-solid fa-trophy"></i> Prêmio Lendário Garantido!
                    </p>
                ` : ''}
            </div>
        `;
  }

  const modal = document.getElementById('comprovacaoModal');
  if (modal) modal.classList.add('active');

  const linkInput = document.getElementById('comprovacaoLink');
  if (linkInput) {
    linkInput.removeEventListener('input', atualizarPreviewLink);
    linkInput.addEventListener('input', atualizarPreviewLink);
  }
}

function atualizarPreviewLink() {
  const linkInput = document.getElementById('comprovacaoLink');
  const previewDiv = document.getElementById('linkPreview');
  const previewImg = document.getElementById('previewImageLink');

  const url = linkInput?.value?.trim();

  if (url && isValidImageUrl(url)) {
    previewImg.src = url;
    previewImg.onload = function () {
      previewDiv.style.display = 'block';
    };
    previewImg.onerror = function () {
      previewDiv.style.display = 'none';
    };
  } else {
    previewDiv.style.display = 'none';
  }
}

function isValidImageUrl(url) {
  return url.match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null ||
    url.includes('imgur.com') ||
    url.includes('prnt.sc') ||
    url.includes('lightshot');
}

function fecharComprovacaoModal() {
  const modal = document.getElementById('comprovacaoModal');
  if (modal) modal.classList.remove('active');

  const form = document.getElementById('formComprovacao');
  if (form) form.reset();

  const previewDiv = document.getElementById('linkPreview');
  if (previewDiv) previewDiv.style.display = 'none';

  const linkInput = document.getElementById('comprovacaoLink');
  if (linkInput) {
    linkInput.removeEventListener('input', atualizarPreviewLink);
  }

  resgatePendente = null;
}

async function confirmarComprovacao(e) {
  e.preventDefault();
  if (!resgatePendente || !usuarioAtual) return;

  const linkComprovacao = document.getElementById('comprovacaoLink')?.value?.trim();
  const descricao = document.getElementById('comprovacaoDesc')?.value?.trim();
  const config = resgatePendente.config;

  if (!linkComprovacao) {
    showToast('Erro', 'O link de comprovação é obrigatório!', 'error');
    return;
  }

  try {
    new URL(linkComprovacao);
  } catch {
    showToast('Erro', 'Por favor, insira um link válido!', 'error');
    return;
  }

  let premioGanho = null;
  let premioId = null;

  if (config.premioGarantido) {
    const disponiveis = catalogoPremios.lendario.filter(p => p.estoque > 0);
    if (disponiveis.length > 0) {
      premioGanho = disponiveis[0];
      premioId = premioGanho.id;
    }
  } else if (config.chancePremio > 0 && Math.random() < config.chancePremio) {
    const cat = config.id === 'lendario' ? 'lendario' : config.id === 'epico' ? 'epico' : 'raro';
    const disponiveis = catalogoPremios[cat].filter(p => p.estoque > 0);
    if (disponiveis.length > 0) {
      premioGanho = disponiveis[Math.floor(Math.random() * disponiveis.length)];
      premioId = premioGanho.id;
    }
  }

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
      comprovante_url: linkComprovacao,
      status: 'pendente'
    }])
    .select()
    .single();

  if (error) {
    showToast('Erro', 'Falha ao salvar: ' + error.message, 'error');
    return;
  }

  await supabaseClient
    .from('codigos_ovos')
    .update({ usado: true, usado_por: usuarioAtual.id, usado_em: new Date().toISOString() })
    .eq('id', resgatePendente.codigoId);

  usuarioAtual.historico.unshift({
    id: resgateData.id,
    tipo: resgatePendente.tipo,
    nomeOvo: config.nome,
    emoji: config.emoji,
    codigo: resgatePendente.codigo,
    pontos: config.pontos,
    premio: premioGanho,
    data: resgateData.created_at,
    status: 'pendente',
    comprovante_url: linkComprovacao,
    ehTroca: false
  });

  fecharComprovacaoModal();
  const input = document.getElementById('codigoInput');
  if (input) input.value = '';

  showToast('Sucesso!', 'Resgate enviado para aprovação.', 'success');
  renderizarMeusResgates();
}

function fecharResultadoModal() {
  const modal = document.getElementById('resultadoModal');
  if (modal) modal.classList.remove('active');
}

function isAdmin() {
  return usuarioAtual?.grupoPermissao === 'admin';
}

function renderizarAdmin() {
  if (!isAdmin()) {
    const content = document.getElementById('adminContent');
    if (content) {
      content.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-lock" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <h3>Acesso Restrito</h3>
                    <p>Apenas administradores podem acessar esta área.</p>
                </div>
            `;
    }
    return;
  }

  const container = document.getElementById('adminContent');
  if (!container) return;

  container.innerHTML = `
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
        </div>
        <div id="adminAbaContent"></div>
    `;

  renderizarAbaAdmin();
}

function mudarAbaAdmin(aba) {
  abaAdminAtiva = aba;
  renderizarAdmin();
  
  if (aba === 'codigos') {
    carregarTodosCodigos().then(() => {
      filtrarListaCodigos();
    });
  }
}

function renderizarAbaAdmin() {
  const content = document.getElementById('adminAbaContent');
  if (!content) return;

  switch (abaAdminAtiva) {
    case 'resgates':
      content.innerHTML = renderizarAbaResgates();
      break;
    case 'premios':
      content.innerHTML = renderizarAbaPremios();
      break;
    case 'codigos':
      content.innerHTML = renderizarAbaCodigos();
      break;
  }
}

function renderizarAbaResgates() {
  const pendentes = todosResgates.filter(r => r.status === 'pendente');

  return `
        <div class="panel">
            <div class="panel-header">
                <div class="panel-title">
                    <i class="fa-solid fa-clock"></i> Resgates Pendentes (${pendentes.length})
                </div>
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
                                <th>Comprovação</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendentes.length === 0 ? `
                                <tr><td colspan="6" style="text-align: center; padding: 40px;">
                                    <div class="empty-state">
                                        <i class="fa-solid fa-check-circle" style="font-size: 48px; color: var(--success);"></i>
                                        <h3>Tudo em ordem!</h3>
                                        <p>Nenhum resgate pendente.</p>
                                    </div>
                                </td></tr>
                            ` : pendentes.map(r => `
                                <tr>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden;">
                                                ${getAvatarHeadHtml(r.habboName, '32px')}
                                            </div>
                                            <div>
                                                <div style="font-weight: 600; font-size: 13px;">${r.forumName}</div>
                                                <div style="font-size: 11px; color: var(--text-tertiary);">${r.habboName}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span style="font-size: 20px;">${r.emoji}</span> ${r.nomeOvo}</td>
                                    <td><code style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px;">${r.codigo}</code></td>
                                    <td>
                                        <span style="color: var(--gold-dark); font-weight: 700;"><i class="fa-solid fa-coins"></i> ${r.pontos}</span>
                                        ${r.premio ? `<br><span style="font-size: 16px;">${r.premio.icone || '🎁'} ${r.premio.nome}</span>` : ''}
                                    </td>
                                    <td>
                                        ${r.comprovante_url ? `
                                            <a href="${r.comprovante_url}" target="_blank" class="btn btn-sm btn-primary" style="text-decoration: none;">
                                                <i class="fa-solid fa-image"></i> Ver Print
                                            </a>
                                        ` : '<span style="color: var(--text-tertiary); font-size: 12px;">Sem link</span>'}
                                    </td>
                                    <td>
                                        <div class="action-btns">
                                            <button class="btn-icon btn-view" onclick="verDetalhesResgate('${r.id}')" title="Ver detalhes completos"><i class="fa-solid fa-eye"></i></button>
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

function renderizarAbaPremios() {
  const categorias = ['comum', 'incomum', 'raro', 'epico', 'lendario'];

  return `
        <div style="display: grid; gap: 20px;">
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
                                    ${categorias.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">URL da Imagem *</label>
                                <input type="url" class="form-input" id="novoPremioImagem" required placeholder="https://i.imgur.com/imagem.png">
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

            ${categorias.map(cat => `
                <div class="panel">
                    <div class="panel-header">
                        <div class="panel-title">
                            <i class="fa-solid fa-${cat === 'comum' ? 'star' : cat === 'incomum' ? 'star-half' : cat === 'raro' ? 'gem' : cat === 'epico' ? 'crown' : 'trophy'}"></i>
                            Prêmios ${cat.charAt(0).toUpperCase() + cat.slice(1)}
                            <span class="panel-badge">${catalogoPremios[cat]?.length || 0}</span>
                        </div>
                    </div>
                    <div class="panel-content">
                        ${!catalogoPremios[cat] || catalogoPremios[cat].length === 0 ?
      '<p style="color: var(--text-tertiary);">Nenhum prêmio nesta categoria.</p>' :
      `<div style="display: grid; gap: 12px;">
                                ${catalogoPremios[cat].map(p => `
                                    <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-white); border-radius: 12px; border: 1px solid var(--border-light);">
                                        <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; flex-shrink: 0;">
                                            ${p.imagem_url ? 
          `<img src="${p.imagem_url}" style="width: 100%; height: 100%; object-fit: cover;">` : 
          `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 32px; background: var(--bg-secondary);">${p.icone || '🎁'}</div>`
        }
                                        </div>
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
                                                <button class="btn-icon" onclick="ajustarEstoque('${p.id}', 1)" title="Aumentar" style="background: var(--success); color: white; width: 32px; height: 32px;">
                                                    <i class="fa-solid fa-plus"></i>
                                                </button>
                                                <button class="btn-icon" onclick="ajustarEstoque('${p.id}', -1)" title="Diminuir" style="background: var(--warning); color: white; width: 32px; height: 32px;">
                                                    <i class="fa-solid fa-minus"></i>
                                                </button>
                                            </div>
                                            <button class="btn btn-sm btn-danger" onclick="removerPremio('${p.id}')" style="font-size: 11px; padding: 4px 8px;">
                                                <i class="fa-solid fa-trash"></i> Remover
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>`
    }
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderizarAbaCodigos() {
  return `
        <div style="display: grid; gap: 20px;">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <i class="fa-solid fa-chart-pie"></i> Estatísticas dos Códigos
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="abrirModalNovoCodigo()">
                        <i class="fa-solid fa-plus"></i> Gerar Códigos
                    </button>
                </div>
                <div class="panel-content">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 20px;">
                        ${Object.entries(configOvos).map(([key, ovo]) => {
    const stats = codigosStats[key] || { total: 0, usados: 0 };
    const disponiveis = stats.total - stats.usados;
    const percentual = stats.total > 0 ? Math.round((stats.usados / stats.total) * 100) : 0;

    return `
                                <div style="background: var(--bg-white); padding: 20px; border-radius: 12px; border-left: 4px solid ${ovo.cor === 'gradient' ? '#f59e0b' : ovo.cor};">
                                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                        <span style="font-size: 32px;">${ovo.emoji}</span>
                                        <div>
                                            <h4 style="color: ${ovo.cor === 'gradient' ? '#f59e0b' : ovo.cor}; margin: 0;">${ovo.nome}</h4>
                                            <p style="font-size: 12px; color: var(--text-tertiary); margin: 0;">${ovo.pontos} pontos</p>
                                        </div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
                                        <span>Total: <strong>${stats.total}</strong></span>
                                        <span style="color: var(--success);">Disp.: <strong>${disponiveis}</strong></span>
                                        <span style="color: var(--danger);">Usados: <strong>${stats.usados}</strong></span>
                                    </div>
                                    <div style="width: 100%; height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden;">
                                        <div style="width: ${percentual}%; height: 100%; background: ${ovo.cor === 'gradient' ? 'linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)' : ovo.cor}; transition: width 0.3s;"></div>
                                    </div>
                                    <div style="font-size: 11px; color: var(--text-tertiary); text-align: center; margin-top: 4px;">${percentual}% utilizado</div>
                                </div>
                            `;
  }).join('')}
                    </div>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">
                        <i class="fa-solid fa-list"></i> Lista de Códigos
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <select class="filter-select" id="filtroTipoCodigo" onchange="filtrarListaCodigos()" style="width: auto; min-width: 150px;">
                            <option value="todos">Todos os tipos</option>
                            ${Object.entries(configOvos).map(([key, ovo]) => `<option value="${key}">${ovo.nome}</option>`).join('')}
                        </select>
                        <select class="filter-select" id="filtroStatusCodigo" onchange="filtrarListaCodigos()" style="width: auto; min-width: 120px;">
                            <option value="todos">Todos</option>
                            <option value="disponivel">Disponíveis</option>
                            <option value="usado">Usados</option>
                        </select>
                        <button class="btn btn-secondary btn-sm" onclick="exportarCodigos()">
                            <i class="fa-solid fa-download"></i> Exportar
                        </button>
                    </div>
                </div>
                <div class="panel-content">
                    <div id="listaCodigosContainer" style="max-height: 600px; overflow-y: auto;">
                        <p style="color: var(--text-tertiary); text-align: center; padding: 40px;">
                            <i class="fa-solid fa-spinner fa-spin"></i> Carregando códigos...
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function filtrarListaCodigos() {
  const container = document.getElementById('listaCodigosContainer');
  if (!container) return;

  const filtroTipo = document.getElementById('filtroTipoCodigo')?.value || 'todos';
  const filtroStatus = document.getElementById('filtroStatusCodigo')?.value || 'todos';

  let codigosFiltrados = todosCodigosLista;

  if (filtroTipo !== 'todos') {
    codigosFiltrados = codigosFiltrados.filter(c => c.tipo === filtroTipo);
  }

  if (filtroStatus === 'disponivel') {
    codigosFiltrados = codigosFiltrados.filter(c => !c.usado);
  } else if (filtroStatus === 'usado') {
    codigosFiltrados = codigosFiltrados.filter(c => c.usado);
  }

  if (codigosFiltrados.length === 0) {
    container.innerHTML = `
            <div class="empty-state" style="padding: 40px;">
                <i class="fa-solid fa-inbox" style="font-size: 48px; opacity: 0.3;"></i>
                <h3>Nenhum código encontrado</h3>
                <p>Tente ajustar os filtros ou gere novos códigos.</p>
            </div>
        `;
    return;
  }

  container.innerHTML = `
        <div style="display: grid; gap: 8px;">
            ${codigosFiltrados.map(c => {
    const config = configOvos[c.tipo];
    return `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-white); border-radius: 8px; border: 1px solid var(--border-light); ${c.usado ? 'opacity: 0.6;' : ''}">
                        <span style="font-size: 24px;">${config?.emoji || '🥚'}</span>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <code style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-size: 14px; font-weight: 600; letter-spacing: 1px;">${c.codigo}</code>
                                <span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: ${config?.cor === 'gradient' ? 'linear-gradient(90deg, #ff6b6b, #feca57)' : config?.cor}; color: white; font-weight: 600;">
                                    ${config?.nome || c.tipo}
                                </span>
                                ${c.usado ? '<span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--danger); color: white; font-weight: 600;"><i class="fa-solid fa-check"></i> USADO</span>' : '<span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--success); color: white; font-weight: 600;"><i class="fa-solid fa-unlock"></i> DISPONÍVEL</span>'}
                            </div>
                            ${c.usado ? `
                                <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">
                                    <i class="fa-solid fa-user"></i> Usado por: <strong>${c.usuario?.habbo_name || 'Desconhecido'}</strong> 
                                    <span style="margin: 0 8px;">•</span>
                                    <i class="fa-solid fa-calendar"></i> ${new Date(c.usado_em).toLocaleDateString('pt-BR')} às ${new Date(c.usado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            ` : ''}
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn-icon btn-view" onclick="copiarCodigo('${c.codigo}')" title="Copiar código">
                                <i class="fa-solid fa-copy"></i>
                            </button>
                            ${!c.usado ? `
                                <button class="btn-icon btn-reject" onclick="excluirCodigo('${c.id}', '${c.codigo}')" title="Excluir código">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
  }).join('')}
        </div>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-light); text-align: center; color: var(--text-tertiary); font-size: 13px;">
            Mostrando ${codigosFiltrados.length} de ${todosCodigosLista.length} códigos
        </div>
    `;
}

function copiarCodigo(codigo) {
  navigator.clipboard.writeText(codigo).then(() => {
    showToast('Copiado!', `Código ${codigo} copiado para a área de transferência.`, 'success');
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = codigo;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Copiado!', `Código ${codigo} copiado.`, 'success');
  });
}

async function excluirCodigo(id, codigo) {
  if (!confirm(`Tem certeza que deseja excluir o código ${codigo}?\nEsta ação não pode ser desfeita.`)) return;

  const { error } = await supabaseClient
    .from('codigos_ovos')
    .delete()
    .eq('id', id);

  if (error) {
    showToast('Erro', error.message, 'error');
    return;
  }

  showToast('Excluído!', 'Código removido com sucesso.', 'success');
  await carregarTodosCodigos();
  await carregarCodigosStats();
  filtrarListaCodigos();
}

function exportarCodigos() {
  const filtroTipo = document.getElementById('filtroTipoCodigo')?.value || 'todos';
  const filtroStatus = document.getElementById('filtroStatusCodigo')?.value || 'todos';

  let codigosExportar = todosCodigosLista;

  if (filtroTipo !== 'todos') {
    codigosExportar = codigosExportar.filter(c => c.tipo === filtroTipo);
  }
  if (filtroStatus === 'disponivel') {
    codigosExportar = codigosExportar.filter(c => !c.usado);
  } else if (filtroStatus === 'usado') {
    codigosExportar = codigosExportar.filter(c => c.usado);
  }

  let csv = 'Código,Tipo,Status,Usado Por,Data Uso\n';
  codigosExportar.forEach(c => {
    const config = configOvos[c.tipo];
    csv += `"${c.codigo}","${config?.nome || c.tipo}","${c.usado ? 'Usado' : 'Disponível'}","${c.usuario?.habbo_name || '-'}","${c.usado_em ? new Date(c.usado_em).toLocaleString('pt-BR') : '-'}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `codigos-pascoa-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();

  showToast('Exportado!', `${codigosExportar.length} códigos exportados.`, 'success');
}

async function adicionarNovoPremio(e) {
  e.preventDefault();

  const nome = document.getElementById('novoPremioNome')?.value;
  const categoria = document.getElementById('novoPremioCategoria')?.value;
  const imagem_url = document.getElementById('novoPremioImagem')?.value;
  const estoque = parseInt(document.getElementById('novoPremioEstoque')?.value);
  const descricao = document.getElementById('novoPremioDescricao')?.value;

  const { data, error } = await supabaseClient
    .from('premios')
    .insert([{ nome, categoria, icone: '🎁', imagem_url, estoque, descricao, ativo: true }])
    .select()
    .single();

  if (error) {
    showToast('Erro', error.message, 'error');
    return;
  }

  catalogoPremios[categoria].push({
    id: data.id, nome, descricao, icone: '🎁', imagem_url, estoque, categoria
  });

  showToast('Sucesso!', 'Prêmio adicionado!', 'success');
  e.target.reset();
  renderizarAbaAdmin();
  renderizarPremios();
}

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
  renderizarPremios();
  showToast('Estoque Atualizado', `Novo estoque: ${novoEstoque}`, 'success');
}

async function removerPremio(premioId) {
  if (!confirm('Tem certeza que deseja remover este prêmio?')) return;

  await supabaseClient
    .from('premios')
    .update({ ativo: false })
    .eq('id', premioId);

  for (const cat in catalogoPremios) {
    const idx = catalogoPremios[cat].findIndex(p => p.id === premioId);
    if (idx !== -1) {
      catalogoPremios[cat].splice(idx, 1);
      break;
    }
  }

  renderizarAbaAdmin();
  renderizarPremios();
  showToast('Prêmio Removido', 'O prêmio foi desativado.', 'success');
}

async function aprovarResgate(id) {
  const resgate = todosResgates.find(r => r.id === id);
  if (!resgate) return;

  await supabaseClient
    .from('resgates')
    .update({ status: 'aprovado', aprovado_em: new Date().toISOString() })
    .eq('id', id);

  await supabaseClient.rpc('adicionar_pontos_usuario', {
    p_habbo_name: resgate.habboName,
    p_pontos: resgate.pontos
  });

  if (resgate.premio) {
    await supabaseClient.rpc('decrementar_estoque', { premio_id: resgate.premio.id });
    const p = findPremioById(resgate.premio.id);
    if (p) p.estoque--;
  }

  resgate.status = 'aprovado';
  renderizarAbaAdmin();
  atualizarStats();
  renderizarMeusResgates();
  renderizarPremios();
  showToast('Aprovado!', 'Resgate aprovado com sucesso.', 'success');
}

async function rejeitarResgate(id) {
  const resgate = todosResgates.find(r => r.id === id);
  if (!resgate) return;

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

  await supabaseClient
    .from('codigos_ovos')
    .update({ usado: false, usado_por: null, usado_em: null })
    .eq('codigo', resgate.codigo);

  resgate.status = 'rejeitado';
  renderizarAbaAdmin();
  showToast('Rejeitado', 'Resgate rejeitado e código liberado.', 'error');
}

function verDetalhesResgate(id) {
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
            <h4 style="margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: var(--text-tertiary);">Informações</h4>
            <div style="display: grid; gap: 8px; font-size: 14px;">
                <div style="display: flex; justify-content: space-between;"><span>Habbo:</span> <strong>${resgate.habboName}</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Fórum:</span> <strong>${resgate.forumName}</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Data:</span> <strong>${new Date(resgate.data).toLocaleString('pt-BR')}</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Status:</span> <span class="status-badge status-${resgate.status}">${resgate.status}</span></div>
                <div style="display: flex; justify-content: space-between;"><span>Pontos:</span> <strong style="color: var(--gold-dark);">+${resgate.pontos}</strong></div>
                ${resgate.premio ? `<div style="display: flex; justify-content: space-between;"><span>Prêmio:</span> <span>${resgate.premio.icone || '🎁'} ${resgate.premio.nome}</span></div>` : ''}
            </div>
        </div>

        ${resgate.comprovante_url ? `
            <div style="background: linear-gradient(135deg, var(--primary-light), var(--primary)); padding: 20px; border-radius: 12px; margin-bottom: 16px; color: white;">
                <h4 style="margin-bottom: 12px; font-size: 14px; text-transform: uppercase; opacity: 0.9;">
                    <i class="fa-solid fa-camera"></i> Comprovação (Print)
                </h4>
                <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-bottom: 12px; word-break: break-all; font-family: monospace; font-size: 13px;">
                    ${resgate.comprovante_url}
                </div>
                <div style="display: flex; gap: 8px;">
                    <a href="${resgate.comprovante_url}" target="_blank" class="btn btn-primary" style="flex: 1; background: white; color: var(--primary); text-decoration: none;">
                        <i class="fa-solid fa-external-link-alt"></i> Abrir Link
                    </a>
                    <button class="btn btn-secondary" style="flex: 1; background: rgba(255,255,255,0.3); color: white; border: none;" onclick="copiarTexto('${resgate.comprovante_url}')">
                        <i class="fa-solid fa-copy"></i> Copiar Link
                    </button>
                </div>
                <div style="margin-top: 12px; text-align: center;">
                    <img src="${resgate.comprovante_url}" 
                         style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); background: white;" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
                         alt="Preview da comprovação">
                    <p style="display: none; font-size: 12px; opacity: 0.8; margin-top: 8px;">
                        <i class="fa-solid fa-exclamation-triangle"></i> Não foi possível carregar a prévia, mas o link está válido.
                    </p>
                </div>
            </div>
        ` : `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 16px; text-align: center; color: var(--text-tertiary);">
                <i class="fa-solid fa-image" style="font-size: 32px; margin-bottom: 8px; opacity: 0.5;"></i>
                <p>Sem link de comprovação</p>
            </div>
        `}

        ${resgate.descricao ? `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                <h4 style="margin-bottom: 8px; font-size: 14px; text-transform: uppercase; color: var(--text-tertiary);">Descrição do Usuário</h4>
                <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">${resgate.descricao}</p>
            </div>
        ` : ''}

        <div style="display: flex; gap: 12px;">
            <button class="btn btn-secondary" style="flex: 1;" onclick="fecharViewModal()">Fechar</button>
            ${resgate.status === 'pendente' ? `
                <button class="btn btn-success" style="flex: 1;" onclick="aprovarResgate('${resgate.id}'); fecharViewModal();"><i class="fa-solid fa-check"></i> Aprovar</button>
                <button class="btn btn-danger" style="flex: 1;" onclick="rejeitarResgate('${resgate.id}'); fecharViewModal();"><i class="fa-solid fa-xmark"></i> Rejeitar</button>
            ` : ''}
        </div>
    `;

  document.getElementById('viewModal')?.classList.add('active');
}

function copiarTexto(texto) {
  navigator.clipboard.writeText(texto).then(() => {
    showToast('Copiado!', 'Link copiado para a área de transferência.', 'success');
  });
}

function fecharViewModal() {
  document.getElementById('viewModal')?.classList.remove('active');
}

function abrirModalNovoCodigo() {
  document.getElementById('codigoModal')?.classList.add('active');
}

function fecharCodigoModal() {
  document.getElementById('codigoModal')?.classList.remove('active');
  document.getElementById('formCodigo')?.reset();
}

async function gerarCodigos(e) {
  e.preventDefault();

  const tipo = document.getElementById('codigoTipo')?.value;
  const quantidade = parseInt(document.getElementById('codigoQuantidade')?.value);

  const novosCodigos = [];
  for (let i = 0; i < quantidade; i++) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    novosCodigos.push({
      codigo: `SRC-${tipo.toUpperCase()}-${random}`,
      tipo: tipo
    });
  }

  const { error } = await supabaseClient
    .from('codigos_ovos')
    .insert(novosCodigos);

  if (error) {
    showToast('Erro', error.message, 'error');
    return;
  }

  showToast('Sucesso!', `${quantidade} códigos gerados!`, 'success');
  fecharCodigoModal();
  await carregarCodigosStats();
  await carregarTodosCodigos();
  filtrarListaCodigos();
}

function findPremioById(id) {
  for (const cat in catalogoPremios) {
    const p = catalogoPremios[cat].find(x => x.id === id);
    if (p) return p;
  }
  return null;
}

function showToast(title, message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.className = `toast ${type}`;

  const titleEl = document.getElementById('toastTitle');
  const msgEl = document.getElementById('toastMessage');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;

  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function iniciarSubscriptions() {
  if (!supabaseClient || !usuarioAtual) return;

  subscriptions.forEach(sub => {
    if (sub && typeof sub.unsubscribe === 'function') {
      sub.unsubscribe();
    }
  });
  subscriptions = [];

  const resgatesSubscription = supabaseClient
    .channel('resgates-usuario')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'resgates',
      filter: `habbo_name=eq.${usuarioAtual.habboName}`
    }, (payload) => {
      handleResgateChange(payload);
    })
    .subscribe((status) => {
      console.log('Subscription resgates-usuario:', status);
    });

  subscriptions.push(resgatesSubscription);

  const pontosSubscription = supabaseClient
    .channel('pontos-usuario')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'usuarios',
      filter: `forum_name=eq.${usuarioAtual.forumName}`
    }, (payload) => {
      handlePontosChange(payload);
    })
    .subscribe((status) => {
      console.log('Subscription pontos-usuario:', status);
    });

  subscriptions.push(pontosSubscription);

  const trocasSubscription = supabaseClient
    .channel('trocas-usuario')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'trocas_premios',
      filter: `habbo_name=eq.${usuarioAtual.habboName}`
    }, (payload) => {
      handleTrocasChange(payload);
    })
    .subscribe((status) => {
      console.log('Subscription trocas-usuario:', status);
    });

  subscriptions.push(trocasSubscription);

  if (isAdmin()) {
    const adminResgatesSubscription = supabaseClient
      .channel('resgates-admin')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'resgates'
      }, (payload) => {
        handleAdminResgateChange(payload);
      })
      .subscribe((status) => {
        console.log('Subscription resgates-admin:', status);
      });

    subscriptions.push(adminResgatesSubscription);

    const adminTrocasSubscription = supabaseClient
      .channel('trocas-admin')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trocas_premios'
      }, (payload) => {
        handleAdminTrocasChange(payload);
      })
      .subscribe((status) => {
        console.log('Subscription trocas-admin:', status);
      });

    subscriptions.push(adminTrocasSubscription);

    const premiosSubscription = supabaseClient
      .channel('premios-admin')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'premios'
      }, (payload) => {
        handlePremiosChange(payload);
      })
      .subscribe((status) => {
        console.log('Subscription premios-admin:', status);
      });

    subscriptions.push(premiosSubscription);

    const codigosSubscription = supabaseClient
      .channel('codigos-admin')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'codigos_ovos'
      }, (payload) => {
        handleCodigosChange(payload);
      })
      .subscribe((status) => {
        console.log('Subscription codigos-admin:', status);
      });

    subscriptions.push(codigosSubscription);
  }
}

async function handleResgateChange(payload) {
  console.log('Resgate change:', payload);
  await carregarResgates();
  atualizarUIEmTempoReal();
}

async function handlePontosChange(payload) {
  console.log('Pontos change:', payload);
  const { new: newRecord } = payload;
  
  if (newRecord && newRecord.pontos !== undefined) {
    usuarioAtual.pontos = newRecord.pontos;
    atualizarStats();
    atualizarUIPontos();
  }
}

async function handleTrocasChange(payload) {
  console.log('Trocas change:', payload);
  await carregarTrocas();
  atualizarUIEmTempoReal();
}

async function handleAdminResgateChange(payload) {
  console.log('Admin resgate change:', payload);
  const { eventType, new: newRecord } = payload;

  await carregarResgates();

  const adminSection = document.getElementById('section-admin');
  if (adminSection && !adminSection.classList.contains('hidden')) {
    renderizarAbaAdmin();
  }

  if (eventType === 'INSERT' && newRecord.status === 'pendente') {
    showToast('Novo Resgate!', `${newRecord.habbo_name} resgatou um código!`, 'success');
    tocarSomNotificacao();
  }
}

async function handleAdminTrocasChange(payload) {
  console.log('Admin trocas change:', payload);
  const { eventType, new: newRecord } = payload;

  await carregarTrocas();

  const adminSection = document.getElementById('section-admin');
  if (adminSection && !adminSection.classList.contains('hidden')) {
    renderizarAbaAdmin();
  }

  if (eventType === 'INSERT' && newRecord.status === 'pendente') {
    showToast('Nova Troca!', `${newRecord.habbo_name} solicitou um prêmio!`, 'success');
    tocarSomNotificacao();
  }
}

async function handlePremiosChange(payload) {
  console.log('Premios change:', payload);
  await carregarPremios();
  
  const premiosSection = document.getElementById('section-premios');
  const adminSection = document.getElementById('section-admin');
  
  if (premiosSection && !premiosSection.classList.contains('hidden')) {
    renderizarPremios();
  }
  
  if (adminSection && !adminSection.classList.contains('hidden')) {
    renderizarAbaAdmin();
  }
}

async function handleCodigosChange(payload) {
  console.log('Codigos change:', payload);
  await carregarCodigosStats();
  
  if (abaAdminAtiva === 'codigos') {
    await carregarTodosCodigos();
    filtrarListaCodigos();
  }
  
  const adminSection = document.getElementById('section-admin');
  if (adminSection && !adminSection.classList.contains('hidden')) {
    renderizarAbaAdmin();
  }
}

function atualizarUIEmTempoReal() {
  atualizarStats();

  const sections = {
    'section-guia': () => {
      atualizarStats();
      renderizarMeusResgates();
    },
    'section-resgatar': () => {
      renderizarMeusResgates();
    },
    'section-premios': () => {
      renderizarPremios();
    },
    'section-meus': () => {
      renderizarMeusResgates();
    },
    'section-ranking': () => {
      renderizarRanking();
    },
    'section-admin': () => {
      renderizarAdmin();
    }
  };

  for (const [id, updateFunc] of Object.entries(sections)) {
    const section = document.getElementById(id);
    if (section && !section.classList.contains('hidden')) {
      updateFunc();
      break;
    }
  }
}

function atualizarUIPontos() {
  const elementosPontos = [
    'userPoints',
    'saldoPontosLoja',
    'meusPontosTotal'
  ];

  elementosPontos.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      animarContador(el, parseInt(el.textContent) || 0, usuarioAtual.pontos);
    }
  });
}

function animarContador(elemento, de, para) {
  const duracao = 1000;
  const inicio = performance.now();

  function atualizar(tempoAtual) {
    const elapsed = tempoAtual - inicio;
    const progresso = Math.min(elapsed / duracao, 1);
    const easeOut = 1 - Math.pow(1 - progresso, 3);
    const valorAtual = Math.round(de + (para - de) * easeOut);
    
    elemento.textContent = valorAtual;

    if (progresso < 1) {
      requestAnimationFrame(atualizar);
    }
  }

  requestAnimationFrame(atualizar);
}

function tocarSomNotificacao() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Som não suportado');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  if (await inicializarUsuario()) {
    showSection('guia');
  }
});
