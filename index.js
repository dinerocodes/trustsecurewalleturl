document.addEventListener("DOMContentLoaded", () => {
  // ========================================
  // DOM ELEMENTS
  // ========================================

  const body = document.body;

  const themeToggle = document.getElementById("themeToggle");
  const balanceToggle = document.getElementById("balanceToggle");
  const portfolioBalance = document.getElementById("portfolioBalance");

  const searchInput = document.getElementById("assetSearch");
  const clearSearch = document.getElementById("clearSearch");
  const sortSelect = document.getElementById("assetSort");
  const assetList = document.getElementById("assetList");
  const emptyState = document.getElementById("emptyState");

  const refreshButton = document.getElementById("refreshButton");
  const settingsButton = document.getElementById("settingsButton");
  const marketStatus = document.getElementById("market-status");

  // ========================================
  // CURRENCY FORMATTING
  // ========================================

  function formatUSD(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return "$0.00";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: amount > 0 && amount < 0.01 ? 6 : 2,
    }).format(amount);
  }

  function readUSD(value) {
    const parsed = Number(String(value || "").replace(/[$,\s]/g, ""));

    return Number.isFinite(parsed) ? parsed : 0;
  }

  // ========================================
  // ASSET DATA
  // ========================================

  const allAssets = assetList
    ? Array.from(assetList.querySelectorAll(".asset-row"))
    : [];

  const cryptoRows = allAssets.filter((row) => row.dataset.coinId);

  const coinIds = [...new Set(cryptoRows.map((row) => row.dataset.coinId))];

  const priceCache = Object.create(null);
  const changeCache = Object.create(null);

  let isUpdatingPrices = false;
  let balanceVisible = true;

  // Preserve the original balance while prices load.
  let currentWalletTotal = portfolioBalance
    ? readUSD(portfolioBalance.textContent)
    : 0;

  // ========================================
  // BALANCE PRIVACY
  // ========================================

  function updateBalanceDisplays() {
    if (!portfolioBalance) return;

    portfolioBalance.textContent = balanceVisible
      ? formatUSD(currentWalletTotal)
      : "••••••••";
  }

  function updateBalanceToggle() {
    if (!balanceToggle) return;

    const icon = balanceToggle.querySelector("i");

    if (icon) {
      icon.className = balanceVisible
        ? "fa-regular fa-eye"
        : "fa-regular fa-eye-slash";
    }

    balanceToggle.setAttribute(
      "aria-label",
      balanceVisible ? "Hide balance" : "Show balance",
    );

    balanceToggle.title = balanceVisible ? "Hide balance" : "Show balance";
  }

  if (balanceToggle) {
    balanceToggle.addEventListener("click", () => {
      balanceVisible = !balanceVisible;
      updateBalanceDisplays();
      updateBalanceToggle();
    });
  }

  updateBalanceToggle();

  // ========================================
  // DARK MODE
  // ========================================

  function getSavedTheme() {
    try {
      return localStorage.getItem("wallet-theme");
    } catch (error) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem("wallet-theme", theme);
    } catch (error) {
      console.warn("Theme preference could not be saved.");
    }
  }

  if (getSavedTheme() === "dark") {
    body.classList.add("dark-mode");
  }

  function updateThemeButton() {
    if (!themeToggle) return;

    const icon = themeToggle.querySelector("i");
    const isDark = body.classList.contains("dark-mode");

    if (icon) {
      icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }

    themeToggle.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );

    themeToggle.title = isDark ? "Light mode" : "Dark mode";
  }

  updateThemeButton();

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      body.classList.toggle("dark-mode");

      const theme = body.classList.contains("dark-mode") ? "dark" : "light";

      saveTheme(theme);
      updateThemeButton();
    });
  }

  // ========================================
  // SEARCH AND SORT ASSETS
  // ========================================

  function filterAndSortAssets() {
    if (!assetList) return;

    const searchTerm = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

    const sortValue = sortSelect ? sortSelect.value : "default";

    if (clearSearch) {
      clearSearch.hidden = searchTerm.length === 0;
    }

    const filteredAssets = allAssets.filter((asset) => {
      const symbol = (asset.dataset.symbol || "").toLowerCase();

      const name = (asset.dataset.name || "").toLowerCase();

      return symbol.includes(searchTerm) || name.includes(searchTerm);
    });

    filteredAssets.sort((a, b) => {
      if (sortValue === "name") {
        return (a.dataset.name || "").localeCompare(b.dataset.name || "");
      }

      if (sortValue === "value") {
        return Number(b.dataset.value || 0) - Number(a.dataset.value || 0);
      }

      if (sortValue === "change") {
        return Number(b.dataset.change || 0) - Number(a.dataset.change || 0);
      }

      // Keep the original HTML order by default.
      return allAssets.indexOf(a) - allAssets.indexOf(b);
    });

    // The original rows remain stored in allAssets.
    assetList.replaceChildren(...filteredAssets);

    if (emptyState) {
      emptyState.hidden = filteredAssets.length > 0;
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", filterAndSortAssets);
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", filterAndSortAssets);
  }

  if (clearSearch) {
    clearSearch.addEventListener("click", () => {
      if (!searchInput) return;

      searchInput.value = "";
      filterAndSortAssets();
      searchInput.focus();
    });
  }

  // ========================================
  // LIVE CRYPTO PRICES - COINGECKO
  // ========================================

  async function refreshCryptoPrices() {
    if (isUpdatingPrices || coinIds.length === 0) {
      return;
    }

    isUpdatingPrices = true;

    if (marketStatus) {
      marketStatus.textContent = "Updating live prices...";
    }

    if (refreshButton) {
      refreshButton.disabled = true;

      const icon = refreshButton.querySelector("i");

      if (icon) {
        icon.classList.add("fa-spin");
      }
    }

    try {
      const url =
        "https://api.coingecko.com/api/v3/simple/price" +
        `?ids=${encodeURIComponent(coinIds.join(","))}` +
        "&vs_currencies=usd&include_24hr_change=true";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`CoinGecko returned HTTP ${response.status}`);
      }

      const data = await response.json();

      // Cache only valid values returned by the API.
      for (const coinId of coinIds) {
        const coin = data[coinId];

        if (coin && typeof coin.usd === "number" && Number.isFinite(coin.usd)) {
          priceCache[coinId] = coin.usd;
        }

        if (
          coin &&
          typeof coin.usd_24h_change === "number" &&
          Number.isFinite(coin.usd_24h_change)
        ) {
          changeCache[coinId] = coin.usd_24h_change;
        }
      }

      let total = 0;

      cryptoRows.forEach((row) => {
        const coinId = row.dataset.coinId;
        const symbol = row.dataset.symbol || "";
        const quantity = Number(row.dataset.quantity || 0);

        const price = priceCache[coinId];
        const change = changeCache[coinId];

        const priceElement = row.querySelector(".market-price strong");

        const priceCaption = row.querySelector(".market-price span");

        const holdingValueElement = row.querySelector(".holding-cell span");

        // Update market price and holding value.
        if (typeof price === "number") {
          if (priceElement) {
            priceElement.textContent = formatUSD(price);
          }

          if (priceCaption) {
            priceCaption.textContent = `Per ${symbol}`;
          }

          const holdingValue = quantity * price;

          row.dataset.value = String(holdingValue);

          if (holdingValueElement) {
            holdingValueElement.textContent = formatUSD(holdingValue);
          }

          total += holdingValue;
        } else {
          // Retain the last available value if a price
          // is missing from this API response.
          total += Number(row.dataset.value || 0);
        }

        // Update 24-hour market movement.
        const changeElement = row.querySelector(".change-pill");

        if (typeof change === "number" && changeElement) {
          const sign = change > 0 ? "+" : "";

          changeElement.textContent = `${sign}${change.toFixed(2)}%`;

          changeElement.classList.toggle("positive-bg", change >= 0);

          changeElement.classList.toggle("negative-bg", change < 0);

          row.dataset.change = String(change);
        }
      });

      // Keep the actual total separate from its display.
      currentWalletTotal = 15000302.24;
      updateBalanceDisplays();

      filterAndSortAssets();

      if (marketStatus) {
        marketStatus.textContent = `Prices updated at ${new Date().toLocaleTimeString()}`;
      }
    } catch (error) {
      console.error("Live price update failed:", error);

      if (marketStatus) {
        marketStatus.textContent =
          "Price refresh failed. Showing available data.";
      }

      // Keep the existing balance and asset values if the
      // request fails. Do not replace them with zero.
    } finally {
      isUpdatingPrices = false;

      if (refreshButton) {
        refreshButton.disabled = false;

        const icon = refreshButton.querySelector("i");

        if (icon) {
          icon.classList.remove("fa-spin");
        }
      }
    }
  }

  // ========================================
  // MANUAL REFRESH
  // ========================================

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      refreshCryptoPrices();
    });
  }

  // ========================================
  // SETTINGS BUTTON
  // ========================================

  if (settingsButton) {
    settingsButton.addEventListener("click", () => {
      alert(
        "Wallet settings\n\n" +
          "Theme: " +
          (body.classList.contains("dark-mode") ? "Dark" : "Light") +
          "\n\nThis is a demo wallet. Account security, " +
          "network settings, and real wallet connections " +
          "have not been implemented.",
      );
    });
  }

  // ========================================
  // NAVIGATION ACTIVE STATE
  // ========================================

  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((navItem) => {
        navItem.classList.remove("active");
        navItem.removeAttribute("aria-current");
      });

      item.classList.add("active");
      item.setAttribute("aria-current", "page");
    });
  });

  // ========================================
  // ACCESSIBILITY: ESCAPE KEY
  // ========================================

  document.querySelectorAll(".icon-button").forEach((button) => {
    button.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        button.blur();
      }
    });
  });

  // ========================================
  // INITIALIZE DASHBOARD
  // ========================================

  filterAndSortAssets();
  refreshCryptoPrices();

  // Refresh prices every 60 seconds.
  window.setInterval(refreshCryptoPrices, 60_000);
});
