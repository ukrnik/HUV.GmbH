// js/form.js
const form   = document.getElementById('contactForm');
    if (form) {
    const status  = document.getElementById('formStatus');
    const submit  = form.querySelector('.contact__submit');

    function msg(type, text) {
        status.className = 'contact__status ' + (type === 'ok' ? 'contact__status--ok' : 'contact__status--err');
        status.textContent = text;
        status.setAttribute('role', 'alert');     // A11y: озвучивание
        status.style.display = 'block';
        status.focus?.();
    }

    const T = {
        ok:  'Ihre Nachricht wurde erfolgreich gesendet. Wir melden uns in Kürze.',
        err: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut.'
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        status.style.display = 'none';
        submit.disabled = true;
        const orig = submit.textContent;
        submit.textContent = 'Senden…';

        try {
        const res = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' }
        });

        let ok = res.ok;

        // если сервер вернул JSON — читаем его
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            const data = await res.json().catch(() => ({}));
            if (typeof data.ok === 'boolean') ok = data.ok;
        }

        if (ok) {
            form.reset();
            msg('ok', T.ok);
        } else {
            msg('err', T.err);
        }
        } catch {
        msg('err', T.err);
        } finally {
        submit.disabled = false;
        submit.textContent = orig;
        }
    });
}