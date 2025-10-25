const selector = document.getElementById("languageSelector");
const options = document.getElementById("lang-options");
const selectedFlag = document.getElementById("selected-flag");
const selectedLangText = document.getElementById("selected-language");

// Загружаем JSON и обновляем текст
function loadLanguage(lang) {
    fetch(`lang/${lang}.json`)
        .then((res) => {
        if (!res.ok) throw new Error(`Translation file not found: ${lang}`);
        return res.json();
        })
        .then((data) => {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const keys = el.dataset.i18n.split(".");
            let text = data;
            for (const key of keys) {
            text = text?.[key];
            }
            if (typeof text === "string") {
            el.textContent = text;
            }
        });
        })
        .catch((err) => {
        console.error("Language loading error:", err);
        });
}

// Обработка выбора языка
options.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;

    const lang = li.dataset.lang;
    const flag = li.dataset.flag;
    const text = li.querySelector("p").innerText;

    selectedFlag.src = flag;
    selectedLangText.innerText = text;

    localStorage.setItem("lang", lang);
    loadLanguage(lang);

    options.style.display = "none";
});

// Открытие/закрытие выпадающего списка
selector.addEventListener("click", () => {
    options.style.display = options.style.display === "block" ? "none" : "block";
});

// Закрытие при клике вне селектора
document.addEventListener("click", (e) => {
    if (!document.querySelector(".custom-select-wrapper").contains(e.target)) {
        options.style.display = "none";
    }
});

// Загрузка при старте
function initLanguage() {
    const savedLang = localStorage.getItem("lang") || "en";
    const li = document.querySelector(`li[data-lang="${savedLang}"]`);
    if (li) {
        const flag = li.dataset.flag;
        const text = li.querySelector("p").innerText;
        selectedFlag.src = flag;
        selectedLangText.innerText = text;
    }
    loadLanguage(savedLang);
}

document.addEventListener("DOMContentLoaded", initLanguage);