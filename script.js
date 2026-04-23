// ===============================================
// Lógica do Sistema de Bancadas
// ===============================================

// ===== Storage helpers & initialization =====
const LS = {
    get(k){ try{ return JSON.parse(localStorage.getItem(k)||'null') } catch(e){ return null } },
    set(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
};

// Inicialização com valores default, se necessário
if (!LS.get('bancadas')) LS.set('bancadas', []);
if (!LS.get('lideres')) LS.set('lideres', []);
if (!LS.get('colaboradores')) LS.set('colaboradores', []);
if (!LS.get('history')) LS.set('history', []);
if (!LS.get('maintenanceHistory')) LS.set('maintenanceHistory', []);
if (!LS.get('infeedMetas')) LS.set('infeedMetas', {});

let sortState = {}; 

const benches = () => LS.get('bancadas') || [];
const leaders = () => LS.get('lideres') || [];
const workers = () => LS.get('colaboradores') || [];
const historyArr = () => LS.get('history') || [];
const maintenanceHistoryArr = () => LS.get('maintenanceHistory') || [];
const infeedMetas = () => LS.get('infeedMetas') || {};

function cleanOldHistory(){
    // Mantém histórico apenas dos últimos 5 dias, por exemplo
    const days = 5;
    const now = Date.now();
    const h = historyArr();
    const kept = h.filter(item => {
        const d = new Date(item.date).getTime();
        return (now - d) <= days * 24*60*60*1000;
    });
    LS.set('history', kept);
}
cleanOldHistory();

/* UI navigation */
function showScreen(id){
    document.getElementById('screen-operation').style.display = id=== 'operation' ? '' : 'none';
    document.getElementById('screen-cadastro').style.display = id=== 'cadastro' ? '' : 'none';

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.screen === id) {
            btn.classList.add('active');
        }
    });
    renderAll();
}
showScreen('operation');


/* ===== Render Operation: Blocks per station ===== */
function renderOperation(){
    const allBenches = benches();
    const group = {};
    allBenches.forEach(b => { 
        // Conversão de estacao para String para evitar erros de chave se for '0'
        const estacaoStr = String(b.estacao);
        if(!group[estacaoStr]) group[estacaoStr]=[]; 
        group[estacaoStr].push(b); 
    });
    const stations = Object.keys(group).sort((a,b)=>a-b);
    const container = document.getElementById('stationsContainer');
    container.innerHTML = '';
    
    if(stations.length===0){ container.innerHTML = '<div class="card">Nenhum setor cadastrado.</div>'; return; }

    stations.forEach(st => {
        const allBenchesInStation = (group[st]||[]);
        const benchesInStation = allBenchesInStation.filter(b => b.validacao === 'Funcionando' || b.validacao === 'Manutenção');

        if(benchesInStation.length===0) return; 

        const stCard = document.createElement('div');
        stCard.className = 'station-card';

        // Metas e Tags
        const metas = infeedMetas();
        const premissa = metas[st] || 0;
        const quantidadeBancadas = allBenchesInStation.length;
        const functioningBenchesInStation = allBenchesInStation.filter(b => b.validacao === 'Funcionando');
        const operatingCountInInfeed = functioningBenchesInStation.filter(b => b.status === 'Ocupado' && b.operando === true && b.colaboradores && b.colaboradores.length > 0).length;
        const maintenanceCountInInfeed = allBenchesInStation.filter(b => b.validacao === 'Manutenção').length;
        const freeCountInInfeed = functioningBenchesInStation.filter(b => b.status === 'Livre').length;
        const premissaClass = quantidadeBancadas < premissa ? 'premissa-danger' : 'premissa-ok';

        const metaDisplay = `
            <div class="infeed-meta-tags">
                <span class="infeed-tag" style="background-color: #e3f2fd;">Total Bancadas: <span class="value">${quantidadeBancadas}</span></span>
                <span class="infeed-tag ${premissaClass}">Meta: <span class="value">${premissa}</span></span>
                <span class="infeed-tag" style="background-color: #fce4ec;">Manutenção: <span class="value">${maintenanceCountInInfeed}</span></span>
                <span class="infeed-tag" style="background-color: #dcedc8;">Qtd Operando: <span class="value">${operatingCountInInfeed}</span></span>
                <span class="infeed-tag" style="background-color: #fff9c4;">Vagas Livres: <span class="value">${freeCountInInfeed}</span></span>
            </div>`;

        // Ordenação
        benchesInStation.sort((a, b) => {
             if (a.validacao === 'Funcionando' && b.validacao === 'Manutenção') return -1;
             if (a.validacao === 'Manutenção' && b.validacao === 'Funcionando') return 1;
             return a.nome.localeCompare(b.nome);
        });

        if (!sortState[st]) sortState[st] = { column: 'nome', direction: 'asc' };

        benchesInStation.sort((a, b) => {
            const col = sortState[st].column;
            const dir = sortState[st].direction === 'asc' ? 1 : -1;
            let valA, valB;

            if (col === 'colaborador') {
                valA = a.colaboradores && a.colaboradores.length > 0 ? a.colaboradores[0] : 'zzzz';
                valB = b.colaboradores && b.colaboradores.length > 0 ? b.colaboradores[0] : 'zzzz';
            } else {
                valA = a[col] || '';
                valB = b[col] || '';
            }

            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * dir;
            }
            return (valA - valB) * dir;
        });

        const getSortIndicator = (column, infeed) => {
            if (sortState[infeed] && sortState[infeed].column === column) {
                return sortState[infeed].direction === 'asc' ? ' ▲' : ' ▼';
            }
            return '';
        };

        stCard.innerHTML = `<div class="station-title">SETOR ${st}</div>${metaDisplay}`;
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-responsive';
        const tbl = document.createElement('table');
        tbl.innerHTML = `<thead><tr>
            <th style="width:100px">Ação</th>
            <th style="cursor:pointer;" onclick="setSort('nome', '${st}')">Bancada${getSortIndicator('nome', st)}</th>
            <th style="cursor:pointer;" onclick="setSort('lado', '${st}')">Lado${getSortIndicator('lado', st)}</th>
            <th style="cursor:pointer;" onclick="setSort('validacao', '${st}')">Validação${getSortIndicator('validacao', st)}</th>
            <th style="cursor:pointer;" onclick="setSort('status', '${st}')">Status${getSortIndicator('status', st)}</th>
            <th style="cursor:pointer;" onclick="setSort('lider', '${st}')">Líder${getSortIndicator('lider', st)}</th>
            <th style="cursor:pointer;" onclick="setSort('colaborador', '${st}')">Colaborador${getSortIndicator('colaborador', st)}</th>
            </tr></thead><tbody></tbody>`;
        const tbody = tbl.querySelector('tbody');

        benchesInStation.forEach(b=>{
            const leaderOptions = leaders().map(l=>`<option ${b.lider===l?'selected':''}>${l}</option>`).join('');
            const workerOptions = availableWorkerOptions(b.nome, b.estacao); 
            const isMaintenance = b.validacao === 'Manutenção';
            const isFree = b.status === 'Livre';
            const isOccupied = b.status === 'Ocupado';

            const hasWorker = b.colaboradores && b.colaboradores.length > 0;
            const isManuallyPaused = b.operando === false;
            const isOperating = hasWorker && !isManuallyPaused && !isMaintenance;

            let actionButtonText = '';
            let actionButtonClass = '';
            let actionButtonDisabled = false;

            if (isMaintenance) {
                actionButtonText = 'Manutenção';
                actionButtonClass = 'secondary';
                actionButtonDisabled = true;
            } else if (isFree) {
                actionButtonText = 'Livre';
                actionButtonClass = 'secondary';
                actionButtonDisabled = true;
            } else if (isOccupied) {
                actionButtonText = hasWorker ? (isManuallyPaused ? 'INICIAR' : 'PAUSAR') : 'Pausado';
                actionButtonClass = hasWorker && !isManuallyPaused ? 'danger' : 'success';
                actionButtonDisabled = !hasWorker;
            }

            const tr = document.createElement('tr');
            if(b.validacao === 'Funcionando') tr.classList.add('validacao-funcionando');
            if(b.validacao === 'Manutenção') tr.classList.add('validacao-manutencao');

            if (!isOperating && !isMaintenance) {
                tr.style.opacity = '0.7'; 
                tr.style.background = isMaintenance ? '#fff3e0' : '#f0f0f0';
            }

            tr.innerHTML = `
                <td>
                    <button class="btn ${actionButtonClass} small" onclick="toggleOperation('${b.nome}', '${b.estacao}')" ${actionButtonDisabled ? 'disabled' : ''}>${actionButtonText}</button>
                    ${isMaintenance && !b.maintenanceRegistered ? 
                        `<button class="btn small" style="margin-top:4px;" onclick="openMaintenanceRegistration('${b.nome}', '${b.estacao}')">Reg. Chamado</button>` : ''}
                    ${isMaintenance && b.maintenanceRegistered ? 
                        `<button class="btn success small" style="margin-top:4px;" onclick="reactivateBench('${b.nome}', '${b.estacao}')">Reativar</button>` : ''}
                </td>
                <td style="text-transform:uppercase; font-weight: 600;">${b.nome}</td>
                <td>${b.lado}</td>
                <td>
                    <select class="table-select select-validacao" onchange="updateBench('${b.nome}', '${b.estacao}', 'validacao', this.value); colorizeSelect(this,'validacao');" ${isMaintenance && b.maintenanceRegistered ? 'disabled' : ''}>
                        <option ${b.validacao==='Funcionando'?'selected':''}>Funcionando</option>
                        <option ${b.validacao==='Manutenção'?'selected':''}>Manutenção</option>
                    </select>
                </td>
                <td>
                    <select class="table-select select-status" onchange="updateBench('${b.nome}', '${b.estacao}', 'status', this.value); colorizeSelect(this,'status');" ${isMaintenance && b.maintenanceRegistered ? 'disabled' : ''}>
                        <option ${b.status==='Livre'?'selected':''}>Livre</option>
                        <option ${b.status==='Ocupado'?'selected':''}>Ocupado</option>
                    </select>
                </td>
                <td>
                    <select onchange="assignLeader('${b.nome}', '${b.estacao}', this.value)" ${isMaintenance && b.maintenanceRegistered ? 'disabled' : ''}>
                        <option value="">--</option>
                        ${leaderOptions}
                    </select>
                </td>
                <td>
                    <select class="select-worker" data-bench-name="${b.nome}" data-infeed="${b.estacao}" onchange="assignSingleWorker('${b.nome}', '${b.estacao}', this.value)" ${isMaintenance && b.maintenanceRegistered ? 'disabled' : ''}>
                        <option value="">--</option>
                        ${workerOptions}
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });

        stCard.appendChild(tbl);
        tableWrapper.appendChild(tbl);
        stCard.appendChild(tableWrapper);
        container.appendChild(stCard);
    });

    refreshWorkerDropdowns();
    applySelectColors();
    renderLastSnapshot();
}

/* =======================================================
   ===== Logic: Infeed Selectors (Simplificado) ==========
   ======================================================= */
function renderInfeedSelectors() {
    const allBenches = benches();
    const allFunctioningInfeeds = [...new Set(
        allBenches.filter(b => b.validacao === 'Funcionando').map(b => String(b.estacao))
    )].sort((a, b) => Number(a) - Number(b)); 
    
    const checkboxContainer = document.getElementById('infeedSelectors');
    if (checkboxContainer) {
        const checkedInfeeds = Array.from(checkboxContainer.querySelectorAll('input:checked')).map(cb => cb.value);
        checkboxContainer.innerHTML = allFunctioningInfeeds.map(i => `
            <label>
                <input type="checkbox" value="${i}" onchange="validateShuffleButtons()" ${checkedInfeeds.includes(i) ? 'checked' : ''}> 
                Setor ${i}
            </label>
        `).join('');
    }
    validateShuffleButtons();
}

function validateShuffleButtons() {
    const checkboxContainer = document.getElementById('infeedSelectors');
    const localButton = document.getElementById('localShuffleButton');
    const globalButton = document.getElementById('globalTransferButton');

    const selectedInfeeds = checkboxContainer ? Array.from(checkboxContainer.querySelectorAll('input:checked')).map(cb => cb.value) : [];
    const isReady = selectedInfeeds.length > 0;
    
    if (localButton) localButton.disabled = !isReady;
    if (globalButton) globalButton.disabled = !isReady;
}

/* ====================================================
   ===== FUNÇÃO: executeLocalShuffle ====
   ==================================================== */
function executeLocalShuffle() {
    const checkboxContainer = document.getElementById('infeedSelectors');
    const selectedInfeeds = Array.from(checkboxContainer.querySelectorAll('input:checked')).map(cb => cb.value);

    if (selectedInfeeds.length === 0) {
        alert('Selecione pelo menos um Setor para executar a rotatividade.');
        return;
    }
    
    if (!confirm(`Confirmar ROTATIVIDADE de colaboradores nos Setor(es) ${selectedInfeeds.join(', ')}?\n\nEsta ação irá girar APENAS os colaboradores já alocados dentro de cada setor selecionado.`)) {
        return;
    }

    let updatedBenches = benches();
    let history = historyArr();
    const now = new Date().toISOString();
    let totalRotatedWorkers = 0;
    let allAssignments = [];

    for (const infeed of selectedInfeeds) {
        const benchesInInfeed = updatedBenches.filter(b => 
            String(b.estacao) === infeed && b.validacao === 'Funcionando' && b.status === 'Ocupado' && b.colaboradores && b.colaboradores.length > 0
        );

        if (benchesInInfeed.length < 2) continue; 

        const evenBenches = benchesInInfeed.filter(b => b.lado === 'Par').sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }));
        const oddBenches = benchesInInfeed.filter(b => b.lado === 'Ímpar').sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }));

        const rotationPath = [...evenBenches, ...oddBenches];
        const workersInOrder = rotationPath.map(b => b.colaboradores[0]);
        const originalAssignments = rotationPath.map(b => ({ benchName: b.nome, worker: b.colaboradores[0] }));

        const lastWorker = workersInOrder.pop();
        const rotatedWorkers = [lastWorker, ...workersInOrder];

        rotationPath.forEach((bench, index) => {
            const newWorker = rotatedWorkers[index];
            const sourceAssignment = originalAssignments.find(oa => oa.worker === newWorker);
            const sourceBenchName = sourceAssignment ? sourceAssignment.benchName : 'ERRO';

            const benchIndexInMainArray = updatedBenches.findIndex(b => b.nome === bench.nome && String(b.estacao) === bench.estacao);
            
            if (benchIndexInMainArray !== -1) {
                updatedBenches[benchIndexInMainArray].colaboradores = [newWorker];
                allAssignments.push({
                    worker: newWorker, targetBench: bench.nome, targetInfeed: bench.estacao, targetLider: bench.lider,
                    sourceBench: sourceBenchName, sourceInfeed: infeed, sourceLider: 'N/A'
                });
            }
        });
        
        totalRotatedWorkers += rotationPath.length;
    }

    if (totalRotatedWorkers === 0) {
        alert("Nenhuma rotação foi possível. Verifique se há pelo menos 2 colaboradores alocados em cada setor selecionado.");
        return;
    }

    const snapshot = {
        date: now, type: `Rotatividade Local`, infeed: `Setores: ${selectedInfeeds.join(', ')}`,
        details: `${totalRotatedWorkers} colaboradores foram rotacionados.`, benchAssignments: allAssignments, mode: 'LOCAL_SHUFFLE' 
    };
    history.unshift(snapshot);
    LS.set('history', history);
    LS.set('bancadas', updatedBenches);

    alert(`Rotatividade finalizada. ${totalRotatedWorkers} colaborador(es) foram movidos.`);
    renderAll();
}

/* ====================================================
   ===== FUNÇÃO: executeGlobalTransfer ====
   ==================================================== */
function executeGlobalTransfer() {
    const allBenches = benches();
    const allFunctioningInfeeds = [...new Set(allBenches.filter(b => b.validacao === 'Funcionando').map(b => String(b.estacao)))];
    const checkboxContainer = document.getElementById('infeedSelectors');
    const selectedInfeeds = Array.from(checkboxContainer.querySelectorAll('input:checked')).map(cb => cb.value);

    if (!confirm(`Confirmar TRANSFERÊNCIA GLOBAL para os Setor(es) ${selectedInfeeds.join(', ')}?\n\nATENÇÃO: Isso irá limpar *TODAS* as bancadas operacionais e realocar *TODOS* os colaboradores (incluindo ociosos) para preencher APENAS os Setores selecionados.`)) {
        return;
    }
    executeAllocation(allFunctioningInfeeds, selectedInfeeds, `Transferência Global (Destinos: ${selectedInfeeds.join(',')})`, 'GLOBAL_TRANSFER');
}

/* ====================================================
   ===== FUNÇÃO: clearAllAllocations ====
   ==================================================== */
function clearAllAllocations() {
    if (!confirm('Tem certeza que deseja limpar TODAS as alocações?\n\nTodos os colaboradores serão movidos para a lista de "Livres" e todas as bancadas ficarão com status "Livre".')) {
        return;
    }

    let updatedBenches = benches();
    let history = historyArr();
    const now = new Date().toISOString();
    let clearedCount = 0;
    
    updatedBenches = updatedBenches.map(b => {
        if (b.status === 'Ocupado' && b.colaboradores && b.colaboradores.length > 0) clearedCount++;
        b.colaboradores = []; b.status = 'Livre'; b.operando = false;
        return b;
    });

    const snapshot = {
        date: now, type: `Limpeza Geral de Alocações`, infeed: `Todos os Setores`,
        details: `${clearedCount} colaboradores foram desalocados.`, benchAssignments: [], mode: 'CLEAR_ALL'
    };
    history.unshift(snapshot);
    LS.set('history', history);
    LS.set('bancadas', updatedBenches);
    alert(`Limpeza finalizada. ${clearedCount} colaborador(es) foram desalocados.`);
    renderAll();
}

/* ====================================================
   ===== FUNÇÃO: executeAllocation ====
   ==================================================== */
function executeAllocation(sourceInfeeds, finalTargetInfeeds, actionType, mode) {
    let updatedBenches = benches();
    let history = historyArr();
    const now = new Date().toISOString();
    
    const allWorkers = workers();
    const assignedWorkersBeforeAction = currentAssignedWorkers();
    
    let workersToMove = [];
    let workersPulledFromSources = [];

    updatedBenches = updatedBenches.map(b => {
        const infeedStr = String(b.estacao);
        if (sourceInfeeds.includes(infeedStr) && b.validacao === 'Funcionando') {
            if (b.status === 'Ocupado' && b.colaboradores && b.colaboradores.length > 0) {
                const worker = b.colaboradores[0];
                workersToMove.push(worker);
                workersPulledFromSources.push({ worker: worker, sourceBench: b.nome, sourceInfeed: infeedStr, sourceLado: b.lado, lider: b.lider });
            }
            b.colaboradores = []; b.status = 'Livre'; b.operando = false;
        }
        return b;
    });

    const initiallyIdleWorkers = allWorkers.filter(w => !assignedWorkersBeforeAction.has(w));
    workersToMove = [...new Set([...workersToMove, ...initiallyIdleWorkers])]; 
    
    if (workersToMove.length === 0 && mode !== 'GLOBAL_TRANSFER') { 
        alert('Nenhum colaborador alocado ou livre para mover.');
        LS.set('bancadas', updatedBenches); renderAll(); return;
    }

    workersToMove.sort(() => Math.random() - 0.5); 

    let targetBenches = updatedBenches.filter(b => finalTargetInfeeds.includes(String(b.estacao)) && b.validacao === 'Funcionando' && b.status === 'Livre');
        
    let assignedCount = 0;
    let benchAssignments = [];

    if (mode === 'LOCAL_SHUFFLE') {
        let parBenches = targetBenches.filter(b => b.lado === 'Par').sort(() => Math.random() - 0.5);
        let imparBenches = targetBenches.filter(b => b.lado === 'Ímpar').sort(() => Math.random() - 0.5);
        let allTargetBenches = [];
        const maxLen = Math.max(parBenches.length, imparBenches.length);
        for(let i = 0; i < maxLen; i++){
            if(parBenches[i]) allTargetBenches.push(parBenches[i]);
            if(imparBenches[i]) allTargetBenches.push(imparBenches[i]);
        }
        targetBenches = allTargetBenches; 
    } else {
        targetBenches.sort((a, b) => {
            const infeedA = Number(a.estacao); const infeedB = Number(b.estacao);
            if (infeedA !== infeedB) return infeedA - infeedB;
            return a.nome.localeCompare(b.nome, undefined, { numeric: true });
        });
    }

    for (const bench of targetBenches) {
        if (workersToMove.length === 0) break;
        const benchIndex = updatedBenches.findIndex(b => b.nome === bench.nome && String(b.estacao) === bench.estacao);
        
        if (benchIndex !== -1) {
            const worker = workersToMove.shift();
            updatedBenches[benchIndex].colaboradores = [worker];
            updatedBenches[benchIndex].status = 'Ocupado';
            updatedBenches[benchIndex].operando = true; 
            assignedCount++;
            
            const sourceDetail = workersPulledFromSources.find(w => w.worker === worker);
            benchAssignments.push({ 
                worker: worker, targetBench: bench.nome, targetInfeed: bench.estacao, targetLider: updatedBenches[benchIndex].lider,
                sourceBench: sourceDetail ? sourceDetail.sourceBench : 'Ocioso', 
                sourceInfeed: sourceDetail ? sourceDetail.sourceInfeed : 'Ocioso', sourceLider: sourceDetail ? sourceDetail.lider : 'N/A'
            });
        }
    }
    
    const infeedDescription = mode === 'GLOBAL_TRANSFER' 
        ? `Origem: TODOS Setores | Destino(s): ${finalTargetInfeeds.join(', ')}` 
        : `Rotatividade e Preenchimento nos Setores: ${finalTargetInfeeds.join(', ')}`;

    const snapshot = {
        date: now, type: `${actionType}`, infeed: infeedDescription,
        details: `${assignedCount} colaboradores alocados em ${targetBenches.length} vagas livres. ${workersToMove.length} permaneceram ociosos.`,
        benchAssignments: benchAssignments, mode: mode 
    };
    
    history.unshift(snapshot); LS.set('history', history); LS.set('bancadas', updatedBenches);
    
    const remainingWorkers = workersToMove.length;
    let alertMsg = `${actionType.split('(')[0].trim()} finalizada. ${assignedCount} colaborador(es) alocado(s).`;
    if (remainingWorkers > 0) alertMsg += ` ${remainingWorkers} colaborador(es) permaneceram livres.`;
    alert(alertMsg); renderAll();
}

/* Render Last Snapshot */
function renderLastSnapshot(){
    const h = historyArr();
    const last = h[0];
    if (!last) {
        document.getElementById('lastSnapshot').innerHTML = 'Nenhuma ação de alocação/rotatividade registrada ainda.';
        return;
    }
    
    const date = new Date(last.date).toLocaleString('pt-BR');
    let assignments = last.benchAssignments || []; 
    
    let detailsHtml = assignments.length > 0 
        ? assignments.slice(0, 5).map(a => 
            `<li><strong style="color: var(--primary-light);">${a.targetBench ? a.targetBench.toUpperCase() : 'N/A'} (S${a.targetInfeed || 'N/A'})</strong> -> ${a.worker || 'N/A'} (Líder: ${a.targetLider || 'N/A'})</li>`
        ).join('')
        : 'Nenhuma alocação específica registrada.';

    document.getElementById('lastSnapshot').innerHTML = `
        <p><strong>Tipo:</strong> ${last.type.split('(')[0].trim()} | <strong>Data:</strong> ${date}</p>
        <p style="font-size: 13px; color: var(--text-muted); font-style: italic; margin-bottom: 5px;">${last.infeed}</p>
        <p style="font-size: 14px; font-weight: 600;">${last.details}</p>
        <p style="margin-top: 10px; font-weight: bold; color: var(--primary-dark);">Primeiras Alocações:</p>
        <ul style="list-style: disc; padding-left: 20px; font-size: 13px;">${detailsHtml}</ul>
    `;
}

// FUNÇÃO REUTILIZÁVEL PARA RENDERIZAR O CONTEÚDO DO HISTÓRICO
function renderHistoryModalContent(modeFilter, contentId) {
    const h = historyArr().filter(item => item.mode === modeFilter);
    const content = document.getElementById(contentId);
    
    if (h.length === 0) {
        content.innerHTML = '<p style="color: var(--text-muted);">Nenhum histórico encontrado para este tipo de ação.</p>';
        return h;
    }
    
    let historyHTML = h.map((item, index) => {
        const dateStr = new Date(item.date).toLocaleString('pt-BR');
        let detailsTable = '';

        if (item.benchAssignments && item.benchAssignments.length > 0) {
            const assignments = item.benchAssignments;
            detailsTable = `
                <details style="margin-top: 10px; background: #f0f7ff; padding: 10px; border-radius: 6px; border: 1px solid #cceeff;">
                    <summary style="font-weight: 700; cursor: pointer; color: var(--primary-dark);">Detalhes da Alocação (${assignments.length} colaboradores)</summary>
                    <div class="table-responsive">
                    <table style="width: 100%; margin-top: 10px; font-size: 12px; border: none;">
                        <thead>
                            <tr style="background-color: #e3f2fd;">
                                <th>Colaborador</th>
                                <th>Bancada</th>
                                <th>Setor</th>
                                <th>Líder</th>
                                <th>Origem</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${assignments.map(a => `
                                <tr>
                                    <td>${a.worker || 'N/A'}</td>
                                    <td>${a.targetBench ? a.targetBench.toUpperCase() : 'N/A'}</td>
                                    <td>S${a.targetInfeed || 'N/A'}</td>
                                    <td><strong style="color: var(--primary-dark);">${a.targetLider || 'N/A'}</strong></td>
                                    <td>${a.sourceInfeed === 'Ocioso' ? 'Ocioso' : `${(a.sourceBench ? a.sourceBench.toUpperCase() : 'N/A')} (S${a.sourceInfeed || 'N/A'})`}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    </div>
                </details>
            `;
        }

        return `
            <div style="border: 1px solid var(--border-light); padding: 15px; margin-bottom: 20px; border-radius: 8px; background: var(--bg-card); box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <p style="font-size: 15px; margin: 0 0 5px 0;">
                    <strong style="color: var(--primary-dark);">${item.type.split('(')[0].trim()}</strong> | 
                    <span style="font-weight: 500; color: var(--text-muted);">${dateStr}</span>
                </p>
                <p style="font-size: 13px; margin: 0 0 5px 0; color: var(--text-muted);">
                    ${item.infeed}
                </p>
                <p style="font-size: 14px; margin: 0; font-weight: 600; color: var(--success); ">
                    ${item.details}
                </p>
                ${detailsTable}
            </div>
        `;
    }).join('');

    content.innerHTML = historyHTML;
    return h;
}

// --- Funções para Histórico de Sorteio Local (Rotatividade) ---
function openLocalShuffleHistory(){
    renderHistoryModalContent('LOCAL_SHUFFLE', 'modalLocalShuffleHistoryContent');
    document.getElementById('modalLocalShuffleHistory').classList.remove('hidden');
}
function closeLocalShuffleHistory(){
    document.getElementById('modalLocalShuffleHistory').classList.add('hidden');
}
function clearLocalShuffleHistory() {
    if (confirm('Tem certeza que deseja limpar o Histórico de Sorteio Local (Rotatividade)? Esta ação é irreversível.')) {
        const h = historyArr().filter(item => item.mode !== 'LOCAL_SHUFFLE');
        LS.set('history', h);
        closeLocalShuffleHistory();
        renderAll();
    }
}
function exportLocalShuffleHistoryToPDF() {
    const data = historyArr().filter(item => item.mode === 'LOCAL_SHUFFLE');
    exportAllocationHistoryToPDF(data, 'Histórico Sorteio Local (Rotatividade)', 'historico-sorteio-local');
}

// --- Funções para Histórico de Transferência Global (Preenchimento) ---
function openGlobalTransferHistory(){
    renderHistoryModalContent('GLOBAL_TRANSFER', 'modalGlobalTransferHistoryContent');
    document.getElementById('modalGlobalTransferHistory').classList.remove('hidden');
}
function closeGlobalTransferHistory(){
    document.getElementById('modalGlobalTransferHistory').classList.add('hidden');
}
function clearGlobalTransferHistory() {
    if (confirm('Tem certeza que deseja limpar o Histórico de Transferência Global? Esta ação é irreversível.')) {
        const h = historyArr().filter(item => item.mode !== 'GLOBAL_TRANSFER');
        LS.set('history', h);
        closeGlobalTransferHistory();
        renderAll();
    }
}
function exportGlobalTransferHistoryToPDF() {
    const data = historyArr().filter(item => item.mode === 'GLOBAL_TRANSFER');
    exportAllocationHistoryToPDF(data, 'Histórico Transferência Global', 'historico-transferencia-global');
}

// --- Funções para Histórico de Manutenção ---
function openMaintenanceHistory(){
    const h = maintenanceHistoryArr();
    const content = document.getElementById('modalMaintenanceHistoryContent');
    content.innerHTML = h.length === 0 ? '<p style="color: var(--text-muted);">Nenhum histórico de manutenção.</p>' : 
        `
        <div class="table-responsive">
        <table style="width:100%; font-size:13px;">
            <thead><tr style="background-color: var(--primary-dark); color: white;"><th>Bancada</th><th>Chamado</th><th>Status</th><th>Duração</th><th>Observação</th></tr></thead>
            <tbody>
                ${h.map(item => {
                    const duration = item.reativacao ? calculateDuration(item.date, item.reativacao) : 'Em andamento';
                    return `
                        <tr style="background-color: ${item.status === 'Reativada' ? '#e6f7e9' : '#fff3e0'};">
                            <td>${item.bench.toUpperCase()} (S${item.infeed})</td>
                            <td>${item.chamado || 'N/A'}</td>
                            <td style="font-weight: 600; color: ${item.status === 'Reativada' ? 'var(--success)' : 'var(--warning)'}">${item.status}</td>
                            <td>${duration}</td>
                            <td>${item.obs || '-'}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        </div>
        `;
    document.getElementById('modalMaintenanceHistory').classList.remove('hidden');
}

function closeMaintenanceHistory(){
    document.getElementById('modalMaintenanceHistory').classList.add('hidden');
}
function clearMaintenanceHistory() {
    if (confirm('Tem certeza que deseja limpar o Histórico de Manutenções? Esta ação é irreversível.')) {
        LS.set('maintenanceHistory', []);
        closeMaintenanceHistory();
        renderAll();
    }
}
function exportMaintenanceHistoryToPDF() {
    const data = maintenanceHistoryArr().map(item => ({
        bench: item.bench,
        infeed: item.infeed,
        status: item.status,
        duration: item.reativacao ? calculateDuration(item.date, item.reativacao) : 'Em andamento',
        chamado: item.chamado,
        obs: item.obs,
        date: item.date,
        reativacao: item.reativacao
    }));
    exportHistoryToPDF(data, 'Histórico de Manutenções', 'historico-manutencoes', true); 
}

// FUNÇÃO UNIFICADA DE EXPORTAÇÃO PARA ALOCAÇÃO
function exportAllocationHistoryToPDF(data, title, filename) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setFontSize(18);
    doc.text(title, 14, 22);

    let body = [];
    const head = ['Data/Hora', 'Colaborador', 'Destino (Bancada/Setor)', 'Líder', 'Origem (Setor)'];
    
    data.forEach(item => {
        const dateStr = new Date(item.date).toLocaleString('pt-BR');
        
        if (item.benchAssignments && item.benchAssignments.length > 0) {
            item.benchAssignments.forEach(a => {
                body.push([
                    dateStr,
                    a.worker,
                    `${(a.targetBench ? a.targetBench.toUpperCase() : 'N/A')} (S${a.targetInfeed || 'N/A'})`,
                    a.targetLider || 'N/A',
                    a.sourceInfeed === 'Ocioso' ? 'Ocioso' : `S${a.sourceInfeed || 'N/A'}`
                ]);
            });
        }
        body.push(['', '', '', '', '']); 
    });

    if (body.length > 0 && body[body.length - 1][0] === '') {
        body.pop();
    }

    doc.autoTable({
        head: [head],
        body: body,
        startY: 30,
        styles: { fontSize: 9, cellPadding: 1, overflow: 'linebreak' },
        columnStyles: { 
            0: { cellWidth: 25 },
            1: { cellWidth: 40 },
            2: { cellWidth: 50 },
            3: { cellWidth: 40 },
            4: { cellWidth: 35 },
        }
    });

    doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// FUNÇÃO UNIFICADA DE EXPORTAÇÃO PARA MANUTENÇÃO
function exportHistoryToPDF(data, title, filename, isMaintenance = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    doc.setFontSize(18);
    doc.text(title, 14, 22);

    let body = [];
    let head = [];
    
    if (isMaintenance) { 
        head = ['Bancada', 'Chamado', 'Status', 'Duração', 'Observações', 'Data Entrada'];
        body = data.map(item => [
            `${item.bench.toUpperCase()} (S${item.infeed})`,
            item.chamado || 'N/A',
            item.status,
            item.duration,
            item.obs || '-',
            new Date(item.date).toLocaleString('pt-BR')
        ]);
        
        doc.autoTable({
            head: [head],
            body: body,
            startY: 30,
            styles: { fontSize: 8, cellPadding: 1, overflow: 'linebreak' }
        });
    }

    doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/* Outras funções de utilidade */
function setSort(column, infeed) {
    if (!sortState[infeed]) sortState[infeed] = { column: 'nome', direction: 'asc' };
    if (sortState[infeed].column === column) {
        sortState[infeed].direction = sortState[infeed].direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState[infeed].column = column;
        sortState[infeed].direction = 'asc';
    }
    renderOperation();
}

function currentAssignedWorkers(){
    const s = new Set();
    benches().forEach(b => {
        if(b.colaboradores && b.colaboradores.length){
            b.colaboradores.forEach(x=>{ if(x) s.add(x); });
        }
    });
    return s;
}

function availableWorkerOptions(benchName, infeed){
    const all = workers();
    if(!all || all.length===0) return '';
    const assigned = currentAssignedWorkers(); 
    const b = benches().find(x=>x.nome===benchName && String(x.estacao) === infeed);
    const current = (b && b.colaboradores && b.colaboradores[0]) ? b.colaboradores[0] : null;
    return all.map(w => {
        if(assigned.has(w) && w !== current) return ''; 
        return `<option ${current===w ? 'selected' : ''}>${w}</option>`;
    }).join('');
}

function refreshWorkerDropdowns(){
    document.querySelectorAll('.select-worker').forEach(sel => {
        const benchName = sel.dataset.benchName;
        const infeed = sel.dataset.infeed;
        const current = sel.value;
        const opts = availableWorkerOptions(benchName, infeed);
        sel.innerHTML = `<option value="">--</option>` + opts;
        if(current){
            const optionExists = Array.from(sel.options).some(o => o.value === current);
            if(optionExists) sel.value = current; else sel.value = '';
        }
    });
}

function assignSingleWorker(benchName, infeed, value){
    const list = benches();
    const idx = list.findIndex(x=>x.nome===benchName && String(x.estacao) === infeed);
    if(idx===-1) return;
    
    if(value){
        const assigned = currentAssignedWorkers();
        if(assigned.has(value) && !(list[idx].colaboradores && list[idx].colaboradores[0] === value)){
            alert('Colaborador já está atribuído a outra bancada.');
            renderOperation(); return;
        }
        list[idx].colaboradores = [value];
        list[idx].status = 'Ocupado';
        list[idx].operando = true; 
    } else {
        list[idx].colaboradores = [];
        list[idx].status = 'Livre';
        list[idx].operando = false; 
    }
    LS.set('bancadas', list);
    renderAll(); 
}

function assignLeader(benchName, infeed, value){
    const list = benches();
    const idx = list.findIndex(x=>x.nome===benchName && String(x.estacao) === infeed);
    if(idx===-1) return;
    list[idx].lider = value || '';
    LS.set('bancadas', list);
    renderAll();
} 

function updateBench(benchName, infeed, field, value){
    const list = benches();
    const idx = list.findIndex(x=>x.nome===benchName && String(x.estacao) === infeed);
    if(idx===-1) return;

    list[idx][field] = value;
    if (field === 'status' && value === 'Livre') {
        list[idx].colaboradores = [];
        list[idx].operando = false;
    }
    if (field === 'validacao' && value === 'Manutenção') {
        list[idx].colaboradores = [];
        list[idx].status = 'Livre';
        list[idx].operando = false; 
        list[idx].maintenanceRegistered = false;
        list[idx].chamado = '';
        list[idx].obs = '';
        LS.set('bancadas', list);
        renderAll();
        setTimeout(() => openMaintenanceRegistration(benchName, infeed), 100);
        return;
    }
    LS.set('bancadas', list);
    renderAll();
}

function removeBench(name, infeed){
    if(!confirm(`Remover bancada ${name.toUpperCase()} do infeed ${infeed}?`)) return;
    const list = benches().filter(x => !(x.nome === name && String(x.estacao) === infeed));
    LS.set('bancadas', list);
    renderAll();
}

// Funções de cadastro e remoção
const addMultipleBenches = () => {
    const namesText = document.getElementById('multiBenchNames').value.trim();
    const station = String(document.getElementById('multiBenchStation').value.trim()); 
    const side = document.getElementById('multiBenchSide').value;
    if (!namesText || !station) { alert('Preencha os nomes das bancadas e o setor.'); return; }
    const names = namesText.split('\n').map(n => n.trim().toLowerCase()).filter(n => n);
    const allBenches = benches();
    const added = [];
    const skipped = [];
    names.forEach(name => {
        if (allBenches.some(b => b.nome === name && String(b.estacao) === station)) {
            skipped.push(name);
        } else {
            allBenches.push({nome:name, estacao:station, lado:side, slots:1, validacao:'Funcionando', status:'Livre', lider:'', colaboradores:[], operando: true, chamado: '', obs: '', maintenanceRegistered: false});
            added.push(name);
        }
    });
    LS.set('bancadas', allBenches);
    document.getElementById('multiBenchNames').value = '';
    alert(`Adicionadas: ${added.length}\nIgnoradas (já existentes no mesmo setor): ${skipped.length}`);
    renderAll();
};

function addMultipleItems(type, textareaId) {
    const namesText = document.getElementById(textareaId).value.trim();
    if (!namesText) return;
    const names = namesText.split('\n').map(n => n.trim()).filter(n => n);
    const existingList = new Set(LS.get(type) || []);
    let addedCount = 0;
    names.forEach(name => {
        if (!existingList.has(name)) {
            existingList.add(name);
            addedCount++;
        }
    });
    LS.set(type, Array.from(existingList));
    document.getElementById(textareaId).value = '';
    alert(`${addedCount} novo(s) item(ns) adicionado(s) à lista de ${type}.`);
    renderAll();
}

const addMultipleLeaders = () => addMultipleItems('lideres', 'leaderNames');
const addMultipleWorkers = () => addMultipleItems('colaboradores', 'workerNames');

function removeItem(type, name) {
    if(!confirm(`Remover ${name} da lista de ${type}?`)) return;
    let list = LS.get(type) || [];
    list = list.filter(item => item !== name);
    LS.set(type, list);

    if (type === 'colaboradores') {
        const updatedBenches = benches().map(b => {
            if (b.colaboradores && b.colaboradores.includes(name)) {
                b.colaboradores = [];
                b.status = 'Livre';
                b.operando = false;
            }
            return b;
        });
        LS.set('bancadas', updatedBenches);
    }
    if (type === 'lideres') {
        const updatedBenches = benches().map(b => {
            if (b.lider === name) {
                b.lider = '';
            }
            return b;
        });
        LS.set('bancadas', updatedBenches);
    }
    renderAll();
}

function renderLeadersAndWorkers() {
    const lList = leaders().sort();
    const wList = workers().sort();
    const lDiv = document.getElementById('listLeaders');
    const wDiv = document.getElementById('listWorkers');
    lDiv.innerHTML = lList.map(l => `<div class="shuffle-item">${l}<button class="btn danger small" onclick="removeItem('lideres', '${l}')">Remover</button></div>`).join('');
    wDiv.innerHTML = wList.map(w => `<div class="shuffle-item">${w}<button class="btn danger small" onclick="removeItem('colaboradores', '${w}')">Remover</button></div>`).join('');
    document.getElementById('leadersCount').textContent = `(${lList.length})`;
    document.getElementById('workersCount').textContent = `(${wList.length})`;
}

function toggleOperation(benchName, infeed) {
    const list = benches();
    const idx = list.findIndex(x=>x.nome===benchName && String(x.estacao) === infeed);
    if(idx===-1) return;
    
    if (list[idx].status === 'Ocupado' && list[idx].colaboradores && list[idx].colaboradores.length > 0) {
        list[idx].operando = !list[idx].operando; 
        LS.set('bancadas', list);
        renderAll();
    } else {
        alert('A bancada precisa estar "Ocupada" e com um colaborador atribuído para iniciar/pausar a operação.');
    }
}

function renderBenchesTable() {
    const allBenches = benches();
    const filterValue = document.getElementById('infeedFilterSelect').value;
    const filteredBenches = filterValue 
        ? allBenches.filter(b => String(b.estacao) === filterValue) 
        : allBenches;

    const tableBody = document.querySelector('#tableBenches tbody');
    tableBody.innerHTML = '';
    document.getElementById('benchesCount').textContent = `(${filteredBenches.length})`;

    filteredBenches.forEach(b => {
        const tr = document.createElement('tr');
        const statusClass = b.validacao === 'Funcionando' 
            ? (b.status === 'Livre' ? 'validacao-funcionando' : 'validacao-funcionando')
            : 'validacao-manutencao';
        tr.className = statusClass;
        tr.innerHTML = `
            <td style="font-weight: 600;">${b.nome.toUpperCase()}</td>
            <td>${b.estacao}</td>
            <td>${b.lado}</td>
            <td>${b.slots}</td>
            <td>
                <select class="table-select select-validacao ${b.validacao.toLowerCase()}" onchange="updateBench('${b.nome}', '${b.estacao}', 'validacao', this.value); colorizeSelect(this,'validacao');">
                    <option ${b.validacao==='Funcionando'?'selected':''}>Funcionando</option>
                    <option ${b.validacao==='Manutenção'?'selected':''}>Manutenção</option>
                </select>
            </td>
            <td>
                <select class="table-select select-status ${b.status.toLowerCase()}" onchange="updateBench('${b.nome}', '${b.estacao}', 'status', this.value); colorizeSelect(this,'status');">
                    <option ${b.status==='Livre'?'selected':''}>Livre</option>
                    <option ${b.status==='Ocupado'?'selected':''}>Ocupado</option>
                </select>
            </td>
            <td><button class="btn danger small" onclick="removeBench('${b.nome}', '${b.estacao}')">Remover</button></td>
        `;
        tableBody.appendChild(tr);
    });

    applySelectColors();
}

function openMaintenanceRegistration(name, infeed){
    const bench = benches().find(b => b.nome === name && String(b.estacao) === infeed);
    if (!bench) return;

    document.getElementById('maintenanceBenchName').textContent = name.toUpperCase();
    document.getElementById('currentBenchName').value = name;
    document.getElementById('currentInfeed').value = infeed;
    document.getElementById('maintenanceChamado').value = bench.chamado || '';
    document.getElementById('maintenanceObs').value = bench.obs || '';
    document.getElementById('modalMaintenance').classList.remove('hidden');
}

function closeMaintenanceRegistration(){
    document.getElementById('modalMaintenance').classList.add('hidden');
}

function registerMaintenance(){
    const name = document.getElementById('currentBenchName').value;
    const infeed = document.getElementById('currentInfeed').value;
    const chamado = document.getElementById('maintenanceChamado').value.trim();
    const obs = document.getElementById('maintenanceObs').value.trim();
    
    if(!chamado && !obs){
        alert('É necessário preencher pelo menos o chamado ou a observação.');
        return;
    }

    const list = benches();
    const idx = list.findIndex(x=>x.nome===name && String(x.estacao) === infeed);
    if(idx === -1) return;

    // Atualiza a bancada
    list[idx].chamado = chamado;
    list[idx].obs = obs;
    list[idx].maintenanceRegistered = true;
    
    // Move para histórico
    const h = maintenanceHistoryArr();
    const now = new Date().toISOString();
    h.unshift({
        bench: name,
        infeed: infeed,
        date: now,
        action: 'Registrado Chamado',
        chamado: chamado,
        obs: obs,
        reativacao: null,
        status: 'Em Manutenção'
    });

    LS.set('bancadas', list);
    LS.set('maintenanceHistory', h);

    closeMaintenanceRegistration();
    alert(`Manutenção de ${name.toUpperCase()} registrada.`);
    renderAll();
}

function reactivateBench(benchName, infeed) {
    if (!confirm(`Confirmar a reativação da bancada ${benchName.toUpperCase()} do Setor ${infeed}?`)) return;

    const list = benches();
    const idx = list.findIndex(x => x.nome === benchName && String(x.estacao) === infeed);
    if (idx === -1) return;

    // 1. Atualiza a bancada
    const b = list[idx];
    b.validacao = 'Funcionando';
    b.status = 'Livre';
    const chamado = b.chamado; 
    b.chamado = ''; 
    b.obs = ''; 
    b.maintenanceRegistered = false;

    // 2. Registra no histórico
    const h = maintenanceHistoryArr();
    const now = new Date().toISOString();
    
    // Tenta encontrar o registro de entrada
    const lastEntryIndex = h.findIndex(item => item.bench === benchName && item.infeed === infeed && item.status === 'Em Manutenção' && item.reativacao === null);
    
    let entryDate = now;
    if(lastEntryIndex !== -1){
        h[lastEntryIndex].reativacao = now;
        h[lastEntryIndex].status = 'Reativada';
        entryDate = h[lastEntryIndex].date;
    } else {
        // Se não encontrar, cria um registro de entrada básico para fechar
        h.unshift({
            bench: benchName, infeed: infeed, date: now, action: 'Reativação (Sem Registro Prévio)',
            chamado: chamado, obs: '', reativacao: now, status: 'Reativada'
        });
    }

    LS.set('bancadas', list);
    LS.set('maintenanceHistory', h);
    alert(`Bancada ${benchName.toUpperCase()} reativada.`);
    renderAll();
}

/* Lógica de renderização e salvamento de metas */
function updateInfeedGoalSelectors() {
    const allInfeeds = [...new Set(benches().map(b => String(b.estacao)))].sort((a,b)=>a-b);
    const select = document.getElementById('selectGoalInfeed');
    const currentSelected = select.value;
    select.innerHTML = `<option value="">Selecione um Setor</option>` + 
        allInfeeds.map(i => `<option value="${i}">Setor ${i}</option>`).join('');

    if (currentSelected && allInfeeds.includes(currentSelected)) {
        select.value = currentSelected;
    } else {
        select.value = "";
    }
    updateGoalInput();
}

function updateGoalInput() {
    const select = document.getElementById('selectGoalInfeed');
    const input = document.getElementById('goalInput');
    const button = document.getElementById('saveGoalButton');
    const selectedInfeed = select.value;
    const metas = infeedMetas();

    if (selectedInfeed) {
        input.disabled = false;
        button.disabled = false;
        input.value = metas[selectedInfeed] || 0;
    } else {
        input.disabled = true;
        button.disabled = true;
        input.value = '';
    }
}

function saveInfeedGoal(){
    const select = document.getElementById('selectGoalInfeed');
    const input = document.getElementById('goalInput');
    const infeed = select.value;
    const goal = parseInt(input.value) || 0;

    if (!infeed) {
        alert('Selecione um Setor antes de salvar a meta.');
        return;
    }
    
    const metas = infeedMetas();
    metas[infeed] = goal;
    LS.set('infeedMetas', metas);
    alert(`Meta para o Setor ${infeed} salva: ${goal}`);
    renderAll();
}

function updateInfeedSelectors(){
    const allInfeeds = [...new Set(benches().map(b => String(b.estacao)))].sort((a,b)=>a-b);
    const optionsHTML = allInfeeds.map(i => `<option value="${i}">Setor ${i}</option>`).join('');

    // Filtro da Tabela
    const filterSelect = document.getElementById('infeedFilterSelect');
    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = `<option value="">Todos</option>${optionsHTML}`;
    if(currentFilter && allInfeeds.includes(currentFilter)) filterSelect.value = currentFilter;

    // Seletor de Metas (Premissas)
    updateInfeedGoalSelectors();

    // Seletor de alocação (Novo)
    renderInfeedSelectors();
}

/* Render Summary */
function renderSummary(){
    const all = benches();
    const total = all.length;
    const functioning = all.filter(b => b.validacao === 'Funcionando');
    const free = functioning.filter(b => b.status === 'Livre').length;
    const occupied = functioning.filter(b => b.status === 'Ocupado').length;
    const maintenance = all.filter(b => b.validacao === 'Manutenção').length;
    const operating = functioning.filter(b => b.status === 'Ocupado' && b.operando === true).length;

    document.getElementById('totalBenchesSummary').textContent = `${total}`;
    document.getElementById('freeBenchesSummary').textContent = `${free}`;
    document.getElementById('occupiedBenchesSummary').textContent = `${occupied}`;
    document.getElementById('maintenanceBenchesSummary').textContent = `${maintenance}`;
    document.getElementById('operationSummary').textContent = `${operating}`;
    
    const totalFunctioning = total - maintenance;
    const performance = totalFunctioning > 0 ? (operating / totalFunctioning) * 100 : 0;
    
    // Renderiza o gráfico de performance
    const chartContainer = document.getElementById('performanceChartContainer');
    const radius = 45; // Ajuste para o viewBox 120
    const circle = 2 * Math.PI * radius; 
    const offset = circle - (circle * performance / 100);
    
    chartContainer.innerHTML = `
        <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
            <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#e0e0e0" stroke-width="8"/>
            <circle cx="50" cy="50" r="${radius}" fill="none" stroke="var(--primary-dark)" stroke-width="8" 
                stroke-dasharray="${circle}" stroke-dashoffset="${offset}" 
                transform="rotate(-90 50 50)" style="transition: stroke-dashoffset 0.5s;"/>
        </svg>
        <div class="summary-chart-text" style="color: var(--primary-dark);">${performance.toFixed(0)}%</div>
    `;
}

/* Render Idle Workers */
function renderIdleWorkers(){
    const allWorkers = workers();
    const assigned = currentAssignedWorkers();
    const idleWorkers = allWorkers.filter(w => !assigned.has(w)).sort();

    document.getElementById('idleWorkersSummary').innerHTML = `<span style="font-size:32px; font-weight:800; color:var(--primary-light)">${idleWorkers.length}</span>`;
    
    const listDiv = document.getElementById('idleWorkersList');
    listDiv.innerHTML = '';

    if(idleWorkers.length === 0){
        listDiv.innerHTML = '<p style="text-align:center; color:var(--success); margin-top: 15px; font-weight: 600;">Todos os colaboradores estão alocados nas bancadas em operação.</p>';
    } else {
        idleWorkers.forEach(w => {
            const div = document.createElement('div');
            div.className = 'shuffle-item';
            div.textContent = w;
            listDiv.appendChild(div);
        });
    }
}

function calculateDuration(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate) || isNaN(endDate)) return 'Data Inválida';

    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) return 'Data Inválida';

    const diffSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(diffSeconds / (3600 * 24));
    const hours = Math.floor((diffSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    result += `${minutes}m`;
    
    return result.trim() || 'Menos de 1m';
}

function colorizeSelect(selectElement, type) {
    selectElement.classList.remove('funcionando', 'manutencao', 'livre', 'ocupado');
    const value = selectElement.value.toLowerCase().replace(/ /g, '');
    selectElement.classList.add(value);
}

function applySelectColors() {
    document.querySelectorAll('.select-validacao').forEach(s => colorizeSelect(s, 'validacao'));
    document.querySelectorAll('.select-status').forEach(s => colorizeSelect(s, 'status'));
}

function renderAll() {
    renderOperation();
    renderSummary(); 
    renderIdleWorkers();
    updateInfeedSelectors();
    if (document.getElementById('screen-cadastro').style.display !== 'none') {
        renderBenchesTable();
        renderLeadersAndWorkers();
    }
}

document.addEventListener('DOMContentLoaded', renderAll);
window.onload = renderAll;