if (typeof supabase === 'undefined') {
    document.getElementById('empty').hidden = false;
    document.getElementById('emptyTitle').textContent = 'Could not load the database library';
    document.getElementById('emptyText').textContent = 'Check your internet connection, and that the Supabase script line is in admin.html above admin.js.';
    throw new Error('Supabase library not loaded');
}

const db = supabase.createClient(
    'https://njgozrsxoaepylosccup.supabase.co',
    'sb_publishable_UrExMosH6ieQZ0K1omjGaA_eYRi7dmz'
);
const LOGIN_PAGE = 'Login.html';
const USER_PAGE = 'CareSync.html';

let appointments = [];
let loadError = '';

const listBox = document.getElementById('list');
const emptyBox = document.getElementById('empty');
const emptyTitle = document.getElementById('emptyTitle');
const emptyText = document.getElementById('emptyText');
const tabs = document.querySelectorAll('.tab');

const editDialog = document.getElementById('editDialog');
const editForm = document.getElementById('editForm');
const editError = document.getElementById('editError');
const fields = {
    patient: document.getElementById('editPatient'),
    patientType: document.getElementById('editPatientType'),
    doctor: document.getElementById('editDoctor'),
    department: document.getElementById('editDepartment'),
    date: document.getElementById('editDate'),
    time: document.getElementById('editTime'),
    reason: document.getElementById('editReason'),
    notes: document.getElementById('editNotes')
};

let currentFilter = 'upcoming';
let editingRef = null;

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

async function loadAppointments() {
    const { data, error } = await db.from('appointments').select('*');
    if (error) { loadError = error.message; return false; }
    appointments = data.map(fromRow);
    return true;
}

async function reload() {
    const ok = await loadAppointments();
    if (!ok) {
        listBox.innerHTML = '';
        emptyBox.hidden = false;
        emptyTitle.textContent = 'Could not load appointments';
        emptyText.textContent = 'Reason: ' + loadError;
        return;
    }
    render();
}

function startOf(a) {
    const [y, m, d] = a.date.split('-').map(Number);
    const [h, min] = a.time.split(':').map(Number);
    return new Date(y, m - 1, d, h, min);
}

function prettyDate(value) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-PH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function timeLabel(value) {
    const [h, m] = value.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return hour + ':' + pad(m) + ' ' + suffix;
}

// Three states only: upcoming (still open), cancelled, completed (moved to Records)
function stateOf(a) {
    if (a.status === 'Cancelled') return 'cancelled';
    if (a.status === 'Completed') return 'completed';
    return 'upcoming';
}

// Completed appointments never show here. They live in Records.html.
function matches(a, filter) {
    const state = stateOf(a);
    if (state === 'completed') return false;
    return filter === 'all' || state === filter;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function actionButton(label, action, ref, className) {
    const btn = el('button', className || '', label);
    btn.type = 'button';
    btn.dataset.action = action;
    btn.dataset.ref = ref;
    return btn;
}

function buildCard(a) {
    const state = stateOf(a);
    const card = el('article', 'card' + (state === 'cancelled' ? ' cancelled' : ''));

    const head = el('div', 'card-head');
    const titleWrap = el('div');
    titleWrap.appendChild(el('h3', '', a.doctor));
    titleWrap.appendChild(el('p', 'ref', 'Reference ' + a.ref));
    head.appendChild(titleWrap);

    const badgeText = state === 'cancelled' ? 'Cancelled' : (a.status || 'Pending');
    const badgeClass = state === 'cancelled' ? 'cancelled' : 'pending';
    head.appendChild(el('span', 'badge ' + badgeClass, badgeText));
    card.appendChild(head);

    const rows = [
        ['Patient', a.patient],
        ['Department', a.department],
        ['Date', prettyDate(a.date)],
        ['Time', timeLabel(a.time)],
        ['Reason', a.reason],
        ['Patient type', a.patientType]
    ];
    const dl = el('dl', 'details');
    rows.forEach(([k, v]) => {
        const row = el('div');
        row.appendChild(el('dt', '', k));
        row.appendChild(el('dd', '', v || '-'));
        dl.appendChild(row);
    });
    card.appendChild(dl);

    if (a.notes) card.appendChild(el('p', 'notes', 'Notes: ' + a.notes));

    const actions = el('div', 'card-actions');
    if (state === 'upcoming') {
        actions.appendChild(actionButton('Completed', 'complete', a.ref, 'complete'));
    }
    actions.appendChild(actionButton('Edit', 'edit', a.ref));
    if (state === 'upcoming') {
        actions.appendChild(actionButton('Cancel appointment', 'cancel', a.ref, 'muted'));
    }
    actions.appendChild(actionButton('Delete', 'delete', a.ref, 'danger'));
    card.appendChild(actions);

    return card;
}

function render() {
    const all = appointments;

    ['upcoming', 'cancelled', 'all'].forEach(f => {
        document.getElementById('count-' + f).textContent = all.filter(a => matches(a, f)).length;
    });

    const shown = all.filter(a => matches(a, currentFilter));
    shown.sort((a, b) => currentFilter === 'upcoming' ? startOf(a) - startOf(b) : startOf(b) - startOf(a));

    listBox.innerHTML = '';
    shown.forEach(a => listBox.appendChild(buildCard(a)));

    emptyBox.hidden = shown.length > 0;
    if (!shown.length) {
        const hasOpen = all.some(a => stateOf(a) !== 'completed');
        if (!hasOpen) {
            emptyTitle.textContent = 'No appointments yet';
            emptyText.textContent = 'When you book an appointment, it will show up here.';
        } else {
            emptyTitle.textContent = 'Nothing to show here';
            emptyText.textContent = 'You have no ' + (currentFilter === 'all' ? '' : currentFilter + ' ') + 'appointments.';
        }
    }
}

function openEdit(item) {
    editingRef = item.ref;
    Object.keys(fields).forEach(key => {
        fields[key].value = item[key] || '';
    });
    editError.hidden = true;
    editDialog.showModal();
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        currentFilter = tab.dataset.filter;
        tabs.forEach(t => {
            const active = t === tab;
            t.classList.toggle('active', active);
            t.setAttribute('aria-selected', String(active));
        });
        render();
    });
});

listBox.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const ref = btn.dataset.ref;
    const action = btn.dataset.action;
    const item = appointments.find(a => a.ref === ref);
    if (!item) return;

    if (action === 'complete') {
        const { error } = await db.from('appointments')
            .update({ status: 'Completed', completed_at: new Date().toISOString() }).eq('ref', ref);
        if (error) { alert('Could not mark the appointment as completed. Please try again.'); return; }
        window.location.href = 'Records.html?ref=' + encodeURIComponent(ref);
        return;
    }

    if (action === 'edit') {
        openEdit(item);
    }

    if (action === 'cancel') {
        if (!confirm('Cancel this appointment? The time slot will be released.')) return;
        const { error } = await db.from('appointments').update({ status: 'Cancelled' }).eq('ref', ref);
        if (error) { alert('Could not cancel the appointment. Please try again.'); return; }
        await reload();
    }

    if (action === 'delete') {
        if (!confirm('Delete this appointment permanently? This cannot be undone.')) return;
        const { error } = await db.from('appointments').delete().eq('ref', ref);
        if (error) { alert('Could not delete the appointment. Please try again.'); return; }
        await reload();
    }
});

editForm.addEventListener('submit', async e => {
    e.preventDefault();

    const values = {};
    Object.keys(fields).forEach(key => {
        values[key] = fields[key].value.trim();
    });

    if (!values.patient || !values.doctor || !values.date || !values.time) {
        editError.textContent = 'Please fill in the patient, doctor, date and time.';
        editError.hidden = false;
        return;
    }

    const { error } = await db.from('appointments').update({
        patient: values.patient,
        patient_type: values.patientType,
        doctor: values.doctor,
        department: values.department,
        appt_date: values.date,
        appt_time: values.time,
        reason: values.reason,
        notes: values.notes
    }).eq('ref', editingRef);

    if (error) {
        editError.textContent = error.code === '23505'
            ? 'That doctor already has an appointment at this date and time.'
            : 'Could not save your changes. Please try again.';
        editError.hidden = false;
        return;
    }

    editDialog.close();
    await reload();
});

document.getElementById('editCancel').addEventListener('click', () => editDialog.close());

async function guard() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { location.replace(LOGIN_PAGE); return false; }

    const { data: profile, error } = await db.from('profiles')
        .select('role').eq('id', session.user.id).single();

    if (error || !profile || profile.role !== 'admin') {
        location.replace(USER_PAGE);
        return false;
    }

    document.getElementById('adminEmail').textContent = session.user.email;
    document.body.style.visibility = 'visible';
    return true;
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await db.auth.signOut();
    location.replace(LOGIN_PAGE);
});

(async function start() {
    if (!(await guard())) return;
    await reload();
})();
