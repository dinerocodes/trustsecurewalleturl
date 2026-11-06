(() => {
  const LANGUAGE_KEY = "wallet_language";
  const COUNTRY_KEY = "wallet_country";

  const COUNTRY_LANGUAGES = {
    // French
    BJ: "fr",
    FR: "fr",
    BE: "fr",
    SN: "fr",
    CI: "fr",
    TG: "fr",
    BF: "fr",
    NE: "fr",
    ML: "fr",
    GN: "fr",
    CD: "fr",
    CG: "fr",
    CM: "fr",
    GA: "fr",
    TD: "fr",
    DJ: "fr",
    MG: "fr",
    RW: "fr",
    BI: "fr",

    // German
    DE: "de",
    AT: "de",
    CH: "de",
    LI: "de",

    // Spanish
    ES: "es",
    MX: "es",
    AR: "es",
    CO: "es",
    CL: "es",
    PE: "es",
    VE: "es",
    EC: "es",
    BO: "es",
    PY: "es",
    UY: "es",
    CR: "es",
    PA: "es",
    GT: "es",
    HN: "es",
    SV: "es",
    NI: "es",
    DO: "es",
    CU: "es",

    // English
    NG: "en",
    US: "en",
    GB: "en",
    GH: "en",
    IE: "en",
    ZA: "en",
    KE: "en",
    CA: "en",
    AU: "en",
    NZ: "en",
  };

  const translations = window.WALLET_TRANSLATIONS || {};
  const supportedLanguages = ["en", "fr", "de", "es"];

  function getLanguage() {
    return localStorage.getItem(LANGUAGE_KEY) || "en";
  }

  // Translate normal text nodes without requiring data-i18n.
  function translateTextNodes(dictionary) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;

          if (!parent) return NodeFilter.FILTER_REJECT;

          if (
            parent.closest(
              "script, style, noscript, textarea, [data-no-translate]",
            )
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    while (walker.nextNode()) {
      const node = walker.currentNode;

      // Preserve the original English text for future switching.
      if (node.__walletOriginalText === undefined) {
        node.__walletOriginalText = node.nodeValue;
      }

      const original = node.__walletOriginalText;
      const key = original.trim();

      if (dictionary[key] !== undefined) {
        const leading = original.match(/^\s*/)[0];
        const trailing = original.match(/\s*$/)[0];

        node.nodeValue = leading + dictionary[key] + trailing;
      }
    }
  }

  function translateAttributes(dictionary) {
    document
      .querySelectorAll(
        "[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria]",
      )
      .forEach((element) => {
        const key = element.dataset.i18n;

        if (key && dictionary[key] !== undefined) {
          element.textContent = dictionary[key];
        }

        const placeholder = element.dataset.i18nPlaceholder;

        if (placeholder && dictionary[placeholder] !== undefined) {
          element.placeholder = dictionary[placeholder];
        }

        const title = element.dataset.i18nTitle;

        if (title && dictionary[title] !== undefined) {
          element.title = dictionary[title];
        }

        const aria = element.dataset.i18nAria;

        if (aria && dictionary[aria] !== undefined) {
          element.setAttribute("aria-label", dictionary[aria]);
        }
      });
  }

  function translatePage(language = getLanguage()) {
    const selectedLanguage = translations[language] ? language : "en";

    const dictionary = translations[selectedLanguage];

    document.documentElement.lang = selectedLanguage;

    translateTextNodes(dictionary);
    translateAttributes(dictionary);

    const selector = document.getElementById("language-selector");

    if (selector) {
      selector.value = selectedLanguage;
    }

    document.dispatchEvent(
      new CustomEvent("wallet:languageChanged", {
        detail: { language: selectedLanguage },
      }),
    );
  }

  function setLanguage(language) {
    if (!supportedLanguages.includes(language)) return;

    if (!translations[language]) return;

    localStorage.setItem(LANGUAGE_KEY, language);

    translatePage(language);
  }

  async function detectCountry() {
    try {
      const response = await fetch("https://ipapi.co/json/");

      if (!response.ok) throw new Error("Detection failed");

      const data = await response.json();

      const country = (data.country_code || "").toUpperCase();

      localStorage.setItem(COUNTRY_KEY, country);

      return COUNTRY_LANGUAGES[country] || "en";
    } catch (error) {
      console.warn("Country detection failed:", error);
      return "en";
    }
  }

  function createLanguageSelector() {
    if (document.getElementById("language-selector")) return;

    const header = document.querySelector(".header-actions");

    if (!header) {
      console.warn("Wallet header not found.");
      return;
    }

    const wrapper = document.createElement("div");

    wrapper.className = "wallet-language-switcher";

    wrapper.innerHTML = `
            <select id="language-selector" aria-label="Choose language">
                <option value="en">🇬🇧 English</option>
                <option value="fr">🇫🇷 Français</option>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="es">🇪🇸 Español</option>
            </select>
        `;

    const selector = wrapper.querySelector("select");

    selector.value = getLanguage();

    selector.addEventListener("change", () => {
      setLanguage(selector.value);
    });

    header.appendChild(wrapper);
  }

  async function initializeLocalization() {
    let language = localStorage.getItem(LANGUAGE_KEY);

    if (!language || !supportedLanguages.includes(language)) {
      language = await detectCountry();
      localStorage.setItem(LANGUAGE_KEY, language);
    }

    createLanguageSelector();
    translatePage(language);

    // Translate content added dynamically after page loading.
    const observer = new MutationObserver(() => {
      translatePage(getLanguage());
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  window.WalletLocalization = {
    setLanguage,
    getLanguage,
    translatePage,
    getCountry: () => localStorage.getItem(COUNTRY_KEY),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeLocalization);
  } else {
    initializeLocalization();
  }
})();
