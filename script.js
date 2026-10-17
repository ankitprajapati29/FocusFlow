
"use strict";

/* ==========================================
   FOCUSFLOW 2.0
   Smart Study Planner
   Tasks • Calendar • Focus Timer • Analytics
========================================== */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE = {
  tasks: "focusFlowTasksV1",
  profile: "focusFlowProfileV2",
  theme: "focusFlowThemeV2",
  subjects: "focusFlowSubjectsV2",
  stats: "focusFlowStatsV2"
};

const DAY_MS = 86400000;

const PRIORITY_ORDER = { High: 1, Medium: 2, Low: 3 };

const SUBJECT_COLORS = [
  "#7565e8", "#269b75", "#d78a3b",
  "#4389df", "#d75a86", "#38a8a8"
];

const TIMER_MODES = {
  focus: { seconds: 1500, label: "TIME TO FOCUS" },
  short: { seconds: 300, label: "SHORT BREAK" },
  long: { seconds: 900, label: "LONG BREAK" }
};

/* ==========================================
   STORAGE AND HELPERS
========================================== */

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error("Storage read error:", error);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Storage write error:", error);
    toast("Unable to save. Check browser storage.");
    return false;
  }
}

function localDate(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function parseDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(value, amount) {
  const date = parseDate(value);
  if (!date) return value;

  date.setDate(date.getDate() + amount);
  return localDate(date);
}

function formatDate(value, options = {}) {
  const date = parseDate(value);
  if (!date) return "Unscheduled";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...options
  });
}

function formatTime(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return "";

  const [hour, minute] = value.split(":").map(Number);

  return new Date(2000, 0, 1, hour, minute)
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit"
    });
}

function formatMinutes(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours && mins) return `${hours}h ${String(mins).padStart(2, "0")}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function createId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sameDay(a, b) {
  return Boolean(a && b && a === b);
}

function isOverdue(task) {
  return !task.completed &&
    !task.inbox &&
    task.date &&
    task.date < localDate();
}

function getTaskDate(task) {
  return task.date || task.deadline || "";
}

function normalizeTask(task) {
  return {
    id: String(task.id || createId()),
    title: String(task.title || task.task || "Untitled task"),
    subject: String(task.subject || "General"),
    date: String(task.date || task.deadline || ""),
    time: String(task.time || ""),
    duration: Math.max(1, Number(task.duration) || 60),
    priority: ["High", "Medium", "Low"].includes(task.priority)
      ? task.priority
      : "Medium",
    notes: String(task.notes || ""),
    repeat: ["daily", "weekdays", "weekly"].includes(task.repeat)
      ? task.repeat
      : "none",
    inbox: Boolean(task.inbox),
    completed: Boolean(task.completed),
    createdAt: task.createdAt || new Date().toISOString(),
    completedAt: task.completedAt || null
  };
}

function loadTasks() {
  const saved = readJSON(STORAGE.tasks, []);

  if (!Array.isArray(saved)) return [];

  return saved
    .filter(task => task && typeof task === "object")
    .map(normalizeTask);
}

/* ==========================================
   APPLICATION STATE
========================================== */

let tasks = loadTasks();

let profile = readJSON(STORAGE.profile, { name: "" });
if (!profile || typeof profile !== "object") profile = { name: "" };

let savedSubjects = readJSON(STORAGE.subjects, []);
if (!Array.isArray(savedSubjects)) savedSubjects = [];

let stats = readJSON(STORAGE.stats, {
  completedSessions: 0,
  focusMinutes: 0,
  completedDates: []
});

if (!stats || typeof stats !== "object") {
  stats = {
    completedSessions: 0,
    focusMinutes: 0,
    completedDates: []
  };
}

stats.completedSessions = Number(stats.completedSessions) || 0;
stats.focusMinutes = Number(stats.focusMinutes) || 0;

if (!Array.isArray(stats.completedDates)) {
  stats.completedDates = [];
}

let activeView = "today";
let calendarMode = "day";
let calendarDate = localDate();
let editingId = null;
let selectedFocusTask = null;
let toastTimeout = null;
let timerInterval = null;
let timerRunning = false;
let timerMode = "focus";
let remainingSeconds = TIMER_MODES.focus.seconds;
let timerEndTime = 0;

/* ==========================================
   TOAST
========================================== */

function toast(message) {
  const element = $("#toast");
  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    element.classList.remove("show");
  }, 2800);
}

/* ==========================================
   NAME SELECTION AND PROFILE
========================================== */

function showNameScreen() {
  $("#nameScreen").hidden = false;
  $("#appShell").hidden = true;

  $("#userName").value = profile.name || "";

  setTimeout(() => $("#userName")?.focus(), 100);
}

function showDashboard() {
  $("#nameScreen").hidden = true;
  $("#appShell").hidden = false;

  const name = profile.name || "Student";
  const firstName = name.trim().split(/\s+/)[0];

  $("#pageTitle").innerHTML =
    `Welcome, ${escapeHTML(firstName)} <span class="wave">✦</span>`;

  $("#profileAvatar").textContent =
    firstName.charAt(0).toUpperCase();

  const hour = new Date().getHours();
  const greeting = hour < 12
    ? "GOOD MORNING"
    : hour < 17
      ? "GOOD AFTERNOON"
      : "GOOD EVENING";

  $("#welcomeEyebrow").textContent =
    `${greeting}, ${firstName.toUpperCase()}`;

  $("#topDate").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });

  renderApp();
}

$("#nameForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("#userName").value.trim();

  if (!name) {
    toast("Please enter your name.");
    return;
  }

  if (name.length > 40) {
    toast("Name must be under 40 characters.");
    return;
  }

  profile.name = name;

  if (!writeJSON(STORAGE.profile, profile)) return;

  showDashboard();
  toast(`Welcome to FocusFlow, ${name}!`);
});

$("#changeNameBtn").addEventListener("click", () => {
  closeSidebar();
  showNameScreen();
});

/* ==========================================
   THEME
========================================== */

function applyTheme(theme) {
  const dark = theme === "dark";

  document.body.classList.toggle("dark-mode", dark);

  $("#themeToggle").innerHTML = dark
    ? "<span>☀</span> Switch to light mode"
    : "<span>◐</span> Switch to dark mode";
}

applyTheme(readJSON(STORAGE.theme, "light"));

$("#themeToggle").addEventListener("click", () => {
  const next = document.body.classList.contains("dark-mode")
    ? "light"
    : "dark";

  applyTheme(next);
  writeJSON(STORAGE.theme, next);
});

/* ==========================================
   SUBJECTS
========================================== */

function getSubjects() {
  const names = [
    ...savedSubjects,
    ...tasks.map(task => task.subject)
  ];

  return [...new Set(
    names.map(name => String(name || "").trim()).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function subjectColor(name) {
  const index = Math.abs(
    [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
  ) % SUBJECT_COLORS.length;

  return SUBJECT_COLORS[index];
}

function renderSubjects() {
  const subjects = getSubjects();

  $("#subjectNav").innerHTML = subjects.length
    ? subjects.map(name => `
        <button type="button" class="subject-nav-item"
          data-subject="${escapeHTML(name)}">
          <span class="subject-dot"
            style="background:${subjectColor(name)}"></span>
          <span>${escapeHTML(name)}</span>
        </button>
      `).join("")
    : '<p class="muted tiny">Add a task to create your subjects.</p>';

  $("#subjectSuggestions").innerHTML = subjects
    .map(name => `<option value="${escapeHTML(name)}"></option>`)
    .join("");

  const select = $("#taskSubject");
  if (select) select.setAttribute("autocomplete", "off");
}

$("#subjectNav").addEventListener("click", event => {
  const button = event.target.closest("[data-subject]");
  if (!button) return;

  $("#searchInput").value = button.dataset.subject;
  activeView = "subject";
  renderTasks();
  updateNavigation();
  $("#taskSection").scrollIntoView({ behavior: "smooth" });
});

$("#addSubjectBtn").addEventListener("click", () => {
  openModal("subjectModal");
});

$("#subjectForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("#newSubjectName").value.trim();
  if (!name) return;

  if (getSubjects().some(item => item.toLowerCase() === name.toLowerCase())) {
    toast("This subject already exists.");
    return;
  }

  savedSubjects.push(name);

  if (!writeJSON(STORAGE.subjects, savedSubjects)) {
    savedSubjects.pop();
    return;
  }

  $("#newSubjectName").value = "";
  closeModal("subjectModal");
  renderSubjects();
  toast("Subject added.");
});

/* ==========================================
   MODAL MANAGEMENT
========================================== */

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";

  setTimeout(() => {
    modal.querySelector("input:not([type=hidden])")?.focus();
  }, 100);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  if (!document.querySelector(".modal-backdrop.open")) {
    document.body.style.overflow = "";
  }
}

$$("[data-close-modal]").forEach(button => {
  button.addEventListener("click", () => {
    const modal = button.closest(".modal-backdrop");
    if (modal) closeModal(modal.id);
  });
});

$$(".modal-backdrop").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal(modal.id);
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    $$(".modal-backdrop.open").forEach(modal => closeModal(modal.id));
    closeSidebar();
  }
});

/* ==========================================
   TASK FORM: CREATE AND EDIT
========================================== */

function resetTaskForm() {
  $("#taskForm").reset();
  $("#taskId").value = "";
  $("#taskDate").value = calendarDate || localDate();
  $("#taskTime").value = "09:00";
  $("#taskPriority").value = "Medium";
  $("#taskDuration").value = "60";
  $("#taskRepeat").value = "none";
  $("#taskInbox").checked = false;

  editingId = null;

  $("#modalTitle").textContent = "Create a task";
  $("#saveTaskBtn").innerHTML = "Save task <span>→</span>";
}

function openTaskForm(task = null, date = calendarDate) {
  resetTaskForm();

  if (task) {
    editingId = task.id;

    $("#taskId").value = task.id;
    $("#taskTitle").value = task.title;
    $("#taskSubject").value = task.subject;
    $("#taskDate").value = task.date || "";
    $("#taskTime").value = task.time || "";
    $("#taskDuration").value = String(task.duration);
    $("#taskPriority").value = task.priority;
    $("#taskNotes").value = task.notes || "";
    $("#taskRepeat").value = task.repeat || "none";
    $("#taskInbox").checked = Boolean(task.inbox);

    $("#modalTitle").textContent = "Edit task";
    $("#saveTaskBtn").innerHTML = "Save changes <span>→</span>";
  } else {
    $("#taskDate").value = date || localDate();
  }

  openModal("taskModal");
}

$("#quickAddBtn").addEventListener("click", () => openTaskForm());

$("#taskForm").addEventListener("submit", event => {
  event.preventDefault();

  const title = $("#taskTitle").value.trim();
  const subject = $("#taskSubject").value.trim();
  const date = $("#taskDate").value;
  const time = $("#taskTime").value;
  const duration = Number($("#taskDuration").value);
  const priority = $("#taskPriority").value;
  const notes = $("#taskNotes").value.trim();
  const repeat = $("#taskRepeat").value;
  const inbox = $("#taskInbox").checked;

  if (!title || !subject || !date) {
    toast("Please complete the required fields.");
    return;
  }

  if (!Number.isFinite(duration) || duration < 1) {
    toast("Choose a valid duration.");
    return;
  }

  const previous = editingId
    ? tasks.find(task => task.id === editingId)
    : null;

  const task = normalizeTask({
    ...(previous || {}),
    id: editingId || createId(),
    title,
    subject,
    date,
    time,
    duration,
    priority,
    notes,
    repeat,
    inbox,
    completed: previous?.completed || false,
    completedAt: previous?.completedAt || null,
    createdAt: previous?.createdAt || new Date().toISOString()
  });

  if (previous) {
    const index = tasks.findIndex(item => item.id === editingId);
    const old = tasks[index];

    tasks[index] = task;

    if (!writeJSON(STORAGE.tasks, tasks)) {
      tasks[index] = old;
      return;
    }

    toast("Task updated successfully.");
  } else {
    tasks.unshift(task);

    if (!writeJSON(STORAGE.tasks, tasks)) {
      tasks.shift();
      return;
    }

    toast("New task added.");
  }

  closeModal("taskModal");
  resetTaskForm();
  renderApp();
});

/* ==========================================
   TASK COMPLETE, DELETE, REPEAT
========================================== */

function toggleTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  const oldCompleted = task.completed;
  const oldCompletedAt = task.completedAt;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  if (task.completed) {
    const today = localDate();

    if (!stats.completedDates.includes(today)) {
      stats.completedDates.push(today);
    }

    writeJSON(STORAGE.stats, stats);
  }

  if (!writeJSON(STORAGE.tasks, tasks)) {
    task.completed = oldCompleted;
    task.completedAt = oldCompletedAt;
    return;
  }

  toast(task.completed ? "Great work! Task completed." : "Task reopened.");
  renderApp();
}

function deleteTask(id) {
  const index = tasks.findIndex(item => item.id === id);
  if (index < 0) return;

  const removed = tasks.splice(index, 1)[0];

  if (!writeJSON(STORAGE.tasks, tasks)) {
    tasks.splice(index, 0, removed);
    return;
  }

  if (editingId === id) resetTaskForm();

  toast("Task deleted.");
  renderApp();
}

function makeNextOccurrence(task) {
  if (!task.repeat || task.repeat === "none") return;

  let nextDate = task.date;
  let attempts = 0;

  do {
    nextDate = addDays(nextDate, task.repeat === "weekly" ? 7 : 1);
    attempts++;

    if (task.repeat === "weekdays") {
      const day = parseDate(nextDate)?.getDay();
      if (day === 0 || day === 6) continue;
    }

    break;
  } while (attempts < 10);

  const nextTask = normalizeTask({
    ...task,
    id: createId(),
    date: nextDate,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString()
  });

  tasks.unshift(nextTask);
  writeJSON(STORAGE.tasks, tasks);
}

/* ==========================================
   TASK FILTERING AND LIST
========================================== */

function getVisibleTasks() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const status = $("#filterStatus").value;
  const sortBy = $("#sortTasks").value;

  let result = tasks.filter(task => {
    const matchesQuery = [
      task.title,
      task.subject,
      task.notes
    ].some(value => String(value || "").toLowerCase().includes(query));

    const matchesStatus =
      status === "all" ||
      (status === "pending" && !task.completed) ||
      (status === "completed" && task.completed) ||
      (status === "overdue" && isOverdue(task));

    let matchesView = true;

    if (activeView === "today") {
      matchesView = !task.inbox && task.date === localDate();
    } else if (activeView === "upcoming") {
      matchesView = !task.inbox && task.date >= localDate();
    } else if (activeView === "inbox") {
      matchesView = task.inbox;
    } else if (activeView === "subject") {
      matchesView = task.subject.toLowerCase().includes(query);
    }

    return matchesQuery && matchesStatus && matchesView;
  });

  result.sort((a, b) => {
    if (sortBy === "priority") {
      return (PRIORITY_ORDER[a.priority] || 4) -
        (PRIORITY_ORDER[b.priority] || 4);
    }

    if (sortBy === "subject") {
      return a.subject.localeCompare(b.subject);
    }

    if (sortBy === "time") {
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    }

    return getTaskDate(a).localeCompare(getTaskDate(b));
  });

  return result;
}

function taskCard(task) {
  const priority = task.priority.toLowerCase();
  const completed = task.completed;

  const schedule = task.inbox
    ? "In inbox"
    : `${formatDate(task.date)}${task.time ? " · " + formatTime(task.time) : ""}`;

  return `
    <article class="task-card ${completed ? "completed" : ""}"
      data-task-id="${escapeHTML(task.id)}">

      <button type="button"
        class="task-check ${completed ? "checked" : ""}"
        data-action="toggle"
        data-id="${escapeHTML(task.id)}"
        aria-label="${completed ? "Mark pending" : "Mark complete"}">
        ${completed ? "✓" : ""}
      </button>

      <div class="task-main">
        <h3 class="task-card-title">${escapeHTML(task.title)}</h3>

        <p class="task-card-subject">
          <span class="subject-dot"
            style="display:inline-block;vertical-align:middle;background:${subjectColor(task.subject)}"></span>
          ${escapeHTML(task.subject)}
        </p>

        ${task.notes
          ? `<p class="task-card-notes">${escapeHTML(task.notes)}</p>`
          : ""}

        <div class="task-meta">
          <span>◷ ${escapeHTML(schedule)}</span>
          <span>◴ ${formatMinutes(task.duration)}</span>
          ${task.repeat !== "none" ? "<span>↻ Repeats</span>" : ""}
          ${isOverdue(task) ? "<span>⚠ Overdue</span>" : ""}
        </div>
      </div>

      <div class="task-side">
        <span class="priority-badge ${priority}">
          ${escapeHTML(task.priority)}
        </span>

        <div class="task-actions">
          <button type="button" data-action="focus" data-id="${escapeHTML(task.id)}" aria-label="Focus on task">Focus</button>
          <button type="button" data-action="edit" data-id="${escapeHTML(task.id)}" aria-label="Edit task">Edit</button>
          <button type="button" class="delete-task" data-action="delete" data-id="${escapeHTML(task.id)}" aria-label="Delete task">Delete</button>
        </div>
      </div>

    </article>
  `;
}

function renderTasks() {
  const visible = getVisibleTasks();

  $("#taskList").innerHTML = visible.length
    ? visible.map(taskCard).join("")
    : `
      <div class="empty-state">
        <strong>${activeView === "inbox" ? "Your inbox is clear" : "Nothing on the list yet"}</strong>
        Add a task to start organizing your study time.
      </div>
    `;

  const titles = {
    today: "Today's tasks",
    upcoming: "Upcoming tasks",
    inbox: "Task inbox",
    analytics: "Study tasks",
    subject: "Subject tasks"
  };

  $("#taskSectionTitle").textContent = titles[activeView] || "Your tasks";
}

$("#taskList").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const task = tasks.find(item => item.id === id);

  if (action === "toggle") {
    const wasCompleted = task?.completed;
    toggleTask(id);

    if (task && !wasCompleted && task.repeat !== "none") {
      makeNextOccurrence(task);
      renderApp();
    }
  }

  if (action === "edit" && task) openTaskForm(task);

  if (action === "delete") {
    if (confirm("Delete this task?")) deleteTask(id);
  }

  if (action === "focus" && task) {
    selectedFocusTask = task.id;
    $("#focusSelectedTask").textContent =
      `${task.subject} · ${task.title}`;
    openModal("focusModal");
  }
});

$("#searchInput").addEventListener("input", renderTasks);
$("#filterStatus").addEventListener("change", renderTasks);
$("#sortTasks").addEventListener("change", renderTasks);

$("#showAllTasks").addEventListener("click", () => {
  activeView = "upcoming";
  $("#searchInput").value = "";
  $("#filterStatus").value = "all";
  updateNavigation();
  renderTasks();
  $("#taskSection").scrollIntoView({ behavior: "smooth" });
});

/* ==========================================
   SIDEBAR NAVIGATION
========================================== */

function updateNavigation() {
  $$(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === activeView
    );
  });

  const labels = {
    today: "Today",
    upcoming: "Upcoming",
    inbox: "Task inbox",
    analytics: "Study insights",
    subject: "Subject tasks"
  };

  $("#breadcrumbCurrent").textContent = labels[activeView] || "Today";

  const analytics = activeView === "analytics";

  $("#analyticsPage").classList.toggle("hidden", !analytics);
  $("#plannerSection").classList.toggle("hidden", analytics);
  $("#insightsPreview").classList.toggle("hidden", analytics);
  $("#taskSection").classList.toggle("hidden", analytics);
  $("#focusBanner").classList.toggle("hidden", analytics);

  $("#welcomeSection").classList.toggle("hidden", analytics);
}

$$(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    updateNavigation();
    closeSidebar();

    if (activeView === "analytics") {
      renderAnalytics();
    } else {
      renderTasks();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

/* ==========================================
   MOBILE SIDEBAR
========================================== */

function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $("#mobileScrim").classList.remove("show");
}

$("#menuToggle").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
  $("#mobileScrim").classList.toggle("show");
});

$("#mobileScrim").addEventListener("click", closeSidebar);

/* ==========================================
   CALENDAR NAVIGATION
========================================== */

$$("[data-calendar]").forEach(button => {
  button.addEventListener("click", () => {
    calendarMode = button.dataset.calendar;

    $$("[data-calendar]").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    renderCalendar();
  });
});

$("#prevDate").addEventListener("click", () => {
  if (calendarMode === "day") {
    calendarDate = addDays(calendarDate, -1);
  } else if (calendarMode === "week") {
    calendarDate = addDays(calendarDate, -7);
  } else {
    const date = parseDate(calendarDate);
    date.setMonth(date.getMonth() - 1);
    calendarDate = localDate(date);
  }

  renderCalendar();
});

$("#nextDate").addEventListener("click", () => {
  if (calendarMode === "day") {
    calendarDate = addDays(calendarDate, 1);
  } else if (calendarMode === "week") {
    calendarDate = addDays(calendarDate, 7);
  } else {
    const date = parseDate(calendarDate);
    date.setMonth(date.getMonth() + 1);
    calendarDate = localDate(date);
  }

  renderCalendar();
});

$("#goToday").addEventListener("click", () => {
  calendarDate = localDate();
  renderCalendar();
});

$("#calendarDateLabel").addEventListener("click", () => {
  calendarDate = localDate();
  renderCalendar();
});

function getDayTasks(date) {
  return tasks.filter(task =>
    !task.inbox && task.date === date
  ).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function renderCalendar() {
  const date = parseDate(calendarDate) || new Date();
  const label = $("#calendarDateLabel");

  if (calendarMode === "day") {
    label.textContent = sameDay(calendarDate, localDate())
      ? "Today"
      : formatDate(calendarDate, {
          weekday: "short",
          year: "numeric"
        });

    $("#plannerHeading").textContent = "Daily timeline";
    renderDayCalendar(calendarDate);
  }

  if (calendarMode === "week") {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    label.textContent =
      `${formatDate(localDate(start))} – ${formatDate(localDate(end))}`;

    $("#plannerHeading").textContent = "Your week";
    renderWeekCalendar(start);
  }

  if (calendarMode === "month") {
    label.textContent = date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });

    $("#plannerHeading").textContent = "Monthly overview";
    renderMonthCalendar(date);
  }
}

function renderDayCalendar(dateValue) {
  const all = getDayTasks(dateValue);

  const scheduled = all.filter(task => task.time);
  const unscheduled = all.filter(task => !task.time);

  const currentHour = new Date().getHours();
  const isToday = dateValue === localDate();

  let html = '<div class="day-calendar">';

  for (let hour = 6; hour <= 22; hour++) {
    html += `
      <div class="day-row">
        <div class="day-time">${String(hour % 12 || 12).padStart(2, "0")}:00 ${hour < 12 ? "AM" : "PM"}</div>
        <div class="day-slot" data-drop-date="${dateValue}" data-drop-time="${String(hour).padStart(2, "0")}:00">
    `;

    scheduled
      .filter(task => Number(task.time.split(":")[0]) === hour)
      .forEach(task => {
        html += `
          <button type="button"
            class="day-task ${task.completed ? "completed" : ""}"
            draggable="true"
            data-drag-task="${escapeHTML(task.id)}"
            data-action="edit-calendar"
            data-id="${escapeHTML(task.id)}">
            <span class="day-task-content">
              <span class="day-task-title">${escapeHTML(task.title)}</span>
              <span class="day-task-meta">${escapeHTML(task.subject)} · ${formatTime(task.time)} · ${formatMinutes(task.duration)}</span>
            </span>
          </button>
        `;
      });

    html += "</div></div>";

    if (isToday && currentHour === hour) {
      html += '<div class="current-time-line" aria-label="Current time"></div>';
    }
  }

  html += "</div>";

  if (unscheduled.length) {
    html += '<div class="day-calendar"><p class="eyebrow">WITHOUT A TIME</p>';

    unscheduled.forEach(task => {
      html += `
        <button type="button"
          class="day-task ${task.completed ? "completed" : ""}"
          data-action="edit-calendar"
          data-id="${escapeHTML(task.id)}">
          <span class="day-task-content">
            <span class="day-task-title">${escapeHTML(task.title)}</span>
            <span class="day-task-meta">${escapeHTML(task.subject)} · ${formatMinutes(task.duration)}</span>
          </span>
        </button>
      `;
    });

    html += "</div>";
  }

  if (!all.length) {
    html += '<div class="calendar-empty">No tasks planned for this day. Add a task to build your schedule.</div>';
  }

  $("#calendarView").innerHTML = html;
}

function renderWeekCalendar(startDate) {
  let html = '<div class="week-calendar">';

  for (let i = 0; i < 7; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);

    const dateValue = localDate(day);
    const dayTasks = getDayTasks(dateValue);

    html += `
      <div class="week-day ${dateValue === localDate() ? "is-today" : ""}"
        data-drop-date="${dateValue}">
        <div class="week-day-heading">
          <span>${day.toLocaleDateString("en-IN", { weekday: "short" })}</span>
          <strong>${day.getDate()}</strong>
        </div>
    `;

    dayTasks.slice(0, 5).forEach(task => {
      html += `
        <button type="button"
          class="week-day-task ${task.completed ? "completed" : ""}"
          data-action="edit-calendar"
          data-id="${escapeHTML(task.id)}"
          title="${escapeHTML(task.title)}">
          ${escapeHTML(task.time ? formatTime(task.time) + " " : "")}${escapeHTML(task.title)}
        </button>
      `;
    });

    if (dayTasks.length > 5) {
      html += `<span class="muted tiny">+${dayTasks.length - 5} more</span>`;
    }

    html += "</div>";
  }

  html += "</div>";
  $("#calendarView").innerHTML = html;
}

function renderMonthCalendar(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(1 - firstDay.getDay());

  let html = `
    <div class="month-calendar">
      <div class="month-weekdays">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
          .map(day => `<span>${day}</span>`).join("")}
      </div>
      <div class="month-grid">
  `;

  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);

    const value = localDate(day);
    const dayTasks = getDayTasks(value);

    const classes = [
      "month-cell",
      day.getMonth() !== date.getMonth() ? "other-month" : "",
      value === localDate() ? "is-today" : "",
      value === calendarDate ? "selected" : ""
    ].filter(Boolean).join(" ");

    html += `
      <button type="button" class="${classes}"
        data-month-date="${value}"
        aria-label="${formatDate(value, { weekday: "long", year: "numeric" })}">
        <span class="month-cell-number">${day.getDate()}</span>
        <span class="month-cell-dots">
          ${dayTasks.slice(0, 5).map(task =>
            `<i class="${task.completed ? "completed-dot" : ""}"></i>`
          ).join("")}
        </span>
      </button>
    `;
  }

  html += "</div></div>";
  $("#calendarView").innerHTML = html;
}

$("#calendarView").addEventListener("click", event => {
  const taskButton = event.target.closest("[data-action='edit-calendar']");

  if (taskButton) {
    const task = tasks.find(item => item.id === taskButton.dataset.id);
    if (task) openTaskForm(task);
    return;
  }

  const cell = event.target.closest("[data-month-date]");
  if (cell) {
    calendarDate = cell.dataset.monthDate;
    calendarMode = "day";

    $$("[data-calendar]").forEach(button => {
      button.classList.toggle("active", button.dataset.calendar === "day");
    });

    renderCalendar();
    openTaskForm(null, calendarDate);
  }
});

/* ==========================================
   DRAG AND DROP RESCHEDULING
========================================== */

$("#calendarView").addEventListener("dragstart", event => {
  const taskElement = event.target.closest("[data-drag-task]");
  if (!taskElement) return;

  event.dataTransfer.setData("text/plain", taskElement.dataset.dragTask);
  event.dataTransfer.effectAllowed = "move";
});

$("#calendarView").addEventListener("dragover", event => {
  const target = event.target.closest("[data-drop-date]");
  if (!target) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});

$("#calendarView").addEventListener("drop", event => {
  const target = event.target.closest("[data-drop-date]");
  if (!target) return;

  event.preventDefault();

  const id = event.dataTransfer.getData("text/plain");
  const task = tasks.find(item => item.id === id);

  if (!task) return;

  const oldDate = task.date;
  const oldTime = task.time;

  task.date = target.dataset.dropDate;

  if (target.dataset.dropTime) {
    task.time = target.dataset.dropTime;
  }

  task.inbox = false;

  if (!writeJSON(STORAGE.tasks, tasks)) {
    task.date = oldDate;
    task.time = oldTime;
    return;
  }

  calendarDate = task.date;
  toast("Task rescheduled.");
  renderApp();
});

/* ==========================================
   STATISTICS AND STREAK
========================================== */

function getTasksForToday() {
  return tasks.filter(task =>
    !task.inbox && task.date === localDate()
  );
}

function renderStats() {
  const todayTasks = getTasksForToday();

  const planned = todayTasks.reduce(
    (sum, task) => sum + (Number(task.duration) || 0), 0
  );

  const completed = todayTasks.filter(task => task.completed).length;

  const percentage = todayTasks.length
    ? Math.round(completed / todayTasks.length * 100)
    : 0;

  $("#plannedToday").textContent = formatMinutes(planned);
  $("#plannedTasks").textContent =
    `${todayTasks.length} ${todayTasks.length === 1 ? "task" : "tasks"}`;

  $("#completedToday").innerHTML =
    `${completed} <small>/ ${todayTasks.length}</small>`;

  $("#completionRate").textContent = `${percentage}%`;
  $("#focusToday").textContent = `${stats.focusMinutes}m`;

  let streak = 0;
  let checkDate = localDate();

  while (stats.completedDates.includes(checkDate)) {
    streak++;
    checkDate = addDays(checkDate, -1);
  }

  $("#streakCount").textContent =
    `${streak} ${streak === 1 ? "day" : "days"}`;

  $("#todayCount").textContent = todayTasks.filter(t => !t.completed).length;
  $("#inboxCount").textContent = tasks.filter(t => t.inbox).length;
}

/* ==========================================
   SUBJECT OVERVIEW
========================================== */

function renderSubjectOverview(target = "#subjectOverview") {
  const element = $(target);
  if (!element) return;

  const groups = new Map();

  tasks.forEach(task => {
    if (!groups.has(task.subject)) {
      groups.set(task.subject, { total: 0, completed: 0, minutes: 0 });
    }

    const group = groups.get(task.subject);
    group.total++;
    group.minutes += task.duration;

    if (task.completed) group.completed++;
  });

  if (!groups.size) {
    element.innerHTML = `
      <div class="empty-state">
        Add tasks to see your subject progress.
      </div>
    `;
    return;
  }

  element.innerHTML = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, group]) => {
      const percent = Math.round(group.completed / group.total * 100);

      return `
        <div class="subject-item">
          <div class="subject-item-heading">
            <strong>${escapeHTML(name)}</strong>
            <span>${percent}%</span>
          </div>
          <p>${group.completed} of ${group.total} tasks completed</p>
          <p>Planned study time: ${formatMinutes(group.minutes)}</p>
          <div class="progress-track">
            <div class="progress-bar" style="width:${percent}%"></div>
          </div>
        </div>
      `;
    }).join("");
}

/* ==========================================
   WEEKLY CHART
========================================== */

function renderWeekChart(target = "#weekChart") {
  const element = $(target);
  if (!element) return;

  const today = parseDate(localDate());
  const start = new Date(today);
  start.setDate(today.getDate() - 6);

  const days = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);

    const value = localDate(date);
    const count = tasks.filter(task =>
      task.completed &&
      task.completedAt &&
      localDate(new Date(task.completedAt)) === value
    ).length;

    days.push({
      value,
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      count
    });
  }

  const max = Math.max(1, ...days.map(day => day.count));

  element.innerHTML = days.map(day => {
    const height = Math.max(3, day.count / max * 100);

    return `
      <div class="chart-day ${day.value === localDate() ? "today" : ""}">
        <span class="chart-value">${day.count}</span>
        <div class="chart-bar-area">
          <div class="chart-bar" style="height:${height}%"></div>
        </div>
        <span class="chart-label">${day.label}</span>
      </div>
    `;
  }).join("");

  const total = days.reduce((sum, day) => sum + day.count, 0);
  $("#weekTotal").textContent = `${total} completed`;
}

/* ==========================================
   ANALYTICS PAGE
========================================== */

function renderAnalytics() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const pending = total - completed;
  const minutes = tasks
    .filter(task => task.completed)
    .reduce((sum, task) => sum + task.duration, 0);

  $("#analyticsMetrics").innerHTML = [
    ["All tasks", total],
    ["Completed", completed],
    ["Pending", pending],
    ["Completion rate", `${total ? Math.round(completed / total * 100) : 0}%`],
    ["Planned completed time", formatMinutes(minutes)],
    ["Focus sessions", stats.completedSessions]
  ].map(([label, value]) => `
    <div class="analytics-metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  renderWeekChart("#analyticsChart");
  renderSubjectOverview("#analyticsSubjects");
}

/* ==========================================
   POMODORO TIMER
========================================== */

const CIRCUMFERENCE = 2 * Math.PI * 105;

function renderTimer() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  $("#timerTime").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  $("#timerCaption").textContent = TIMER_MODES[timerMode].label;

  $("#timerProgress").style.strokeDasharray = CIRCUMFERENCE;

  $("#timerProgress").style.strokeDashoffset =
    CIRCUMFERENCE * (
      1 - remainingSeconds / TIMER_MODES[timerMode].seconds
    );

  $("#timerFace").classList.toggle("break-mode", timerMode !== "focus");

  $$("[data-timer-mode]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.timerMode === timerMode
    );
  });

  $("#timerStart").innerHTML = timerRunning
    ? "Pause timer <span>Ⅱ</span>"
    : remainingSeconds === 0
      ? "Start again <span>▶</span>"
      : "Start focusing <span>▶</span>";

  $("#sessionCount").textContent = stats.completedSessions;
  $("#focusMinutes").textContent = `${stats.focusMinutes} focus minutes`;

  document.title = timerRunning
    ? `${$("#timerTime").textContent} — FocusFlow`
    : "FocusFlow | Smart Study Planner";
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerRunning = false;
}

function completeTimer() {
  stopTimer();
  remainingSeconds = 0;

  if (timerMode === "focus") {
    stats.completedSessions++;
    stats.focusMinutes += 25;

    const today = localDate();
    if (!stats.completedDates.includes(today)) {
      stats.completedDates.push(today);
    }

    writeJSON(STORAGE.stats, stats);
    $("#timerMessage").textContent =
      "Focus session complete! Take a well-earned break.";

    toast("Focus session complete. Great work!");

    if (selectedFocusTask) {
      const task = tasks.find(item => item.id === selectedFocusTask);

      if (task && !task.completed) {
        $("#timerMessage").textContent =
          "Session complete. You can mark your task done when ready.";
      }
    }
  } else {
    $("#timerMessage").textContent =
      "Break finished. Ready for another session?";

    toast("Break finished. Ready to focus again?");
  }

  renderTimer();
  renderStats();
}

function updateTimer() {
  if (!timerRunning) return;

  remainingSeconds = Math.max(
    0,
    Math.ceil((timerEndTime - Date.now()) / 1000)
  );

  if (remainingSeconds <= 0) {
    completeTimer();
    return;
  }

  renderTimer();
}

function startTimer() {
  if (timerRunning) {
    stopTimer();
    $("#timerMessage").textContent = "Timer paused. Resume when ready.";
    renderTimer();
    return;
  }

  if (remainingSeconds <= 0) {
    remainingSeconds = TIMER_MODES[timerMode].seconds;
  }

  timerRunning = true;
  timerEndTime = Date.now() + remainingSeconds * 1000;

  $("#timerMessage").textContent = timerMode === "focus"
    ? "One task. One session. Give it your attention."
    : "Relax your mind and recharge.";

  timerInterval = setInterval(updateTimer, 250);
  renderTimer();
}

function resetTimer() {
  stopTimer();
  remainingSeconds = TIMER_MODES[timerMode].seconds;
  $("#timerMessage").textContent = "Timer reset. Start when you're ready.";
  renderTimer();
}

function selectTimerMode(mode) {
  if (!TIMER_MODES[mode]) return;

  stopTimer();
  timerMode = mode;
  remainingSeconds = TIMER_MODES[mode].seconds;

  renderTimer();
}

$("#timerStart").addEventListener("click", startTimer);
$("#timerReset").addEventListener("click", resetTimer);

$$("[data-timer-mode]").forEach(button => {
  button.addEventListener("click", () => {
    selectTimerMode(button.dataset.timerMode);
  });
});

$("#openFocusBtn").addEventListener("click", () => {
  selectedFocusTask = null;
  $("#focusSelectedTask").textContent =
    "Focus on one thing at a time. You've got this.";
  openModal("focusModal");
});

/* ==========================================
   APPLICATION RENDER
========================================== */

function renderApp() {
  renderSubjects();
  renderStats();
  renderTasks();
  renderCalendar();
  renderSubjectOverview();
  renderWeekChart();
  renderTimer();

  if (activeView === "analytics") {
    renderAnalytics();
  }

  updateNavigation();
}

/* ==========================================
   INITIALIZE
========================================== */

function initialize() {
  // Keep legacy tasks and their IDs intact.
  tasks = tasks.map(normalizeTask);

  // Give old tasks a sensible default date if needed.
  tasks.forEach(task => {
    if (!task.date && task.deadline) {
      task.date = task.deadline;
    }
  });

  // Set the task form's initial date.
  $("#taskDate").value = localDate();

  // Apply the saved appearance.
  applyTheme(readJSON(STORAGE.theme, "light"));

  // Display the profile selection first if no name was saved.
  if (!profile.name || !profile.name.trim()) {
    showNameScreen();
  } else {
    showDashboard();
  }

  // Persist normalized tasks if the existing storage is usable.
  writeJSON(STORAGE.tasks, tasks);
}

initialize();