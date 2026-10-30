if (typeof supabase === 'undefined') {
    document.getElementById('listEmpty').hidden = false;
    document.getElementById('listEmptyTitle').textContent = 'Could not load the database library';
    document.getElementById('listEmptyText').textContent = 'Check your internet connection, and that the Supabase script line is in records.html above records.js.';
    throw new Error('Supabase library not loaded');
}

const db = supabase.createClient('https://njgozrsxoaepylosccup.supabase.co', 'sb_publishable_UrExMosH6ieQZ0K1omjGaA_eYRi7dmz');

let completedAppointments = [];
let archivedIds = new Set();
let loadError = '';

const $ = id => document.getElementById(id);
const listEl = $('patientList');
const detailEl = $('detail');
const placeholder = $('placeholder');
const searchEl = $('search');
const tabs = document.querySelectorAll('.tab');

let patients = [];
let selectedId = '';
let currentFilter = 'active';
let query = '';

function pad(n) {
    return String(n).padStart(2, '0');
}

function fromRow(r) {
    return {
        ref: r.ref,
        patient: r.patient,
        birthdate: r.birthdate,
        phone: r.phone,
        email: r.email,
        forWho: r.for_who,
        patientType: r.patient_type,
        department: r.department,
        doctor: r.doctor,
        reason: r.reason,
        notes: r.notes,
        date: r.appt_date,
        time: String(r.appt_time).slice(0, 5),
        status: r.status
    };
}

async function loadData() {
    const [apps, arch] = await Promise.all([
        db.from('appointments').select('*').eq('status', 'Completed'),
        db.from('archived_patients').select('patient_id')
    ]);
    if (apps.error || arch.error) { loadError = (apps.error || arch.error).message; return false; }
    completedAppointments = apps.data.map(fromRow);
    archivedIds = new Set(arch.data.map(row => row.patient_id));
    return true;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function startOf(a) {
    const [y, m, d] = a.date.split('-').map(Number);
    const [h, min] = a.time.split(':').map(Number);
    return new Date(y, m - 1, d, h, min);
}

function prettyDate(value) {
    if (!value) return '-';
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-PH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function shortDate(value) {
    if (!value) return '-';
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-PH', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function timeLabel(value) {
    const [h, m] = value.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return hour + ':' + pad(m) + ' ' + suffix;
}

function ageFrom(birthdate) {
    if (!birthdate) return '';
    const [y, m, d] = birthdate.split('-').map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    return age >= 0 ? age : '';
}

// Records only holds completed visits, so every visit here shows as Completed.
function stateOf(a) {
    if (a.status === 'Completed') return 'past';
    if (a.status === 'Cancelled') return 'cancelled';
    return startOf(a) < new Date() ? 'past' : 'upcoming';
}

function makeId(a) {
    const text = [
        (a.patient || '').trim().toLowerCase(),
        a.birthdate || '',
        (a.phone || '').replace(/\D/g, '')
    ].join('|');
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return 'P-' + hash.toString(36).toUpperCase().padStart(7, '0');
}

function buildPatients() {
    const map = new Map();
    // Only appointments marked "Completed" in the admin page appear in Records
    const all = completedAppointments;

    all.forEach(a => {
        const id = makeId(a);
        if (!map.has(id)) {
            map.set(id, { id, name: a.patient, birthdate: a.birthdate, phone: a.phone, email: a.email, visits: [] });
        }
        map.get(id).visits.push(a);
    });

    patients = Array.from(map.values());
    patients.forEach(p => {
        p.visits.sort((x, y) => startOf(y) - startOf(x));
        const latest = p.visits[0];
        p.phone = latest.phone;
        p.email = latest.email;
        p.patientType = latest.patientType;
        p.forWho = latest.forWho;
    });
    patients.sort((a, b) => a.name.localeCompare(b.name));
}

function archivedSet() {
    return archivedIds;
}

function matchesFilter(p, archived) {
    const isArchived = archived.has(p.id);
    if (currentFilter === 'active') return !isArchived;
    if (currentFilter === 'archived') return isArchived;
    return true;
}

function matchesQuery(p) {
    if (!query) return true;
    const hay = [p.name, p.phone, p.email, p.id].concat(p.visits.map(v => v.ref)).join(' ').toLowerCase();
    return hay.includes(query);
}

function renderCounts(archived) {
    $('count-active').textContent = patients.filter(p => !archived.has(p.id)).length;
    $('count-archived').textContent = patients.filter(p => archived.has(p.id)).length;
    $('count-all').textContent = patients.length;
}

function renderList() {
    const archived = archivedSet();
    renderCounts(archived);

    const shown = patients.filter(p => matchesFilter(p, archived) && matchesQuery(p));
    listEl.innerHTML = '';

    shown.forEach(p => {
        const li = el('li');
        const btn = el('button', 'patient-btn' + (p.id === selectedId ? ' selected' : ''));
        btn.type = 'button';
        btn.dataset.id = p.id;

        const top = el('div', 'row');
        top.appendChild(el('strong', '', p.name));
        if (archived.has(p.id)) top.appendChild(el('span', 'badge archived', 'Archived'));
        btn.appendChild(top);

        const meta = p.visits.length + (p.visits.length === 1 ? ' completed visit' : ' completed visits');
        btn.appendChild(el('span', 'meta', meta));

        li.appendChild(btn);
        listEl.appendChild(li);
    });

    const empty = $('listEmpty');
    empty.hidden = shown.length > 0;
    if (!shown.length) {
        if (!patients.length) {
            $('listEmptyTitle').textContent = 'No patient records yet';
            $('listEmptyText').textContent = 'Records appear here after an appointment is marked as completed.';
        } else {
            $('listEmptyTitle').textContent = 'No matching records';
            $('listEmptyText').textContent = 'Try a different search or filter.';
        }
    }
}

function field(label, value) {
    const row = el('div');
    row.appendChild(el('dt', '', label));
    row.appendChild(el('dd', '', value || '-'));
    return row;
}

function renderDetail() {
    const p = patients.find(x => x.id === selectedId);
    if (!p) {
        detailEl.hidden = true;
        placeholder.hidden = false;
        return;
    }

    const archived = archivedSet().has(p.id);
    placeholder.hidden = true;
    detailEl.hidden = false;
    detailEl.innerHTML = '';

    const head = el('div', 'detail-head');
    const titleWrap = el('div');
    titleWrap.appendChild(el('h2', '', p.name));
    titleWrap.appendChild(el('p', 'ref', 'Patient ID ' + p.id));
    head.appendChild(titleWrap);

    const actions = el('div', 'head-actions');
    const printBtn = el('button', 'ghost', 'Print record');
    printBtn.type = 'button';
    printBtn.addEventListener('click', () => window.print());
    const archiveBtn = el('button', archived ? 'ghost' : 'danger', archived ? 'Restore to active' : 'Archive record');
    archiveBtn.type = 'button';
    archiveBtn.addEventListener('click', () => toggleArchive(p.id));
    actions.appendChild(printBtn);
    actions.appendChild(archiveBtn);
    head.appendChild(actions);
    detailEl.appendChild(head);

    if (archived) detailEl.appendChild(el('p', 'archive-note', 'This record is archived. It is kept for reference and hidden from the active list.'));

    const age = ageFrom(p.birthdate);
    const info = el('dl', 'info');
    info.appendChild(field('Birthdate', shortDate(p.birthdate) + (age !== '' ? ' (' + age + ' years old)' : '')));
    info.appendChild(field('Contact number', p.phone));
    info.appendChild(field('Email', p.email));
    info.appendChild(field('Latest patient type', p.patientType));
    info.appendChild(field('Total completed visits', String(p.visits.length)));
    info.appendChild(field('Booked for', p.forWho === 'someone else' ? 'Someone else (booked by another person)' : 'Self'));
    detailEl.appendChild(info);

    detailEl.appendChild(el('h3', '', 'Visit history'));
    const history = el('div', 'history');

    p.visits.forEach(v => {
        const state = stateOf(v);
        const card = el('article', 'visit' + (state === 'cancelled' ? ' cancelled' : ''));
        card.id = 'visit-' + v.ref;
        if (v.ref === highlightRef) card.classList.add('highlight');

        const vh = el('div', 'row');
        vh.appendChild(el('strong', '', prettyDate(v.date) + ' at ' + timeLabel(v.time)));
        vh.appendChild(el('span', 'badge completed', 'Completed'));
        card.appendChild(vh);

        const dl = el('dl', 'visit-details');
        dl.appendChild(field('Doctor', v.doctor));
        dl.appendChild(field('Department', v.department));
        dl.appendChild(field('Reason', v.reason));
        dl.appendChild(field('Reference', v.ref));
        card.appendChild(dl);

        if (v.notes) card.appendChild(el('p', 'notes', 'Notes: ' + v.notes));
        history.appendChild(card);
    });

    detailEl.appendChild(history);
}

function select(id, scroll) {
    selectedId = id;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('patient', id);
    else url.searchParams.delete('patient');
    url.searchParams.delete('ref');
    history.replaceState(null, '', url);

    renderList();
    renderDetail();

    if (scroll) {
        const target = highlightRef ? document.getElementById('visit-' + highlightRef) : null;
        (target || $('detailPane')).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function toggleArchive(id) {
    if (archivedIds.has(id)) {
        const { error } = await db.from('archived_patients').delete().eq('patient_id', id);
        if (error) { alert('Could not restore this record. Please try again.'); return; }
        archivedIds.delete(id);
    } else {
        if (!confirm('Archive this patient record? It will be hidden from the active list but kept for reference.')) return;
        const { error } = await db.from('archived_patients').insert({ patient_id: id });
        if (error) { alert('Could not archive this record. Please try again.'); return; }
        archivedIds.add(id);
    }
    renderList();
    renderDetail();
}

listEl.addEventListener('click', e => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    highlightRef = '';
    select(btn.dataset.id, window.innerWidth < 800);
});

searchEl.addEventListener('input', () => {
    query = searchEl.value.trim().toLowerCase();
    renderList();
});

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        currentFilter = tab.dataset.filter;
        tabs.forEach(t => {
            const active = t === tab;
            t.classList.toggle('active', active);
            t.setAttribute('aria-selected', String(active));
        });
        renderList();
    });
});

let highlightRef = '';

(async function init() {
    if (!(await loadData())) {
        $('listEmpty').hidden = false;
        $('listEmptyTitle').textContent = 'Could not load records';
        $('listEmptyText').textContent = 'Reason: ' + loadError;
        return;
    }
    buildPatients();

    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    const patientParam = params.get('patient');

    let targetId = '';
    if (refParam) {
        const owner = patients.find(p => p.visits.some(v => v.ref === refParam));
        if (owner) {
            targetId = owner.id;
            highlightRef = refParam;
        }
    } else if (patientParam && patients.some(p => p.id === patientParam)) {
        targetId = patientParam;
    }

    if (targetId && archivedSet().has(targetId)) {
        currentFilter = 'archived';
        tabs.forEach(t => {
            const active = t.dataset.filter === 'archived';
            t.classList.toggle('active', active);
            t.setAttribute('aria-selected', String(active));
        });
    }

    renderList();
    if (targetId) select(targetId, true);
    else renderDetail();
})();