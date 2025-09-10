// ===============================
// 1) Подстановка <load src="...">
// ===============================
async function hydratePartials() {
    const nodes = Array.from(document.querySelectorAll('load[src]'));
    for (const node of nodes) {
        const src = node.getAttribute('src');
        const attrs = {};
        for (const a of node.attributes) {
        if (a.name !== 'src') attrs[a.name] = a.value;
        }
        try {
        const res = await fetch(src, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let html = await res.text();
        // {{attr-name}} → значение атрибута тега <load>
        html = html.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, key) => attrs[key] ?? '');
        const wrap = document.createElement('div');
        wrap.innerHTML = html;
        node.replaceWith(...wrap.childNodes);
        } catch (e) {
        console.error('Include failed:', src, e);
        }
    }
    // Сообщаем, что паршалы готовы
    document.dispatchEvent(new CustomEvent('partials:hydrated'));
}

// Запускаем сразу после готовности DOM
window.addEventListener('DOMContentLoaded', hydratePartials);

// ==================================================
// 2) Обработчик формы: AJAX + статус (успех/ошибка)
// ==================================================
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return; // формы на странице может не быть

    const status = document.getElementById('formStatus');
    const submit = form.querySelector('.contact__submit');

    function showMsg(type, text) {
        status.className = 'contact__status ' + (type === 'ok' ? 'contact__status--ok' : 'contact__status--err');
        status.textContent = text;
        status.setAttribute('role', 'alert');
        status.style.display = 'block';
    }

    const T = {
        ok:  'Ihre Nachricht wurde erfolgreich gesendet. Wir melden uns in Kürze.',
        err: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut.'
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        status.style.display = 'none';

        const orig = submit.textContent;
        submit.disabled = true;
        submit.textContent = 'Senden…';

        try {
        const res = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' }
        });

        let ok = res.ok;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            const data = await res.json().catch(() => ({}));
            if (typeof data.ok === 'boolean') ok = data.ok;
        }

        if (ok) {
            form.reset();
            showMsg('ok', T.ok);
        } else {
            showMsg('err', T.err);
        }
        } catch {
        showMsg('err', T.err);
        } finally {
        submit.disabled = false;
        submit.textContent = orig;
        }
    });
}

// Инициализируем сразу и ещё раз после вставки паршалов
window.addEventListener('DOMContentLoaded', initContactForm);
document.addEventListener('partials:hydrated', initContactForm);

// ===============================================
// 3) Service Worker для кеширования статики (HTTPS)
// ===============================================
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW register failed:', err);
    });
  });
}

// Инициализация логики формы (AJAX-отправка и статусы)
import './form.js';

// ===============================================
// 4) Дополнительно: плавный скролл по якорям (опц.)
// ===============================================
document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
