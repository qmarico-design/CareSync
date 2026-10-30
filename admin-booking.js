const doctors = {
    "General Medicine": [
        { name: "Dr. Maria Santos", days: [1, 2, 3, 4, 5] },
        { name: "Dr. Paolo Reyes", days: [1, 3, 5, 6] }
    ],
    "Pediatrics": [
        { name: "Dr. Ana Cruz", days: [1, 2, 4, 6] }
    ],
    "Cardiology": [
        { name: "Dr. Luis Mendoza", days: [2, 4, 6] },
        { name: "Dr. Grace Lim", days: [1, 3, 5] }
    ]
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const db = supabase.createClient('https://njgozrsxoaepylosccup.supabase.co', 'sb_publishable_UrExMosH6ieQZ0K1omjGaA_eYRi7dmz');
let takenTimes = new Set();
let slotRequest = 0;

const times = [];
for (let h = 8; h < 17; h++) {
    for (const m of [0, 30]) {
        if (h === 12) continue;
        times.push({ h, m });
    }
}

const $ = id => document.getElementById(id);
const form = $('bookingForm');
const fields = {
    fullName: $('fullName'),
    birthdate: $('birthdate'),
    phone: $('phone'),
    email: $('email'),
    department: $('department'),
    doctor: $('doctor'),
    reason: $('reason'),
    date: $('date'),
    consent: $('consent')
};
const slotsBox = $('slots');
const slotMessage = $('slotMessage');
const slotLegend = $('slotLegend');
const doctorHint = $('doctorHint');

let selectedTime = '';

function pad(n) {
    return String(n).padStart(2, '0');
}

function localDateString(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function parseDate(value) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function timeValue(t) {
    return pad(t.h) + ':' + pad(t.m);
}

function timeLabel(t) {
    const suffix = t.h >= 12 ? 'PM' : 'AM';
    const hour = t.h % 12 === 0 ? 12 : t.h % 12;
    return hour + ':' + pad(t.m) + ' ' + suffix;
}

function labelFromValue(value) {
    const [h, m] = value.split(':').map(Number);
    return timeLabel({ h, m });
}

function prettyDate(value) {
    return parseDate(value).toLocaleDateString('en-PH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function seededTaken(doctor, date, time) {
    const text = doctor + '|' + date + '|' + time;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash % 5 === 0;
}

function isTaken(doctor, date, time) {
    return takenTimes.has(time) || seededTaken(doctor, date, time);
}

function findDoctor() {
    const list = doctors[fields.department.value] || [];
    return list.find(d => d.name === fields.doctor.value) || null;
}

function setError(key, message) {
    const box = $(key + '-error');
    if (box) box.textContent = message || '';
    const el = fields[key];
    const wrap = el ? el.closest('.field') : null;
    if (wrap) wrap.classList.toggle('invalid', Boolean(message));
}

function clearError(key) {
    setError(key, '');
}

Object.keys(doctors).forEach(name => fields.department.add(new Option(name, name)));

const today = localDateString(new Date());
fields.date.min = today;
fields.birthdate.max = today;

function fillDoctors() {
    fields.doctor.innerHTML = '';
    const list = doctors[fields.department.value] || [];
    if (!fields.department.value) {
        fields.doctor.add(new Option('Choose a department first', ''));
        fields.doctor.disabled = true;
    } else {
        fields.doctor.add(new Option('Choose a doctor', ''));
        list.forEach(d => fields.doctor.add(new Option(d.name, d.name)));
        fields.doctor.disabled = false;
    }
    updateDoctorHint();
}

function updateDoctorHint() {
    const doc = findDoctor();
    doctorHint.textContent = doc
        ? 'Available: ' + doc.days.map(d => dayNames[d].slice(0, 3)).join(', ')
        : '';
}

async function renderSlots() {
    const requestId = ++slotRequest;
    slotsBox.innerHTML = '';
    slotMessage.classList.remove('warn');
    slotLegend.hidden = true;

    const doc = findDoctor();
    const date = fields.date.value;

    if (!doc || !date) {
        slotMessage.textContent = 'Choose a doctor and a date to see available times.';
        selectedTime = '';
        return;
    }

    const dayIndex = parseDate(date).getDay();

    if (dayIndex === 0) {
        slotMessage.textContent = 'The clinic is closed on Sundays. Please choose another date.';
        slotMessage.classList.add('warn');
        selectedTime = '';
        return;
    }

    if (!doc.days.includes(dayIndex)) {
        slotMessage.textContent = doc.name + ' is not available on ' + dayNames[dayIndex] + 's. Available days: ' +
            doc.days.map(d => dayNames[d].slice(0, 3)).join(', ') + '.';
        slotMessage.classList.add('warn');
        selectedTime = '';
        return;
    }

    slotMessage.textContent = 'Loading available times...';
    const { data: taken } = await db.rpc('get_taken_times', { p_doctor: doc.name, p_date: date });
    if (requestId !== slotRequest) return;
    takenTimes = new Set((taken || []).map(t => String(t).slice(0, 5)));

    const now = new Date();
    let openCount = 0;

    times.forEach(t => {
        const value = timeValue(t);
        const past = date === today && (t.h < now.getHours() || (t.h === now.getHours() && t.m <= now.getMinutes()));
        const unavailable = past || isTaken(doc.name, date, value);
        if (!unavailable) openCount++;

        const label = document.createElement('label');
        label.className = 'slot';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'time';
        input.value = value;
        input.disabled = unavailable;
        input.checked = !unavailable && value === selectedTime;
        const span = document.createElement('span');
        span.textContent = timeLabel(t);
        label.appendChild(input);
        label.appendChild(span);
        slotsBox.appendChild(label);
    });

    if (!slotsBox.querySelector('input:checked')) selectedTime = '';

    slotLegend.hidden = false;
    slotMessage.textContent = openCount
        ? 'Choose a time for ' + prettyDate(date) + '.'
        : 'No times are left on this date. Please choose another date.';
    if (!openCount) slotMessage.classList.add('warn');
}

function setSummary(id, value) {
    const el = $(id);
    el.textContent = value || el.dataset.empty || '';
    el.classList.toggle('empty', !value);
}

['sumPatient', 'sumDepartment', 'sumDoctor', 'sumDate', 'sumTime', 'sumReason'].forEach(id => {
    $(id).dataset.empty = $(id).textContent;
});

function updateSummary() {
    setSummary('sumPatient', fields.fullName.value.trim());
    setSummary('sumDepartment', fields.department.value);
    setSummary('sumDoctor', fields.doctor.value);
    setSummary('sumDate', fields.date.value ? prettyDate(fields.date.value) : '');
    setSummary('sumTime', selectedTime ? labelFromValue(selectedTime) : '');
    setSummary('sumReason', fields.reason.value);
}

function updateWho() {
    const other = form.elements.forWho.value === 'someone else';
    $('fullNameLabel').textContent = other ? "Patient's full name" : 'Full name';
    $('birthdateLabel').textContent = other ? "Patient's birthdate" : 'Birthdate';
}

form.elements.forWho.forEach(r => r.addEventListener('change', updateWho));

fields.department.addEventListener('change', () => {
    clearError('department');
    fillDoctors();
    selectedTime = '';
    renderSlots();
    updateSummary();
});

fields.doctor.addEventListener('change', () => {
    clearError('doctor');
    updateDoctorHint();
    selectedTime = '';
    renderSlots();
    updateSummary();
});

fields.date.addEventListener('change', () => {
    clearError('date');
    selectedTime = '';
    renderSlots();
    updateSummary();
});

slotsBox.addEventListener('change', e => {
    if (e.target.name === 'time') {
        selectedTime = e.target.value;
        $('time-error').textContent = '';
        updateSummary();
    }
});

['fullName', 'birthdate', 'phone', 'email', 'reason'].forEach(key => {
    const evt = fields[key].tagName === 'SELECT' ? 'change' : 'input';
    fields[key].addEventListener(evt, () => {
        clearError(key);
        updateSummary();
    });
});

fields.consent.addEventListener('change', () => {
    $('consent-error').textContent = '';
});

function validate() {
    let first = null;
    const fail = (key, message) => {
        setError(key, message);
        if (!first) first = fields[key];
    };

    const name = fields.fullName.value.trim();
    if (name.length < 2) fail('fullName', 'Enter the full name.');

    if (!fields.birthdate.value) fail('birthdate', 'Enter the birthdate.');
    else if (fields.birthdate.value > today) fail('birthdate', 'The birthdate cannot be in the future.');

    const digits = fields.phone.value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) fail('phone', 'Enter a valid contact number, for example 0917 123 4567.');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim())) fail('email', 'Enter a valid email address.');

    if (!fields.department.value) fail('department', 'Choose a department.');
    if (!fields.doctor.value) fail('doctor', 'Choose a doctor.');
    if (!fields.reason.value) fail('reason', 'Choose a reason for the visit.');

    if (!fields.date.value) fail('date', 'Choose an appointment date.');
    else if (fields.date.value < today) fail('date', 'Choose today or a later date.');

    if (!selectedTime) {
        $('time-error').textContent = 'Choose an available time.';
        if (!first) first = slotsBox.querySelector('input:not(:disabled)') || fields.date;
    }

    if (!fields.consent.checked) {
        $('consent-error').textContent = 'Please agree before confirming.';
        if (!first) first = fields.consent;
    }

    if (first) {
        first.focus();
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return !first;
}

function makeReference(date) {
    return 'CS-' + date.replace(/-/g, '') + '-' + String(Math.floor(1000 + Math.random() * 9000));
}

form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate()) return;

    const btn = $('confirmBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const date = fields.date.value;
    const row = {
        user_id: null,
        for_who: form.elements.forWho.value,
        patient: fields.fullName.value.trim(),
        birthdate: fields.birthdate.value,
        phone: fields.phone.value.trim(),
        email: fields.email.value.trim(),
        patient_type: form.elements.patientType.value,
        department: fields.department.value,
        doctor: fields.doctor.value,
        reason: fields.reason.value,
        notes: $('notes').value.trim(),
        appt_date: date,
        appt_time: selectedTime,
        status: 'Pending'
    };

    let saved = null;
    let lastError = null;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
        const { data, error } = await db.from('appointments')
            .insert({ ...row, ref: makeReference(date) }).select().single();
        if (!error) { saved = data; break; }
        lastError = error;
        // retry only if the random reference number happened to collide
        if (!(error.code === '23505' && String(error.message).includes('appointments_ref_key'))) break;
    }

    btn.disabled = false;
    btn.textContent = 'Confirm booking';

    if (!saved) {
        if (lastError && lastError.code === '23505') {
            $('time-error').textContent = 'Sorry, that time was just taken. Please choose another one.';
            selectedTime = '';
            renderSlots();
            updateSummary();
        } else {
            $('time-error').textContent = 'Could not save your booking. Please try again.';
        }
        return;
    }

    showConfirmation({
        ref: saved.ref,
        patient: saved.patient,
        department: saved.department,
        doctor: saved.doctor,
        date: saved.appt_date,
        time: String(saved.appt_time).slice(0, 5),
        reason: saved.reason,
        status: saved.status
    });
});

function showConfirmation(a) {
    $('refNumber').textContent = a.ref;
    const rows = [
        ['Patient', a.patient],
        ['Department', a.department],
        ['Doctor', a.doctor],
        ['Date', prettyDate(a.date)],
        ['Time', labelFromValue(a.time)],
        ['Reason', a.reason],
        ['Status', a.status]
    ];
    const dl = $('confirmDetails');
    dl.innerHTML = '';
    rows.forEach(([k, v]) => {
        const row = document.createElement('div');
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = k;
        dd.textContent = v;
        row.appendChild(dt);
        row.appendChild(dd);
        dl.appendChild(row);
    });
    $('bookingView').hidden = true;
    $('confirmation').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('bookAnother').addEventListener('click', () => {
    form.reset();
    selectedTime = '';
    updateWho();
    fillDoctors();
    renderSlots();
    updateSummary();
    $('confirmation').hidden = true;
    $('bookingView').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

(function prefill() {
    const params = new URLSearchParams(window.location.search);
    const dept = params.get('department');
    const docParam = params.get('doctor');
    const date = params.get('date');

    if (dept && doctors[dept]) {
        fields.department.value = dept;
        fillDoctors();
        if (docParam) {
            const needle = docParam.replace(/^dr\.?\s*/i, '').trim().toLowerCase();
            const match = doctors[dept].find(d => needle && d.name.toLowerCase().includes(needle));
            if (match) fields.doctor.value = match.name;
        }
    } else {
        fillDoctors();
    }

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today) fields.date.value = date;

    updateDoctorHint();
    renderSlots();
    updateSummary();
})();
