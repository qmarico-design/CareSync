const navItems = document.querySelectorAll('nav ul[data-target]');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const section = document.getElementById(item.dataset.target);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

const nav = document.querySelector('nav');
const topGap = 12;
let spacer = null;
let navTop = 0;

function setupStickyNav() {
    if (spacer) spacer.remove();
    nav.style.cssText = '';

    const style = getComputedStyle(nav);
    const rect = nav.getBoundingClientRect();
    navTop = rect.top + window.scrollY;

    spacer = document.createElement('div');
    spacer.style.height = rect.height + parseFloat(style.marginTop) + parseFloat(style.marginBottom) + 'px';
    nav.parentNode.insertBefore(spacer, nav);

    nav.style.position = 'fixed';
    nav.style.left = '50%';
    nav.style.transform = 'translateX(-50%)';
    nav.style.margin = '0';
    nav.style.zIndex = '1000';
    nav.style.transition = 'background-color 0.3s';

    document.querySelectorAll('nav ul[data-target]').forEach(item => {
        const section = document.getElementById(item.dataset.target);
        if (section) section.style.scrollMarginTop = rect.height + topGap + 20 + 'px';
    });

    updateStickyNav();
}

function updateStickyNav() {
    const top = navTop - window.scrollY;
    const stuck = top <= topGap;
    nav.style.top = Math.max(top, topGap) + 'px';
    nav.style.backgroundColor = stuck ? 'rgba(255, 255, 255, 0.92)' : '';
    nav.style.backdropFilter = stuck ? 'blur(8px)' : '';
}

setupStickyNav();
window.addEventListener('scroll', updateStickyNav);
window.addEventListener('resize', setupStickyNav);
window.addEventListener('load', setupStickyNav);

const homeItem = Array.from(document.querySelectorAll('nav ul')).find(u => u.textContent.trim() === 'Home');
if (homeItem) {
    homeItem.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

const menuLinks = {
    book: 'booking.html',
    appointments: 'appointments.html',
    profile: 'profile.html',
    logout: 'index.html'
};

const menuStyle = document.createElement('style');
menuStyle.textContent = `
.menu-btn{
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    position: fixed;
    top: 16px;
    left: 20px;
    z-index: 1003;
    width: 46px;
    height: 46px;
    padding: 0 11px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 10px 30px rgba(93, 91, 91, 0.3);
    backdrop-filter: blur(8px);
    cursor: pointer;
    transition: box-shadow 0.3s;
}
.menu-btn.open{
    box-shadow: none;
}
.menu-btn span{
    display: block;
    height: 3px;
    border-radius: 3px;
    background: black;
    transition: transform 0.25s, opacity 0.25s, background-color 0.2s;
}
.menu-btn:hover span{
    background: rgb(25, 172, 172);
}
.menu-btn:focus-visible{
    outline: 3px solid #0f9d8a;
    outline-offset: 2px;
}
.menu-btn.open span:nth-child(1){
    transform: translateY(8px) rotate(45deg);
}
.menu-btn.open span:nth-child(2){
    opacity: 0;
}
.menu-btn.open span:nth-child(3){
    transform: translateY(-8px) rotate(-45deg);
}
.menu-overlay{
    position: fixed;
    inset: 0;
    z-index: 1001;
    background: rgba(0, 0, 0, 0.35);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s, visibility 0.3s;
}
.menu-overlay.open{
    opacity: 1;
    visibility: visible;
}
.menu-panel{
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 1002;
    display: flex;
    flex-direction: column;
    width: min(300px, 85vw);
    background: white;
    box-shadow: 10px 0 30px rgba(93, 91, 91, 0.3);
    transform: translateX(-100%);
    visibility: hidden;
    transition: transform 0.3s ease, visibility 0.3s;
}
.menu-panel.open{
    transform: translateX(0);
    visibility: visible;
}
.menu-head{
    display: flex;
    align-items: center;
    height: 78px;
    padding-left: 80px;
    flex-shrink: 0;
}
.menu-head img{
    display: block;
    max-width: 170px;
    max-height: 46px;
    object-fit: contain;
}
.menu-items{
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 14px;
    overflow-y: auto;
}
.menu-foot{
    margin-top: auto;
    padding: 14px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
}
.menu-panel button{
    display: block;
    width: 100%;
    padding: 14px 18px;
    border: none;
    border-radius: 14px;
    background: transparent;
    color: black;
    font-size: 1rem;
    font-weight: bold;
    text-align: left;
    cursor: pointer;
}
.menu-panel button:hover,
.menu-panel button:focus-visible{
    background: rgba(127, 255, 212, 0.35);
    color: rgb(25, 172, 172);
    outline: none;
}
.menu-panel button.menu-book{
    margin-bottom: 8px;
    background: #0f9d8a;
    color: white;
    text-align: center;
}
.menu-panel button.menu-book:hover,
.menu-panel button.menu-book:focus-visible{
    background: #0b6f61;
    color: white;
}
.menu-panel button.menu-logout{
    color: #b3261e;
}
.menu-panel button.menu-logout:hover,
.menu-panel button.menu-logout:focus-visible{
    background: rgba(179, 38, 30, 0.1);
    color: #b3261e;
}
`;
document.head.appendChild(menuStyle);

const menuBtn = document.createElement('button');
menuBtn.className = 'menu-btn';
menuBtn.type = 'button';
menuBtn.setAttribute('aria-label', 'Open menu');
menuBtn.setAttribute('aria-expanded', 'false');
menuBtn.innerHTML = '<span></span><span></span><span></span>';

const menuOverlay = document.createElement('div');
menuOverlay.className = 'menu-overlay';

const menuPanel = document.createElement('div');
menuPanel.className = 'menu-panel';
menuPanel.innerHTML = `
  <div class="menu-head"><img src="logo.png" alt="CareSync logo"></div>
<div class="menu-items">
    <button type="button" class="menu-book" data-action="book">Book an Appointment</button>
    <button type="button" data-action="appointments">My Appointments</button>

</div>
<div class="menu-foot">
    <button type="button" class="menu-logout" data-action="logout">Log out</button>
</div>
`;

document.body.appendChild(menuOverlay);
document.body.appendChild(menuPanel);
document.body.appendChild(menuBtn);

function setMenu(open) {
    menuBtn.classList.toggle('open', open);
    menuPanel.classList.toggle('open', open);
    menuOverlay.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

menuBtn.addEventListener('click', () => {
    setMenu(!menuPanel.classList.contains('open'));
});

menuOverlay.addEventListener('click', () => setMenu(false));

function logout() {

    try {
        sessionStorage.clear();
        localStorage.clear();
    } catch (err) {
     
    }
    window.location.href = menuLinks.logout;
}

menuPanel.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    setMenu(false);

    if (action === 'logout') {
        logout();
    } else if (menuLinks[action]) {
        window.location.href = menuLinks[action];
    }
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menuPanel.classList.contains('open')) {
        setMenu(false);
        menuBtn.focus();
    }
});

const bookingItem = document.querySelector('nav ul.booking');
if (bookingItem) {
    bookingItem.style.cursor = 'pointer';
    bookingItem.addEventListener('click', () => {
        window.location.href = menuLinks.book;
    });
}

const appointmentsItem = document.querySelector('nav ul.appointments');
if (appointmentsItem) {
    appointmentsItem.style.cursor = 'pointer';
    appointmentsItem.addEventListener('click', () => {
        window.location.href = menuLinks.appointments;
    });
}