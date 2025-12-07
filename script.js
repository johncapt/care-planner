const mumPicker = document.getElementById("mumColorPicker");
const dadPicker = document.getElementById("dadColorPicker");

// Load saved colors
function loadColors() {
  const mumColor = localStorage.getItem("mumColor") || "#c4b5fd";
  const dadColor = localStorage.getItem("dadColor") || "#6ee7b7";

  document.documentElement.style.setProperty("--mum-color", mumColor);
  document.documentElement.style.setProperty("--dad-color", dadColor);

  if (mumPicker) mumPicker.value = mumColor;
  if (dadPicker) dadPicker.value = dadColor;
}

// Application state management
class CarePlannerApp {
  constructor() {
    // Default state - stored separately for restore functionality
    this.defaultState = {
      startsWith: "Mum",
      handovers: ["2025-12-19T15:00", "2026-01-10T10:00", "2026-01-24T18:00"],
      publicHolidays: [],
    };

    // Deep clone default state
    this.state = JSON.parse(JSON.stringify(this.defaultState));
    this.currentDate = new Date();
    this.currentView = "calendar";
    this.init();
  }

  init() {
    this.loadFromLocalStorage();
    this.bindEvents();
    this.loadDefaults();
    this.render();
  }

  loadFromLocalStorage() {
    // Load startsWith
    const storedStartsWith = localStorage.getItem("startsWith");
    if (storedStartsWith) {
      this.state.startsWith = storedStartsWith;
    }

    // Load handovers
    const storedHandovers = localStorage.getItem("handovers");
    if (storedHandovers) {
      try {
        this.state.handovers = JSON.parse(storedHandovers);
      } catch (e) {
        console.error("Failed to parse handovers from localStorage:", e);
      }
    }

    // Load public holidays
    const storedPublicHolidays = localStorage.getItem("publicHolidays");
    if (storedPublicHolidays) {
      try {
        this.state.publicHolidays = JSON.parse(storedPublicHolidays);
      } catch (e) {
        console.error("Failed to parse public holidays from localStorage:", e);
      }
    }
  }

  bindEvents() {
    document
      .getElementById("handOverButton")
      .addEventListener("click", () => this.toggleView("handover"));
    document
      .getElementById("publicHolidaysButton")
      .addEventListener("click", () => this.toggleView("publicholidays"));
    document
      .getElementById("summaryButton")
      .addEventListener("click", () => this.toggleView("summary"));
    document
      .getElementById("calendarButton")
      .addEventListener("click", () => this.toggleView("calendar"));
    document.getElementById("startsWith").addEventListener("change", (e) => {
      this.updateState("startsWith", e.target.value);
      localStorage.setItem("startsWith", e.target.value);
    });
    document
      .getElementById("handoverInput")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.addHandover();
    });

    // Color picker events
    if (mumPicker) {
    mumPicker.addEventListener("input", function () {
        localStorage.setItem("mumColor", this.value);
        document.documentElement.style.setProperty("--mum-color", this.value);
    });
    }

    if (dadPicker) {
    dadPicker.addEventListener("input", function () {
        localStorage.setItem("dadColor", this.value);
        document.documentElement.style.setProperty("--dad-color", this.value);
    });
    }

    // Load colors immediately
    loadColors();
  }

  loadDefaults() {
    document.getElementById("startsWith").value = this.state.startsWith;
    this.updateHandoverDisplay();
    this.updateHolidayDisplay();
  }

  updateState(key, value) {
    this.state[key] = value;
    this.render();
  }

  toggleView(viewName) {
    if (this.currentView === viewName) return;

    // Update button states
    const buttons = document.querySelectorAll(".nav-button");
    buttons.forEach((button) => button.classList.remove("active"));

    const buttonMap = {
      handover: "handOverButton",
      publicholidays: "publicHolidaysButton",
      summary: "summaryButton",
      calendar: "calendarButton",
    };

    if (buttonMap[viewName]) {
      document.getElementById(buttonMap[viewName]).classList.add("active");
    }

    this.currentView = viewName;

    // Get all panels
    const panels = {
      handover: document.getElementById("handOverPanel"),
      publicholidays: document.getElementById("publicHolidaysPanel"),
      summary: document.getElementById("summaryPanel"),
      calendar: document.getElementById("calendar-container"),
    };

    // Hide all panels
    Object.values(panels).forEach((panel) => panel.classList.add("hidden"));

    // Show selected panel
    if (panels[viewName]) {
      panels[viewName].classList.remove("hidden");

      // Render content for the view
      if (viewName === "summary") {
        this.renderSummary();
      } else if (viewName === "calendar") {
        this.renderCalendar();
      }
    }
  }

  showError(message) {
    this.showMessage(message, "error-message", 5000);
  }

  showSuccess(message) {
    this.showMessage(message, "success-message", 3000);
  }

  showWarning(message) {
    this.showMessage(message, "warning-message", 4000);
  }

  showMessage(message, className, duration) {
    const container = document.getElementById("errorContainer");
    container.innerHTML = `<div class="${className}">${message}</div>`;
    setTimeout(() => (container.innerHTML = ""), duration);
  }

  calculateDateRange() {
    if (this.state.handovers.length < 2) {
      return { startDate: null, endDate: null };
    }
    const sortedHandovers = [...this.state.handovers].sort(
      (a, b) => new Date(a) - new Date(b)
    );
    return {
      startDate: sortedHandovers[0],
      endDate: sortedHandovers[sortedHandovers.length - 1],
    };
  }

  validateHandovers() {
    if (this.state.handovers.length < 2) {
      this.showError(
        "You need at least 2 handover times to create a care schedule"
      );
      return false;
    }
    return true;
  }

  buildCarePeriods() {
    if (!this.validateHandovers()) return [];

    const periods = [];
    let currentParent = this.state.startsWith;
    const sortedHandovers = [...this.state.handovers].sort(
      (a, b) => new Date(a) - new Date(b)
    );

    for (let i = 0; i < sortedHandovers.length - 1; i++) {
      // Parse as local time by creating date from components
      const fromDate = new Date(sortedHandovers[i]);
      const toDate = new Date(sortedHandovers[i + 1]);

      periods.push({
        from: fromDate,
        to: toDate,
        fromStr: sortedHandovers[i],
        toStr: sortedHandovers[i + 1],
        with: currentParent,
      });
      currentParent = currentParent === "Mum" ? "Dad" : "Mum";
    }

    return periods;
  }

  formatDuration(milliseconds) {
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}d ${hours}h ${minutes}m`;
  }

  formatDateTime(date) {
    return new Date(date).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  formatDate(date) {
    return new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  normalizeDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  addHandover() {
    const input = document.getElementById("handoverInput");
    const newHandover = input.value;

    if (!newHandover) {
      this.showError("Please select a handover time");
      return;
    }

    if (this.state.handovers.includes(newHandover)) {
      this.showError("This handover time already exists");
      return;
    }

    this.state.handovers.push(newHandover);
    this.state.handovers.sort((a, b) => new Date(a) - new Date(b));
    input.value = "";

    this.updateHandoverDisplay();
    this.render();
    this.showSuccess("Handover added successfully");
    localStorage.setItem("handovers", JSON.stringify(this.state.handovers));
  }

  removeHandover(handover) {
    if (this.state.handovers.length <= 2) {
      this.showWarning(
        "You need at least 2 handover times for a care schedule"
      );
      return;
    }

    const index = this.state.handovers.indexOf(handover);
    if (index !== -1) {
      this.state.handovers.splice(index, 1);
      this.updateHandoverDisplay();
      this.render();
      this.showSuccess("Handover removed successfully");
      localStorage.setItem("handovers", JSON.stringify(this.state.handovers));
    }
  }

  addHoliday() {
    const dateInput = document.getElementById("holidayDateInput");
    const labelInput = document.getElementById("holidayLabelInput");
    const newDate = dateInput.value;
    const newLabel = labelInput.value.trim();

    if (!newDate) {
      this.showError("Please select a date");
      return;
    }

    if (!newLabel) {
      this.showError("Please enter a holiday name");
      return;
    }

    if (this.state.publicHolidays.some((h) => h.day === newDate)) {
      this.showError("A holiday already exists on this date");
      return;
    }

    this.state.publicHolidays.push({ day: newDate, label: newLabel });
    this.state.publicHolidays.sort((a, b) => new Date(a.day) - new Date(b.day));

    dateInput.value = "";
    labelInput.value = "";

    this.updateHolidayDisplay();
    this.render();
    this.showSuccess("Holiday added successfully");
    localStorage.setItem(
      "publicHolidays",
      JSON.stringify(this.state.publicHolidays)
    );
  }

  removeHoliday(day) {
    const index = this.state.publicHolidays.findIndex((h) => h.day === day);
    if (index !== -1) {
      this.state.publicHolidays.splice(index, 1);
      this.updateHolidayDisplay();
      this.render();
      this.showSuccess("Holiday removed successfully");
      localStorage.setItem(
        "publicHolidays",
        JSON.stringify(this.state.publicHolidays)
      );
    }
  }

  updateHandoverDisplay() {
    const container = document.getElementById("handoverList");
    container.innerHTML = "";

    const sortedHandovers = [...this.state.handovers].sort(
      (a, b) => new Date(b) - new Date(a)
    );

    sortedHandovers.forEach((handover) => {
      const item = document.createElement("div");
      item.className = "handover-item";
      item.innerHTML = `
                        <span>${this.formatDateTime(handover)}</span>
                        <button type="button" class="btn btn-danger" onclick="app.removeHandover('${handover}')">-</button>
                    `;
      container.appendChild(item);
    });
  }

  updateHolidayDisplay() {
    const container = document.getElementById("holidayList");
    container.innerHTML = "";

    const sortedHolidays = [...this.state.publicHolidays].sort(
      (a, b) => new Date(b.day) - new Date(a.day)
    );

    sortedHolidays.forEach((holiday) => {
      const item = document.createElement("div");
      item.className = "holiday-item";
      const escapedDay = holiday.day.replace(/'/g, "\\'");
      item.innerHTML = `
                        <span>${this.formatDate(holiday.day)} - ${
        holiday.label
      }</span>
                        <button type="button" class="btn btn-danger" onclick="app.removeHoliday('${escapedDay}')">-</button>
                    `;
      container.appendChild(item);
    });
  }

  renderSummary() {
    const periods = this.buildCarePeriods();
    if (periods.length === 0) return;

    const summary = {};

    periods.forEach((period) => {
      const duration = period.to - period.from;
      if (!summary[period.with]) {
        summary[period.with] = { periods: [], total: 0 };
      }
      summary[period.with].periods.push({
        from: period.from,
        to: period.to,
        duration: this.formatDuration(duration),
      });
      summary[period.with].total += duration;
    });

    const summaryPanel = document.getElementById("summaryPanel");
    summaryPanel.innerHTML = "";

    Object.entries(summary).forEach(([parent, data]) => {
      const card = document.createElement("div");
      const isPast = (date) => date < this.currentDate;

      const tableRows = data.periods
        .map((period) => {
          const rowClass = isPast(period.to) ? "past-period" : "";
          return `
                            <tr class="${rowClass}">
                                <td>${this.formatDateTime(period.from)}</td>
                                <td>${this.formatDateTime(period.to)}</td>
                                <td>${period.duration}</td>
                            </tr>
                        `;
        })
        .join("");

      const totals = Object.values(summary).map((s) => s.total);
      const allEqual = totals.every((t) => t === totals[0]);
      const totalClass = allEqual ? "total-row balanced-totals" : "total-row";

      card.innerHTML = `
                        <h2>${parent}</h2>
                        <table class="summary-table">
                            <thead>
                                <tr>
                                    <th>From</th>
                                    <th>To</th>
                                    <th>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                                <tr class="${totalClass}">
                                    <td colspan="2">Total</td>
                                    <td>${this.formatDuration(data.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    `;
      summaryPanel.appendChild(card);
    });
  }

  renderCalendar() {
    const periods = this.buildCarePeriods();
    if (periods.length === 0) return;

    const { startDate, endDate } = this.calculateDateRange();
    if (!startDate || !endDate) return;

    const container = document.getElementById("calendarContainer");
    container.innerHTML = "";

    const start = new Date(startDate);
    const end = new Date(endDate);
    let currentDate = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );
    let currentMonth = null;
    let monthSection = null;

    while (currentDate <= end) {
      const monthYear = currentDate.toLocaleString("en-AU", {
        month: "long",
        year: "numeric",
      });

      if (currentMonth !== monthYear) {
        currentMonth = monthYear;

        monthSection = document.createElement("div");
        monthSection.className = "month-section";

        const monthHeader = document.createElement("div");
        monthHeader.className = "month-header";
        monthHeader.textContent = monthYear;
        monthSection.appendChild(monthHeader);

        container.appendChild(monthSection);
      }

      const dayDiv = document.createElement("div");
      dayDiv.className = "calendar-day";

      const dayNumber = document.createElement("div");
      dayNumber.className = "day-number";
      dayNumber.textContent = currentDate.getDate();
      dayDiv.appendChild(dayNumber);

      const timeline = document.createElement("div");
      timeline.className = "day-timeline";

      const dateStr = this.normalizeDate(currentDate);
      const holiday = this.state.publicHolidays.find((h) => h.day === dateStr);

      for (let hour = 0; hour < 24; hour++) {
        const cell = document.createElement("div");
        cell.className = "hour-cell";

        const cellTime = new Date(currentDate);
        cellTime.setHours(hour, 0, 0, 0);

        // Debug first day, first few hours
        if (
          currentDate.getDate() === 19 &&
          currentDate.getMonth() === 11 &&
          hour < 3
        ) {
          console.log(`Hour ${hour}:`, {
            cellTime: cellTime,
            cellTimestamp: cellTime.getTime(),
            periodsCount: periods.length,
            period0From: periods[0]?.from,
            period0To: periods[0]?.to,
            period0FromTS: periods[0]?.from.getTime(),
            period0ToTS: periods[0]?.to.getTime(),
          });
        }

        // Find period that contains this hour
        const period = periods.find((p) => {
          const cellTimestamp = cellTime.getTime();
          const fromTimestamp = p.from.getTime();
          const toTimestamp = p.to.getTime();
          const match =
            cellTimestamp >= fromTimestamp && cellTimestamp < toTimestamp;

          if (
            currentDate.getDate() === 19 &&
            currentDate.getMonth() === 11 &&
            hour === 15
          ) {
            console.log(`Hour 15 (3pm) check:`, {
              cellTimestamp,
              fromTimestamp,
              toTimestamp,
              match,
              periodWith: p.with,
            });
          }

          return match;
        });

        if (period) {
          const className = period.with === "Mum" ? "mum-period" : "dad-period";
          cell.classList.add(className);
          if (cellTime < this.currentDate) {
            cell.classList.add("past-period");
          }
          if (currentDate.getDate() === 19 && hour === 15) {
            console.log(
              "Added class:",
              className,
              "to cell, classes:",
              cell.className
            );
          }
        }

        if (holiday) {
          cell.classList.add("public-holiday-cell");
          cell.title = holiday.label;
        }

        timeline.appendChild(cell);
      }

      dayDiv.appendChild(timeline);
      monthSection.appendChild(dayDiv);

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  render() {
    requestAnimationFrame(() => {
      if (this.currentView === "summary") {
        this.renderSummary();
      } else if (this.currentView === "calendar") {
        this.renderCalendar();
      }
    });
  }

  restoreDefaults() {
    // Properly restore to default state
    this.state = JSON.parse(JSON.stringify(this.defaultState));

    // Update UI
    document.getElementById("startsWith").value = this.state.startsWith;
    this.updateHandoverDisplay();
    this.updateHolidayDisplay();

    // Save to localStorage
    localStorage.setItem("startsWith", this.state.startsWith);
    localStorage.setItem("handovers", JSON.stringify(this.state.handovers));
    localStorage.setItem(
      "publicHolidays",
      JSON.stringify(this.state.publicHolidays)
    );

    this.render();
    this.showSuccess("Defaults restored successfully");
  }
}



// Global functions for event handlers
window.addHandover = () => app.addHandover();
window.addHoliday = () => app.addHoliday();
window.restoreDefaults = () => app.restoreDefaults();
window.toggleNavigation = () => {
  const menu = document.getElementById("navigationMenu");
  const toggle = document.getElementById("navToggle");
  menu.classList.toggle("hidden");
  toggle.textContent = menu.classList.contains("hidden") ? "▼" : "▲";
};

// Format date from YYYYMMDD to YYYY-MM-DD
const formatDate = (dateString) => {
  if (!/^\d{8}$/.test(dateString)) {
    console.error("Invalid date format:", dateString);
    return dateString;
  }
  return dateString.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
};

// Fetch public holidays from API
const fetchPublicHolidays = async () => {
  const jurisdiction = document.getElementById("juridiction").value;
  console.log("Fetching public holidays for jurisdiction:", jurisdiction);

  try {
    const resp = await fetch(
      "https://data.gov.au/data/api/action/datastore_search_sql?sql=SELECT%20*%20from%20%224d4d744b-50ed-45b9-ae77-760bc478ad75%22"
    );

    if (!resp.ok) {
      throw new Error(`HTTP error! status: ${resp.status}`);
    }

    const data = await resp.json();

    if (!data.result || !data.result.records) {
      throw new Error("Invalid API response structure");
    }

    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    // Get holidays for current and next year from API
    const specialDays = data.result.records
      .filter((rec) => {
        if (rec["Jurisdiction"] !== jurisdiction) return false;
        const dateStr = rec["Date"];
        const year = parseInt(dateStr.substring(0, 4));
        return year === currentYear || year === nextYear;
      })
      .map((rec) => ({
        day: formatDate(rec["Date"]),
        label: rec["Holiday Name"],
      }));

    // Check if we have next year's data
    const hasNextYear = specialDays.some((h) =>
      h.day.startsWith(nextYear.toString())
    );

    // If next year's data is missing, duplicate current year's holidays
    if (!hasNextYear) {
      const currentYearHolidays = specialDays.filter((h) =>
        h.day.startsWith(currentYear.toString())
      );
      const duplicatedHolidays = currentYearHolidays.map((holiday) => {
        const [year, month, day] = holiday.day.split("-");
        return {
          day: `${nextYear}-${month}-${day}`,
          label: holiday.label,
        };
      });
      specialDays.push(...duplicatedHolidays);
      console.log(
        `API only has ${currentYear} data. Duplicated ${duplicatedHolidays.length} holidays for ${nextYear}`
      );
    }

    app.state.publicHolidays = specialDays;
    app.state.publicHolidays.sort((a, b) => new Date(a.day) - new Date(b.day));
    app.updateHolidayDisplay();
    app.render();

    localStorage.setItem(
      "publicHolidays",
      JSON.stringify(app.state.publicHolidays)
    );
    app.showSuccess(`Loaded ${specialDays.length} public holidays`);
  } catch (err) {
    console.error("Failed to fetch public holidays:", err);
    app.showError("Failed to load public holidays. Please try again.");
  }
};

// Initialize the application
const app = new CarePlannerApp();

// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        console.log("Service Worker registered:", reg);

        // Check for updates every time the page loads
        reg.update();

        // Listen for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New service worker available, prompt user to refresh
              if (confirm("A new version is available! Reload to update?")) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((err) =>
        console.error("Service Worker registration failed:", err)
      );

    // Reload page when new service worker takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

// Auto-fetch public holidays if none in storage
if (app.state.publicHolidays.length === 0) {
  console.log(
    "No public holidays found in local storage, fetching from API..."
  );
  fetchPublicHolidays();
}
