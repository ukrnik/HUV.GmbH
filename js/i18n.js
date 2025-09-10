const switcher = document.getElementById("languageSwitcher");

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

switcher.addEventListener("change", (e) => {
    const selectedLang = e.target.value;
    localStorage.setItem("lang", selectedLang);
    loadLanguage(selectedLang);
});

// Загрузка сохранённого языка или английского по умолчанию
const savedLang = localStorage.getItem("lang") || "en";
switcher.value = savedLang;
loadLanguage(savedLang);