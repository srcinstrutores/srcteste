const SUPABASE_URL = 'https://gjxlapydpafwvyohovhj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeGxhcHlkcGFmd3Z5b2hvdmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDc3NTIsImV4cCI6MjA4NzcyMzc1Mn0.ni9szYqdrFWz3HcwYuOZaBFgcFddDoYSyZEakSQho-c';

let supabaseClient = null;

const CONFIG_OVOS = {
  comum: { id: 'comum', nome: 'Ovo Comum', emoji: '🥚', cor: '#8B4513', pontos: 5, limite: Infinity, descricao: 'Fáceis de encontrar em páginas ou quartos comuns.', chancePremio: 0 },
  incomum: { id: 'incomum', nome: 'Ovo Incomum', emoji: '🥚', cor: '#22c55e', pontos: 10, limite: 10, descricao: 'Ovos escondidos em locais que requerem mais atenção.', chancePremio: 0 },
  raro: { id: 'raro', nome: 'Ovo Raro', emoji: '🥚', cor: '#3b82f6', pontos: 30, limite: 5, descricao: 'Bem escondidos. Requer dedicação para encontrar.', chancePremio: 0.1 },
  epico: { id: 'epico', nome: 'Ovo Épico', emoji: '🥚', cor: '#a855f7', pontos: 50, limite: 1, descricao: 'Extremamente raros! Grande chance de prêmios épicos.', chancePremio: 0.4 },
  lendario: { id: 'lendario', nome: 'Ovo Lendário', emoji: '🥚', cor: '#f59e0b', pontos: 100, limite: 1, descricao: 'Quase impossíveis de encontrar!', chancePremio: 0.6 },
  coelhao: { id: 'coelhao', nome: 'Coelhão', emoji: '🐰', cor: 'gradient', pontos: 500, limite: 1, descricao: 'O GRANDE PRÊMIO! Existe apenas UM na companhia inteira.', premioGarantido: true, unicoGlobal: true }
};

const CUSTOS_PREMIO = { comum: 50, incomum: 100, raro: 200, epico: 350, lendario: 500 };

const CARGOS_ADMIN = ['diretor', 'vice-presidente', 'presidente'];

let state = {
  user: null,
  membros: [],
  resgates: [],
  trocas: [],
  premios: { comum: [], incomum: [], raro: [], epico: [], lendario: [] },
  codigos: [],
  subscriptions: []
};

function init() {
  if (!window.supabase) return;
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: { params: { eventsPerSecond: 10 } }
  });
}

async function getForumUser() {
  try {
    const res = await fetch('/forum');
    const html = await res.text();
    const match = html.match(/_userdata\["username"\]\s*=\s*"([^"]+)"/);
    if (match) {
      localStorage.setItem('forumUser', match[1].trim());
      return match[1].trim();
    }
  } catch {
    return localStorage.getItem('forumUser');
  }
}

async function loadMembros() {
  const res = await fetch('https://script.google.com/macros/s/AKfycbzhJdbeZfxkHgh3cQrK_YlhBCuhZyLhM_9jYkAnCPmbz-aYpv7845740KySuhjTzdIb/exec');
  const data = await res.json();
  state.membros = data.filter(m => !CARGOS_ADMIN.includes(m.cargo.toLowerCase()));
}

async function initUser() {
  const forumName = await getForumUser();
  if (!forumName) {
    showError('Não autenticado no fórum');
    return false;
  }

  await loadMembros();
  const membro = state.membros.find(m => m.nick === forumName);
  if (!membro) {
    showError('Você não é membro autorizado desta companhia.');
    return false;
  }

  let { data: user } = await supabaseClient.from('usuarios').select('*').eq('forum_name', forumName).single();

  if (!user) {
    const { data: newUser } = await supabaseClient
      .from('usuarios')
      .insert([{
        forum_name: forumName,
        habbo_name: forumName,
        pontos: 0,
        is_admin: false,
        ovos_resgatados: {}
      }])
      .select()
      .single();
    user = newUser;
  }

  state.user = {
    id: user.id,
    forumName: user.forum_name,
    habboName: user.habbo_name,
    cargo: membro.cargo,
    pontos: user.pontos || 0,
    isAdmin: user.is_admin || false,
    ovosResgatados: user.ovos_resgatados || {}
  };

  updateUIUser();
  await loadAllData();
  setupRealtime();
  renderAll();
  
  if (state.user.isAdmin) {
    document.getElementById('adminNavSection').style.display = 'block';
  }
  
  return true;
}

async function loadAllData() {
  await Promise.all([
    loadPremios(),
    loadResgates(),
    loadTrocas(),
    loadCodigos()
  ]);
}

async function loadPremios() {
  const { data } = await supabaseClient.from('premios').select('*').eq('ativo', true).order('nome');
  state.premios = { comum: [], incomum: [], raro: [], epico: [], lendario: [] };
  if (data) {
    data.forEach(p => {
      if (state.premios[p.categoria]) {
        state.premios[p.categoria].push(p);
      }
    });
  }
}

async function loadResgates() {
  const { data } = await supabaseClient
    .from('resgates')
    .select('*, premio:premio_id(*)')
    .eq('habbo_name', state.user.habboName)
    .order('created_at', { ascending: false });

  state.resgates = data || [];

  if (state.user.isAdmin) {
    const { data: all } = await supabaseClient
      .from('resgates')
      .select('*, premio:premio_id(*)')
      .order('created_at', { ascending: false });
    state.allResgates = all || [];
  }
}

async function loadTrocas() {
  const { data } = await supabaseClient
    .from('trocas')
    .select('*')
    .eq('habbo_name', state.user.habboName)
    .order('created_at', { ascending: false });

  state.trocas = data || [];

  if (state.user.isAdmin) {
    const { data: all } = await supabaseClient.from('trocas').select('*').order('created_at', { ascending: false });
    state.allTrocas = all || [];
  }
}

async function loadCodigos() {
  if (!state.user.isAdmin) return;
  
  const { data } = await supabaseClient
    .from('codigos')
    .select('*, usuario:usado_por(habbo_name)')
    .order('created_at', { ascending: false });
  
  state.codigos = data || [];
}

function setupRealtime() {
  state.subscriptions.forEach(s => s?.unsubscribe?.());
  state.subscriptions = [];

  const userFilter = `habbo_name=eq.${state.user.habboName}`;

  state.subscriptions.push(
    supabaseClient.channel('resgates-user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resgates', filter: userFilter }, () => {
        loadResgates().then(() => renderCurrentSection());
      })
      .subscribe()
  );

  state.subscriptions.push(
    supabaseClient.channel('trocas-user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trocas', filter: userFilter }, () => {
        loadTrocas().then(() => renderCurrentSection());
      })
      .subscribe()
  );

  state.subscriptions.push(
    supabaseClient.channel('user-pontos')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'usuarios', filter: `id=eq.${state.user.id}` }, (payload) => {
        if (payload.new.pontos !== undefined) {
          state.user.pontos = payload.new.pontos;
          updateStats();
          updateSaldo();
        }
      })
      .subscribe()
  );

  if (state.user.isAdmin) {
    state.subscriptions.push(
      supabaseClient.channel('resgates-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resgates' }, (payload) => {
          loadResgates().then(() => {
            if (document.getElementById('section-admin')?.classList.contains('active') || 
                document.querySelector('[data-section="admin"]')?.classList.contains('active')) {
              renderAdmin();
            }
            if (payload.eventType === 'INSERT' && payload.new.status === 'pendente') {
              showToast('Novo Resgate!', `${payload.new.habbo_name} resgatou um código!`);
              playSound();
            }
          });
        })
        .subscribe()
    );

    state.subscriptions.push(
      supabaseClient.channel('trocas-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trocas' }, () => {
          loadTrocas().then(() => {
            if (document.getElementById('section-admin')?.classList.contains('active')) {
              renderAdmin();
            }
          });
        })
        .subscribe()
    );

    state.subscriptions.push(
      supabaseClient.channel('premios-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'premios' }, () => {
          loadPremios().then(() => renderCurrentSection());
        })
        .subscribe()
    );

    state.subscriptions.push(
      supabaseClient.channel('codigos-all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'codigos' }, () => {
          loadCodigos().then(() => {
            if (document.getElementById('section-admin')?.classList.contains('active')) {
              renderAdmin();
            }
          });
        })
        .subscribe()
    );
  }
}

function renderAll() {
  renderGuia();
  renderPremios();
  renderMeus();
  renderRanking();
  updateStats();
}

function renderCurrentSection() {
  const sections = {
    'guia': renderGuia,
    'resgatar': renderResgatar,
    'premios': renderPremios,
    'meus': renderMeus,
    'ranking': renderRanking,
    'admin': renderAdmin
  };

  const active = document.querySelector('.nav-item.active')?.dataset.section;
  if (active && sections[active]) {
    sections[active]();
  }
  updateStats();
  updateSaldo();
}

function updateUIUser() {
  const set = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };

  const avatar = getAvatar(state.user.habboName);
  
  set('userAvatar', avatar);
  set('userName', state.user.habboName);
  set('userRole', state.user.cargo);
  set('mobileProfileAvatar', avatar);
  set('mobileUserName', state.user.habboName);
  set('mobileUserRole', state.user.cargo);
  
  document.getElementById('userBadge').style.display = 'flex';
  document.getElementById('mobileProfile').style.display = 'block';
}

function updateStats() {
  const aprovados = state.resgates.filter(r => r.status === 'aprovado');
  const pontos = aprovados.reduce((s, r) => s + r.pontos, 0);
  const ovos = aprovados.length;
  const premios = aprovados.filter(r => r.premio_id).length + state.trocas.filter(t => t.status === 'concluida').length;

  document.getElementById('userPoints').textContent = pontos;
  document.getElementById('userTotalOvos').textContent = ovos;
  document.getElementById('userTotalPremios').textContent = premios;
  document.getElementById('meusPontosTotal').textContent = pontos;
  document.getElementById('meusOvosTotal').textContent = ovos;
  document.getElementById('meusPremiosTotal').textContent = premios;
}

function updateSaldo() {
  document.getElementById('saldoPontosLoja').textContent = state.user.pontos;
}

function getAvatar(name, size = 's') {
  return `<img src="https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(name)}&headonly=1&size=${size}" 
    style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.style.display='none'; this.parentElement.textContent='🐰';">`;
}

function getBody(name, size = 'l') {
  return `<img src="https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(name)}&size=${size}" 
    style="height: 100%; width: auto; object-fit: contain;" onerror="this.style.display='none'; this.parentElement.textContent='🐰';">`;
}

function renderGuia() {
  const container = document.getElementById('guiaOvosLista');
  if (!container) return;

  container.innerHTML = Object.values(CONFIG_OVOS).map(ovo => `
    <div class="guia-item ${ovo.id}">
      <div class="guia-header">
        <div class="guia-emoji">${ovo.emoji}</div>
        <div class="guia-titulo">
          <div class="guia-nome" style="color: ${ovo.cor === 'gradient' ? '#f59e0b' : ovo.cor}">${ovo.nome}</div>
          <div class="guia-quantidade">${ovo.unicoGlobal ? 'Único' : 'Limitado'}</div>
        </div>
      </div>
      <div class="guia-recompensa">
        <span class="guia-pontos"><i class="fa-solid fa-coins"></i> ${ovo.pontos} pontos</span>
        ${ovo.chancePremio ? `<span class="guia-bonus"><i class="fa-solid fa-gift"></i> ${Math.round(ovo.chancePremio * 100)}% prêmio</span>` : ''}
        ${ovo.premioGarantido ? `<span class="guia-bonus"><i class="fa-solid fa-trophy"></i> Prêmio garantido!</span>` : ''}
      </div>
      <p class="guia-desc">${ovo.descricao}</p>
      <div class="guia-limites">
        <i class="fa-solid fa-user-check"></i>
        ${ovo.limite === Infinity ? 'Sem limite' : `Limite: ${ovo.limite} por usuário`}
        ${ovo.unicoGlobal ? ' • Apenas 1 na companhia' : ''}
      </div>
    </div>
  `).join('');
}

function renderResgatar() {
  renderMeusResgatesRecentes();
}

function renderPremios() {
  updateSaldo();
  
  Object.keys(state.premios).forEach(cat => {
    const container = document.getElementById(`premios${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
    if (!container) return;

    const custo = CUSTOS_PREMIO[cat];
    const premios = state.premios[cat];

    if (!premios?.length) {
      container.innerHTML = '<p style="color: var(--text-tertiary); text-align: center; padding: 20px;">Nenhum prêmio disponível.</p>';
      return;
    }

    container.innerHTML = premios.map(p => {
      const podeComprar = state.user.pontos >= custo && p.estoque > 0;
      const icone = p.imagem_url ? 
        `<img src="${p.imagem_url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` : 
        '🎁';

      return `
        <div class="premio-card ${cat}" style="${!podeComprar ? 'opacity: 0.6;' : ''}">
          <span class="premio-raridade">${cat}</span>
          <div class="premio-icon">${icone}</div>
          <h4 class="premio-nome">${p.nome}</h4>
          <p class="premio-desc">${p.descricao || ''}</p>
          <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin: 12px 0; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: var(--gold-dark);">
              <i class="fa-solid fa-coins"></i> ${custo}
            </div>
            <div style="font-size: 12px; color: var(--text-tertiary);">Estoque: ${p.estoque}</div>
          </div>
          <button class="btn ${podeComprar ? 'btn-primary' : 'btn-secondary'}" style="width: 100%;" 
            onclick="comprarPremio('${p.id}', '${cat}', ${custo})" ${!podeComprar ? 'disabled' : ''}>
            ${podeComprar ? '<i class="fa-solid fa-cart-shopping"></i> Trocar' : 
              state.user.pontos < custo ? '<i class="fa-solid fa-lock"></i> Sem pontos' : '<i class="fa-solid fa-lock"></i> Esgotado'}
          </button>
        </div>
      `;
    }).join('');
  });

  const total = Object.values(state.premios).reduce((a, b) => a + b.length, 0);
  document.getElementById('totalPremios').textContent = `${total} prêmios`;
}

async function comprarPremio(premioId, categoria, custo) {
  if (state.user.pontos < custo) {
    showToast('Erro', 'Pontos insuficientes!', 'error');
    return;
  }

  const premio = state.premios[categoria].find(p => p.id === premioId);
  if (!premio || premio.estoque <= 0) {
    showToast('Erro', 'Prêmio esgotado!', 'error');
    return;
  }

  if (!confirm(`Trocar ${custo} pontos por ${premio.nome}?\n\nSaldo atual: ${state.user.pontos}\nSaldo após: ${state.user.pontos - custo}`)) return;

  const { error: trocaError } = await supabaseClient.from('trocas').insert([{
    usuario_id: state.user.id,
    habbo_name: state.user.habboName,
    forum_name: state.user.forumName,
    premio_id: premioId,
    premio_nome: premio.nome,
    premio_imagem: premio.imagem_url,
    custo_pontos: custo,
    status: 'concluida'
  }]);

  if (trocaError) {
    showToast('Erro', trocaError.message, 'error');
    return;
  }

  const { error: pontosError } = await supabaseClient
    .from('usuarios')
    .update({ pontos: state.user.pontos - custo })
    .eq('id', state.user.id);

  if (pontosError) {
    showToast('Erro', 'Erro ao atualizar pontos', 'error');
    return;
  }

  const { error: estoqueError } = await supabaseClient
    .from('premios')
    .update({ estoque: premio.estoque - 1 })
    .eq('id', premioId);

  if (estoqueError) {
    showToast('Erro', 'Erro ao atualizar estoque', 'error');
    return;
  }

  state.user.pontos -= custo;
  premio.estoque--;

  showToast('Sucesso!', `Você trocou por ${premio.nome}!`, 'success');
  renderPremios();
  updateStats();
  updateSaldo();
}

function renderMeus() {
  renderMeusResgatesCompletos();
}

function renderMeusResgatesRecentes() {
  const container = document.getElementById('meusUltimosResgates');
  if (!container) return;

  const historico = getHistoricoCompleto().slice(0, 5);

  if (!historico.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 64px;">🧺</div>
        <h3>Sua cesta está vazia</h3>
        <p>Encontre ovos ou troque pontos por prêmios!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = historico.map(h => renderItemHistorico(h)).join('');
}

function renderMeusResgatesCompletos() {
  const container = document.getElementById('meuHistoricoCompleto');
  if (!container) return;

  const historico = getHistoricoCompleto();

  if (!historico.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-basket-shopping" style="font-size: 48px; opacity: 0.5;"></i>
        <h3>Nenhuma atividade</h3>
        <p>Comece a caçar ovos!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = historico.map(h => renderItemHistorico(h, true)).join('');
}

function getHistoricoCompleto() {
  const resgates = state.resgates.map(r => ({
    ...r,
    tipo: 'resgate',
    ehTroca: false,
    nome: CONFIG_OVOS[r.tipo_ovo]?.nome || r.tipo_ovo,
    emoji: CONFIG_OVOS[r.tipo_ovo]?.emoji || '🥚',
    cor: CONFIG_OVOS[r.tipo_ovo]?.cor || '#ccc'
  }));

  const trocas = state.trocas.map(t => ({
    ...t,
    tipo: 'troca',
    ehTroca: true,
    nome: 'Troca: ' + t.premio_nome,
    emoji: '🎁',
    cor: 'var(--primary)',
    pontos: -t.custo_pontos,
    status: t.status
  }));

  return [...resgates, ...trocas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function renderItemHistorico(h, completo = false) {
  const isTroca = h.ehTroca;
  const statusColor = h.status === 'aprovado' || h.status === 'concluida' ? (isTroca ? 'var(--primary)' : 'var(--success)') : 
                      h.status === 'pendente' ? 'var(--warning)' : 'var(--danger)';
  
  const statusText = h.status === 'aprovado' || h.status === 'concluida' ? 'Concluído' : 
                     h.status === 'pendente' ? 'Pendente' : 'Rejeitado';
  
  const icon = h.status === 'aprovado' || h.status === 'concluida' ? 'check' : 
               h.status === 'pendente' ? 'clock' : 'xmark';

  return `
    <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-white); border-radius: 12px; margin-bottom: 12px; border-left: 4px solid ${statusColor};">
      <div style="font-size: 40px;">${h.emoji}</div>
      <div style="flex: 1;">
        <h4 style="margin-bottom: 4px;">${h.nome}</h4>
        <p style="font-size: 13px; color: var(--text-tertiary);">
          ${new Date(h.created_at).toLocaleDateString('pt-BR')} ${completo ? 'às ' + new Date(h.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : ''}
        </p>
        ${!isTroca && completo ? `<p style="font-size: 12px; color: var(--text-tertiary);"><i class="fa-solid fa-hashtag"></i> ${h.codigo}</p>` : ''}
        <span class="status-badge status-${h.status === 'concluida' ? 'aprovado' : h.status}" style="margin-top: 8px; display: inline-flex;">
          <i class="fa-solid fa-${icon}"></i> ${statusText}
        </span>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 20px; font-weight: 800; color: ${h.status === 'aprovado' || h.status === 'concluida' ? (isTroca ? 'var(--danger)' : 'var(--gold-dark)') : 'var(--text-tertiary)'};">
          ${isTroca ? '' : '+'}${h.pontos}
        </div>
      </div>
    </div>
  `;
}

function renderRanking() {
  if (!state.membros.length) return;

  const jogadores = state.membros.map(m => {
    const souEu = m.nick === state.user.habboName;
    const u = souEu ? state.user : null;
    return {
      nome: m.nick,
      pontos: u?.pontos || Math.floor(Math.random() * 300),
      ovos: u ? Object.values(u.ovosResgatados || {}).reduce((a,b) => a+b, 0) : Math.floor(Math.random() * 10),
      souEu
    };
  });

  jogadores.sort((a, b) => b.pontos - a.pontos);

  const top3 = jogadores.slice(0, 3);
  const resto = jogadores.slice(3);

  const podium = document.getElementById('podiumTop3');
  if (podium && top3.length >= 3) {
    const medals = { 1: 'fa-crown', 2: 'fa-medal', 3: 'fa-award' };
    const heights = { 1: '170px', 2: '140px', 3: '140px' };
    
    podium.innerHTML = [2, 1, 3].map((pos, i) => `
      <div class="podium-item pos-${pos}">
        <div class="podium-avatar-wrapper" style="top: ${pos === 1 ? '-80px' : '-60px'};">
          <div class="podium-badge"><i class="fa-solid ${medals[pos]}"></i></div>
          <div class="podium-avatar-container" style="width: ${pos === 1 ? '80px' : '60px'}; height: ${pos === 1 ? '80px' : '60px'};">
            ${getAvatar(top3[pos-1]?.nome, 'l')}
          </div>
        </div>
        <div class="podium-base" style="min-height: ${pos === 1 ? '140px' : pos === 2 ? '110px' : '90px'}; background: ${pos === 1 ? 'linear-gradient(180deg, #FFD700, #FFA500)' : pos === 2 ? 'linear-gradient(180deg, #C0C0C0, #808080)' : 'linear-gradient(180deg, #CD7F32, #8B4513)'};">
          <div class="podium-info">
            <div class="podium-nome">${top3[pos-1]?.nome || '-'}</div>
            <div class="podium-pontos"><i class="fa-solid fa-coins"></i> ${top3[pos-1]?.pontos || 0}</div>
          </div>
          <div class="podium-rank-number">${pos}</div>
        </div>
      </div>
    `).join('');
  }

  const lista = document.getElementById('rankingCompleto');
  if (lista) {
    lista.innerHTML = jogadores.map((j, i) => `
      <div class="ranking-item-novo ${j.souEu ? 'destaque' : ''}" data-pos="${i + 1}">
        <div class="ranking-pos ${i < 3 ? 'top' : 'normal'}">${i + 1}</div>
        <div class="ranking-avatar-novo" style="overflow: hidden; padding: 0;">
          ${getAvatar(j.nome, 'm')}
        </div>
        <div class="ranking-info-novo">
          <div class="ranking-nome-novo">
            ${j.nome} ${j.souEu ? '<span class="ranking-badge">VOCÊ</span>' : ''}
          </div>
          <div class="ranking-stats">
            <span class="ranking-stat pontos"><i class="fa-solid fa-coins"></i> ${j.pontos}</span>
            <span class="ranking-stat ovos"><i class="fa-solid fa-egg"></i> ${j.ovos}</span>
          </div>
        </div>
        <div class="ranking-valor">
          <div class="ranking-numero">${j.pontos}</div>
        </div>
      </div>
    `).join('');
  }
}

let adminTab = 'resgates';

function renderAdmin() {
  if (!state.user.isAdmin) {
    document.getElementById('adminContent').innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-lock" style="font-size: 48px;"></i>
        <h3>Acesso Restrito</h3>
      </div>
    `;
    return;
  }

  document.getElementById('adminContent').innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
      <button class="btn btn-sm ${adminTab === 'resgates' ? 'btn-primary' : 'btn-secondary'}" onclick="setAdminTab('resgates')">
        <i class="fa-solid fa-clipboard-check"></i> Resgates
      </button>
      <button class="btn btn-sm ${adminTab === 'trocas' ? 'btn-primary' : 'btn-secondary'}" onclick="setAdminTab('trocas')">
        <i class="fa-solid fa-exchange-alt"></i> Trocas
      </button>
      <button class="btn btn-sm ${adminTab === 'premios' ? 'btn-primary' : 'btn-secondary'}" onclick="setAdminTab('premios')">
        <i class="fa-solid fa-gift"></i> Prêmios
      </button>
      <button class="btn btn-sm ${adminTab === 'codigos' ? 'btn-primary' : 'btn-secondary'}" onclick="setAdminTab('codigos')">
        <i class="fa-solid fa-key"></i> Códigos
      </button>
    </div>
    <div id="adminTabContent"></div>
  `;

  renderAdminTab();
}

function setAdminTab(tab) {
  adminTab = tab;
  renderAdmin();
  if (tab === 'codigos') loadCodigos().then(() => renderAdminTab());
}

function renderAdminTab() {
  const content = document.getElementById('adminTabContent');
  if (!content) return;

  switch (adminTab) {
    case 'resgates': content.innerHTML = renderAdminResgates(); break;
    case 'trocas': content.innerHTML = renderAdminTrocas(); break;
    case 'premios': content.innerHTML = renderAdminPremios(); break;
    case 'codigos': content.innerHTML = renderAdminCodigos(); break;
  }
}

function renderAdminResgates() {
  const pendentes = state.allResgates?.filter(r => r.status === 'pendente') || [];

  return `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"><i class="fa-solid fa-clock"></i> Pendentes (${pendentes.length})</div>
      </div>
      <div class="panel-content" style="overflow-x: auto;">
        ${!pendentes.length ? '<div class="empty-state"><i class="fa-solid fa-check-circle" style="color: var(--success); font-size: 48px;"></i><h3>Tudo em ordem!</h3></div>' : `
          <table class="resgates-table">
            <thead>
              <tr><th>Usuário</th><th>Ovo</th><th>Código</th><th>Pontos</th><th>Comprovação</th><th>Ações</th></tr>
            </thead>
            <tbody>
              ${pendentes.map(r => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <div style="width: 32px; height: 32px;">${getAvatar(r.habbo_name, 's')}</div>
                      <div>
                        <div style="font-weight: 600; font-size: 13px;">${r.forum_name}</div>
                        <div style="font-size: 11px; color: var(--text-tertiary);">${r.habbo_name}</div>
                      </div>
                    </div>
                  </td>
                  <td>${CONFIG_OVOS[r.tipo_ovo]?.emoji || '🥚'} ${CONFIG_OVOS[r.tipo_ovo]?.nome || r.tipo_ovo}</td>
                  <td><code style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px;">${r.codigo}</code></td>
                  <td style="color: var(--gold-dark); font-weight: 700;">+${r.pontos}</td>
                  <td>
                    ${r.comprovante_url ? `<a href="${r.comprovante_url}" target="_blank" class="btn btn-sm btn-primary"><i class="fa-solid fa-image"></i> Ver</a>` : '-'}
                  </td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-icon btn-view" onclick="verDetalhes('${r.id}')"><i class="fa-solid fa-eye"></i></button>
                      <button class="btn-icon btn-approve" onclick="aprovarResgateAdmin('${r.id}')"><i class="fa-solid fa-check"></i></button>
                      <button class="btn-icon btn-reject" onclick="rejeitarResgateAdmin('${r.id}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
}

function renderAdminTrocas() {
  const pendentes = state.allTrocas?.filter(t => t.status === 'pendente') || [];
  
  return `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"><i class="fa-solid fa-exchange-alt"></i> Trocas Pendentes (${pendentes.length})</div>
      </div>
      <div class="panel-content">
        ${!pendentes.length ? '<div class="empty-state"><h3>Sem trocas pendentes</h3></div>' : `
          <div style="display: grid; gap: 12px;">
            ${pendentes.map(t => `
              <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-white); border-radius: 12px;">
                <div style="width: 48px; height: 48px;">${getAvatar(t.habbo_name, 'm')}</div>
                <div style="flex: 1;">
                  <h4>${t.habbo_name}</h4>
                  <p style="font-size: 13px; color: var(--text-tertiary);">Trocou ${t.custo_pontos} pontos por ${t.premio_nome}</p>
                </div>
                <div class="action-btns">
                  <button class="btn-icon btn-approve" onclick="aprovarTroca('${t.id}')"><i class="fa-solid fa-check"></i></button>
                  <button class="btn-icon btn-reject" onclick="rejeitarTroca('${t.id}')"><i class="fa-solid fa-xmark"></i></button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function renderAdminPremios() {
  const cats = ['comum', 'incomum', 'raro', 'epico', 'lendario'];
  
  return `
    <div style="display: grid; gap: 20px;">
      <div class="panel" style="border: 2px solid var(--primary);">
        <div class="panel-header" style="background: var(--gradient-primary); color: white;">
          <div class="panel-title" style="color: white;"><i class="fa-solid fa-plus-circle"></i> Novo Prêmio</div>
        </div>
        <div class="panel-content">
          <form onsubmit="criarPremio(event)" style="display: grid; gap: 16px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
              <div class="form-group">
                <label class="form-label">Nome *</label>
                <input type="text" class="form-input" id="novoPremioNome" required>
              </div>
              <div class="form-group">
                <label class="form-label">Categoria *</label>
                <select class="form-select" id="novoPremioCat" required>
                  ${cats.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">URL da Imagem *</label>
                <input type="url" class="form-input" id="novoPremioImg" required placeholder="https://i.imgur.com/...">
              </div>
              <div class="form-group">
                <label class="form-label">Estoque *</label>
                <input type="number" class="form-input" id="novoPremioQtd" required min="1" value="1">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Descrição</label>
              <input type="text" class="form-input" id="novoPremioDesc">
            </div>
            <button type="submit" class="btn btn-primary" style="width: auto; justify-self: start;">
              <i class="fa-solid fa-plus"></i> Adicionar
            </button>
          </form>
        </div>
      </div>

      ${cats.map(cat => `
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">
              <i class="fa-solid fa-${cat === 'comum' ? 'star' : cat === 'incomum' ? 'star-half' : cat === 'raro' ? 'gem' : cat === 'epico' ? 'crown' : 'trophy'}"></i>
              ${cat} <span class="panel-badge">${state.premios[cat]?.length || 0}</span>
            </div>
          </div>
          <div class="panel-content">
            ${!state.premios[cat]?.length ? '<p style="color: var(--text-tertiary);">Nenhum prêmio.</p>' : `
              <div style="display: grid; gap: 12px;">
                ${state.premios[cat].map(p => `
                  <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg-white); border-radius: 12px;">
                    <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden;">
                      <img src="${p.imagem_url}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src=''">
                    </div>
                    <div style="flex: 1;">
                      <h4>${p.nome}</h4>
                      <p style="font-size: 13px; color: var(--text-tertiary);">${p.descricao || ''}</p>
                    </div>
                    <div style="text-align: center; min-width: 80px;">
                      <div style="font-size: 24px; font-weight: 800; color: ${p.estoque > 0 ? 'var(--success)' : 'var(--danger)'};">${p.estoque}</div>
                    </div>
                    <div style="display: flex; gap: 4px;">
                      <button class="btn-icon" onclick="ajustarEstoquePremio('${p.id}', 1)" style="background: var(--success); color: white;"><i class="fa-solid fa-plus"></i></button>
                      <button class="btn-icon" onclick="ajustarEstoquePremio('${p.id}', -1)" style="background: var(--warning); color: white;"><i class="fa-solid fa-minus"></i></button>
                      <button class="btn-icon btn-reject" onclick="removerPremio('${p.id}')"><i class="fa-solid fa-trash"></i></button>
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

function renderAdminCodigos() {
  const stats = {};
  state.codigos.forEach(c => {
    if (!stats[c.tipo]) stats[c.tipo] = { total: 0, usados: 0 };
    stats[c.tipo].total++;
    if (c.usado) stats[c.tipo].usados++;
  });

  return `
    <div style="display: grid; gap: 20px;">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title"><i class="fa-solid fa-chart-pie"></i> Estatísticas</div>
          <button class="btn btn-primary btn-sm" onclick="abrirModalGerarCodigos()"><i class="fa-solid fa-plus"></i> Gerar</button>
        </div>
        <div class="panel-content">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
            ${Object.entries(CONFIG_OVOS).map(([key, ovo]) => {
              const s = stats[key] || { total: 0, usados: 0 };
              const pct = s.total ? Math.round((s.usados / s.total) * 100) : 0;
              return `
                <div style="background: var(--bg-white); padding: 20px; border-radius: 12px; border-left: 4px solid ${ovo.cor === 'gradient' ? '#f59e0b' : ovo.cor};">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span style="font-size: 32px;">${ovo.emoji}</span>
                    <div>
                      <h4 style="margin: 0; color: ${ovo.cor === 'gradient' ? '#f59e0b' : ovo.cor};">${ovo.nome}</h4>
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 14px;">
                    <span>Total: <strong>${s.total}</strong></span>
                    <span style="color: var(--success);">Disp.: <strong>${s.total - s.usados}</strong></span>
                    <span style="color: var(--danger);">Usados: <strong>${s.usados}</strong></span>
                  </div>
                  <div style="width: 100%; height: 6px; background: var(--bg-secondary); border-radius: 3px; margin-top: 8px;">
                    <div style="width: ${pct}%; height: 100%; background: ${ovo.cor === 'gradient' ? 'linear-gradient(90deg, #ff6b6b, #feca57)' : ovo.cor};"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title"><i class="fa-solid fa-list"></i> Lista de Códigos</div>
          <div style="display: flex; gap: 8px;">
            <select class="filter-select" id="filtroTipoCodigo" onchange="filtrarCodigos()" style="width: auto;">
              <option value="todos">Todos os tipos</option>
              ${Object.entries(CONFIG_OVOS).map(([k, v]) => `<option value="${k}">${v.nome}</option>`).join('')}
            </select>
            <select class="filter-select" id="filtroStatusCodigo" onchange="filtrarCodigos()" style="width: auto;">
              <option value="todos">Todos</option>
              <option value="disponivel">Disponíveis</option>
              <option value="usado">Usados</option>
            </select>
          </div>
        </div>
        <div class="panel-content">
          <div id="listaCodigosContainer" style="max-height: 500px; overflow-y: auto;">
            ${renderCodigosList(state.codigos)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCodigosList(codigos) {
  if (!codigos?.length) {
    return '<div class="empty-state"><h3>Nenhum código</h3></div>';
  }

  return `
    <div style="display: grid; gap: 8px;">
      ${codigos.map(c => {
        const cfg = CONFIG_OVOS[c.tipo];
        return `
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-white); border-radius: 8px; ${c.usado ? 'opacity: 0.6;' : ''}">
            <span style="font-size: 24px;">${cfg?.emoji || '🥚'}</span>
            <div style="flex: 1;">
              <div style="display: flex; gap: 8px; align-items: center;">
                <code style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-weight: 600;">${c.codigo}</code>
                <span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: ${cfg?.cor === 'gradient' ? 'linear-gradient(90deg, #ff6b6b, #feca57)' : cfg?.cor}; color: white;">${cfg?.nome}</span>
                ${c.usado ? '<span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--danger); color: white;">USADO</span>' : '<span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--success); color: white;">DISPONÍVEL</span>'}
              </div>
              ${c.usado ? `<div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px;">Por: ${c.usuario?.habbo_name || '?'} em ${new Date(c.usado_em).toLocaleDateString('pt-BR')}</div>` : ''}
            </div>
            <button class="btn-icon btn-view" onclick="navigator.clipboard.writeText('${c.codigo}')"><i class="fa-solid fa-copy"></i></button>
            ${!c.usado ? `<button class="btn-icon btn-reject" onclick="deletarCodigo('${c.id}', '${c.codigo}')"><i class="fa-solid fa-trash"></i></button>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function filtrarCodigos() {
  const tipo = document.getElementById('filtroTipoCodigo')?.value || 'todos';
  const status = document.getElementById('filtroStatusCodigo')?.value || 'todos';

  let filtrados = state.codigos;
  if (tipo !== 'todos') filtrados = filtrados.filter(c => c.tipo === tipo);
  if (status === 'disponivel') filtrados = filtrados.filter(c => !c.usado);
  if (status === 'usado') filtrados = filtrados.filter(c => c.usado);

  document.getElementById('listaCodigosContainer').innerHTML = renderCodigosList(filtrados);
}

async function verificarCodigo() {
  const input = document.getElementById('codigoInput');
  const codigo = input?.value?.trim().toUpperCase();
  
  if (!codigo) {
    showToast('Erro', 'Digite um código', 'error');
    return;
  }

  const { data, error } = await supabaseClient.from('codigos').select('*').eq('codigo', codigo).single();

  if (error || !data) {
    showToast('Erro', 'Código não encontrado', 'error');
    return;
  }

  if (data.usado) {
    showToast('Erro', 'Código já foi usado', 'error');
    return;
  }

  const cfg = CONFIG_OVOS[data.tipo];
  
  if (cfg.unicoGlobal) {
    const { data: existe } = await supabaseClient.from('resgates').select('id').eq('tipo_ovo', 'coelhao').eq('status', 'aprovado').single();
    if (existe) {
      showToast('Erro', 'Você já atingiu o limite de resgates', 'error');
      return;
    }
  }

  if (cfg.limite !== Infinity) {
    const count = state.resgates.filter(r => r.tipo_ovo === data.tipo && r.status === 'aprovado').length;
    if (count >= cfg.limite) {
      showToast('Erro', 'Você já atingiu o limite de resgates', 'error');
      return;
    }
  }

  resgatePendente = { codigo: data.codigo, codigoId: data.id, tipo: data.tipo, config: cfg };
  abrirModalComprovacao();
}

function abrirModalComprovacao() {
  const cfg = resgatePendente.config;
  document.getElementById('comprovacaoInfo').innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
      <div style="font-size: 48px;">${cfg.emoji}</div>
      <div>
        <h4 style="color: ${cfg.cor === 'gradient' ? '#f59e0b' : cfg.cor};">${cfg.nome}</h4>
        <p style="font-size: 14px; color: var(--text-tertiary);">Código: ${resgatePendente.codigo}</p>
      </div>
    </div>
    <div style="background: var(--bg-white); padding: 12px; border-radius: 8px; text-align: center;">
      <p style="font-size: 18px; font-weight: 700; color: var(--gold-dark);"><i class="fa-solid fa-coins"></i> ${cfg.pontos} pontos</p>
      ${cfg.chancePremio ? `<p style="color: var(--warning); font-size: 14px;">${Math.round(cfg.chancePremio * 100)}% chance de prêmio</p>` : ''}
      ${cfg.premioGarantido ? `<p style="color: var(--success); font-size: 14px;"><i class="fa-solid fa-trophy"></i> Prêmio garantido!</p>` : ''}
    </div>
  `;
  
  document.getElementById('comprovacaoModal').classList.add('active');
}

async function confirmarResgate(e) {
  e.preventDefault();
  if (!resgatePendente) return;

  const link = document.getElementById('comprovacaoLink')?.value?.trim();
  const desc = document.getElementById('comprovacaoDesc')?.value?.trim();
  const cfg = resgatePendente.config;

  if (!link) {
    showToast('Erro', 'Link de comprovação obrigatório', 'error');
    return;
  }

  let premioId = null;
  if (cfg.premioGarantido) {
    const disp = state.premios.lendario.filter(p => p.estoque > 0);
    if (disp.length) premioId = disp[0].id;
  } else if (cfg.chancePremio && Math.random() < cfg.chancePremio) {
    const cat = cfg.id === 'lendario' ? 'lendario' : cfg.id === 'epico' ? 'epico' : 'raro';
    const disp = state.premios[cat].filter(p => p.estoque > 0);
    if (disp.length) premioId = disp[Math.floor(Math.random() * disp.length)].id;
  }

  const { error } = await supabaseClient.from('resgates').insert([{
    usuario_id: state.user.id,
    habbo_name: state.user.habboName,
    forum_name: state.user.forumName,
    tipo_ovo: resgatePendente.tipo,
    codigo: resgatePendente.codigo,
    pontos: cfg.pontos,
    premio_id: premioId,
    comprovante_url: link,
    descricao: desc,
    status: 'pendente'
  }]);

  if (error) {
    showToast('Erro', error.message, 'error');
    return;
  }

  await supabaseClient.from('codigos').update({ usado: true, usado_por: state.user.id, usado_em: new Date().toISOString() }).eq('id', resgatePendente.codigoId);

  fecharModal('comprovacaoModal');
  document.getElementById('codigoInput').value = '';
  resgatePendente = null;
  
  showToast('Sucesso!', 'Resgate enviado para aprovação', 'success');
}

async function aprovarResgateAdmin(id) {
  const r = state.allResgates.find(x => x.id === id);
  if (!r) return;

  await supabaseClient.from('resgates').update({ status: 'aprovado', aprovado_em: new Date().toISOString() }).eq('id', id);
  
  await supabaseClient.from('usuarios').update({ pontos: state.user.pontos + r.pontos }).eq('habbo_name', r.habbo_name);

  if (r.premio_id) {
    await supabaseClient.from('premios').update({ estoque: Math.max(0, (r.premio?.estoque || 1) - 1) }).eq('id', r.premio_id);
  }

  showToast('Aprovado!', 'Resgate aprovado', 'success');
}

async function rejeitarResgateAdmin(id) {
  const motivo = prompt('Motivo da rejeição:');
  if (motivo === null) return;

  const r = state.allResgates.find(x => x.id === id);
  
  await supabaseClient.from('resgates').update({ status: 'rejeitado', rejeitado_em: new Date().toISOString(), motivo_rejeicao: motivo }).eq('id', id);
  await supabaseClient.from('codigos').update({ usado: false, usado_por: null, usado_em: null }).eq('codigo', r.codigo);

  showToast('Rejeitado', 'Resgate rejeitado', 'error');
}

async function aprovarTroca(id) {
  await supabaseClient.from('trocas').update({ status: 'concluida', concluida_em: new Date().toISOString() }).eq('id', id);
  showToast('Aprovada!', 'Troca concluída', 'success');
}

async function rejeitarTroca(id) {
  const t = state.allTrocas.find(x => x.id === id);
  if (!t) return;

  await supabaseClient.from('trocas').update({ status: 'rejeitada', rejeitada_em: new Date().toISOString() }).eq('id', id);
  await supabaseClient.from('usuarios').update({ pontos: state.user.pontos + t.custo_pontos }).eq('id', t.usuario_id);
  
  showToast('Rejeitada', 'Pontos devolvidos', 'error');
}

async function criarPremio(e) {
  e.preventDefault();
  
  const nome = document.getElementById('novoPremioNome').value;
  const cat = document.getElementById('novoPremioCat').value;
  const img = document.getElementById('novoPremioImg').value;
  const qtd = parseInt(document.getElementById('novoPremioQtd').value);
  const desc = document.getElementById('novoPremioDesc').value;

  const { error } = await supabaseClient.from('premios').insert([{
    nome, categoria: cat, imagem_url: img, estoque: qtd, descricao: desc, ativo: true
  }]);

  if (error) {
    showToast('Erro', error.message, 'error');
    return;
  }

  e.target.reset();
  showToast('Sucesso!', 'Prêmio criado', 'success');
}

async function ajustarEstoquePremio(id, qtd) {
  const p = Object.values(state.premios).flat().find(x => x.id === id);
  if (!p) return;

  const novo = Math.max(0, p.estoque + qtd);
  await supabaseClient.from('premios').update({ estoque: novo }).eq('id', id);
  
  p.estoque = novo;
  renderAdminTab();
  if (document.getElementById('section-premios')?.classList.contains('active')) renderPremios();
}

async function removerPremio(id) {
  if (!confirm('Remover este prêmio?')) return;
  await supabaseClient.from('premios').update({ ativo: false }).eq('id', id);
  showToast('Removido', 'Prêmio desativado', 'success');
}

function abrirModalGerarCodigos() {
  document.getElementById('codigoModal').classList.add('active');
}

async function gerarCodigos(e) {
  e.preventDefault();
  
  const tipo = document.getElementById('codigoTipo').value;
  const qtd = parseInt(document.getElementById('codigoQuantidade').value);

  const novos = [];
  for (let i = 0; i < qtd; i++) {
    const ident = Math.random().toString(36).substring(2, 6).toUpperCase();
    const num = Math.floor(1000 + Math.random() * 9000);
    novos.push({
      codigo: `SRC-${ident}-${num}`,
      tipo: tipo,
      usado: false
    });
  }

  const { error } = await supabaseClient.from('codigos').insert(novos);
  
  if (error) {
    showToast('Erro', error.message, 'error');
    return;
  }

  fecharModal('codigoModal');
  e.target.reset();
  showToast('Sucesso!', `${qtd} códigos gerados`, 'success');
}

async function deletarCodigo(id, codigo) {
  if (!confirm(`Deletar ${codigo}?`)) return;
  await supabaseClient.from('codigos').delete().eq('id', id);
  showToast('Deletado', 'Código removido', 'success');
}

function verDetalhes(id) {
  const r = state.allResgates.find(x => x.id === id);
  if (!r) return;

  document.getElementById('viewModalContent').innerHTML = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 64px;">${CONFIG_OVOS[r.tipo_ovo]?.emoji || '🥚'}</div>
      <div style="height: 150px; display: flex; align-items: flex-end; justify-content: center;">
        ${getBody(r.habbo_name, 'l')}
      </div>
      <h3>${CONFIG_OVOS[r.tipo_ovo]?.nome}</h3>
      <p>${r.codigo}</p>
    </div>
    
    <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
      <h4 style="font-size: 14px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 12px;">Informações</h4>
      <div style="display: grid; gap: 8px; font-size: 14px;">
        <div style="display: flex; justify-content: space-between;"><span>Habbo:</span> <strong>${r.habbo_name}</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Fórum:</span> <strong>${r.forum_name}</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Data:</span> <strong>${new Date(r.created_at).toLocaleString('pt-BR')}</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Status:</span> <span class="status-badge status-${r.status}">${r.status}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Pontos:</span> <strong style="color: var(--gold-dark);">+${r.pontos}</strong></div>
      </div>
    </div>

    ${r.comprovante_url ? `
      <div style="background: linear-gradient(135deg, var(--primary-light), var(--primary)); padding: 20px; border-radius: 12px; margin-bottom: 16px; color: white;">
        <h4 style="font-size: 14px; text-transform: uppercase; margin-bottom: 12px;"><i class="fa-solid fa-camera"></i> Comprovação</h4>
        <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-bottom: 12px; word-break: break-all; font-family: monospace; font-size: 13px;">
          ${r.comprovante_url}
        </div>
        <div style="display: flex; gap: 8px;">
          <a href="${r.comprovante_url}" target="_blank" class="btn btn-primary" style="flex: 1; background: white; color: var(--primary); text-decoration: none;">Abrir Link</a>
          <button class="btn btn-secondary" style="flex: 1; background: rgba(255,255,255,0.3); color: white; border: none;" onclick="navigator.clipboard.writeText('${r.comprovante_url}')">Copiar</button>
        </div>
        <img src="${r.comprovante_url}" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 12px; border: 2px solid rgba(255,255,255,0.3);" onerror="this.style.display='none'">
      </div>
    ` : ''}

    ${r.descricao ? `
      <div style="background: var(--bg-secondary); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
        <h4 style="font-size: 14px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 8px;">Descrição</h4>
        <p style="font-size: 14px;">${r.descricao}</p>
      </div>
    ` : ''}

    <div style="display: flex; gap: 12px;">
      <button class="btn btn-secondary" style="flex: 1;" onclick="fecharModal('viewModal')">Fechar</button>
      ${r.status === 'pendente' ? `
        <button class="btn btn-success" style="flex: 1;" onclick="aprovarResgateAdmin('${r.id}'); fecharModal('viewModal');">Aprovar</button>
        <button class="btn btn-danger" style="flex: 1;" onclick="rejeitarResgateAdmin('${r.id}'); fecharModal('viewModal');">Rejeitar</button>
      ` : ''}
    </div>
  `;
  
  document.getElementById('viewModal').classList.add('active');
}

function fecharModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

function showSection(sec) {
  document.querySelectorAll('.section-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`section-${sec}`)?.classList.remove('hidden');
  document.querySelector(`[data-section="${sec}"]`)?.classList.add('active');
  
  renderCurrentSection();
}

function showToast(title, msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.className = `toast ${type}`;
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastMessage').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function playSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch(e) {}
}

function showError(msg) {
  document.body.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; text-align: center; padding: 20px;">
      <div style="font-size: 64px;">🚫</div>
      <h1 style="font-size: 24px; margin-bottom: 16px;">Acesso Negado</h1>
      <p>${msg}</p>
      <button onclick="location.reload()" style="margin-top: 24px; padding: 12px 24px; background: white; color: #1e40af; border: none; border-radius: 8px; cursor: pointer;">Tentar Novamente</button>
    </div>
  `;
}

function toggleMenu() {
  const sb = document.getElementById('sidebarNav');
  const ov = document.getElementById('sidebarOverlay');
  const btn = document.getElementById('mobileMenuBtn');
  
  sb.classList.toggle('active');
  ov.classList.toggle('active');
  btn.classList.toggle('active');
  document.body.style.overflow = sb.classList.contains('active') ? 'hidden' : '';
}

function closeMenu() {
  document.getElementById('sidebarNav').classList.remove('active');
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.getElementById('mobileMenuBtn').classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  initUser();
});
