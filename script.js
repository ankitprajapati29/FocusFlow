/* ==========================================
   FocusFlow — Smart Student Study Planner
   Corrected JavaScript
========================================== */

"use strict";

/* ---------- Storage ---------- */

const STORAGE = {
  profile: "focusFlowProfileV2",
  tasks: "focusFlowTasksV1",
  subjects: "focusFlowSubjectsV2",
  theme: "focusFlowThemeV2",
  stats: "focusFlowStatsV2"
};

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Storage error:", error);
  }
}

const DEFAULT_SUBJECTS = [
  "College",
  "DSA",
  "Development",
  "Revision"
];

const state = {
  profile: load(STORAGE.profile, { name: "" }),
  tasks: load(STORAGE.tasks, []),
  subjects: load(STORAGE.subjects, DEFAULT_SUBJECTS),
  stats: load(STORAGE.stats, {
    totalFocusMinutes: 0,
    completedSessions: 0,
    dailyFocus: {},
    lastStudyDate: "",
    streak: 0
  }),
  page: "today",
  calendar: "day",
  date: new Date(),
  filter: "all",
  sort: "date",
  search: "",
  selectedSubject: null,
  editingTask: null,
  selectedFocusTask: null,
  timerMode: "focus",
  timerSeconds: 1500,
  timerRemaining: 1500,
  timerRunning: false,
  timerInterval: null
};

/* ---------- Helpers ---------- */

function pad(number) {
  return String(number).padStart(2, "0");
}

function dateKey(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function parseDate(value) {
  if (!value) return startOfDay(new Date());

  if (value instanceof Date) {
    return startOfDay(value);
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );
    }
  }

  const result = new Date(value);

  return Number.isNaN(result.getTime())
    ? startOfDay(new Date())
    : startOfDay(result);
}

function dateOffset(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function makeId() {
  return window.crypto?.randomUUID?.() ||
    `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isCompleted(task) {
  return task.status === "completed" || task.completed === true;
}

function sameDay(first, second) {
  return dateKey(parseDate(first)) === dateKey(parseDate(second));
}

function showToast(message) {
  const toast = $("#toast");
  const messageElement = $("#toastMessage");

  if (!toast) {
    console.log(message);
    return;
  }

  if (messageElement) {
    messageElement.textContent = message;
  } else {
    toast.textContent = message;
  }

  toast.classList.add("show", "visible", "active");

  clearTimeout(showToast.timeout);

  showToast.timeout = setTimeout(() => {
    toast.classList.remove("show", "visible", "active");
  }, 2500);
}

/* ---------- Task Data ---------- */

function normalizeTask(task) {
  const completed =
    task.status === "completed" || task.completed === true;

  return {
    id: task.id || makeId(),
    title: String(task.title || "Untitled task"),
    subject: task.subject || "College",
    priority: ["low", "medium", "high"].includes(task.priority)
      ? task.priority
      : "medium",
    date: typeof task.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(task.date)
      ? task.date
      : dateKey(new Date()),
    time: task.time || "09:00",
    duration: Number(task.duration) || 30,
    repeat: task.repeat || "none",
    notes: task.notes || "",
    inbox: Boolean(task.inbox),
    status: completed ? "completed" : "pending",
    completed,
    completedAt: task.completedAt || null,
    focusMinutes: Number(task.focusMinutes) || 0
  };
}

function saveTasks() {
  save(STORAGE.tasks, state.tasks);
}

function getTodayTasks() {
  return state.tasks.filter(task =>
    sameDay(task.date, new Date()) && !task.inbox
  );
}

function getTaskDateTime(task) {
  const date = parseDate(task.date);
  const parts = (task.time || "09:00").split(":").map(Number);

  date.setHours(parts[0] || 0, parts[1] || 0, 0, 0);

  return date;
}

/* ---------- Profile ---------- */

function renderProfile() {
  const name = state.profile.name || "Student";
  const initials = name.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  if ($("#welcomeEyebrow")) {
    $("#welcomeEyebrow").textContent =
      `WELCOME BACK, ${name.split(/\s+/)[0].toUpperCase()}`;
  }

  if ($("#profileAvatar")) {
    $("#profileAvatar").textContent = initials;
  }

  if ($("#sidebarName")) {
    $("#sidebarName").textContent = name;
  }

  if ($("#sidebarAvatar")) {
    $("#sidebarAvatar").textContent = initials;
  }

  if ($("#nameScreen") && $("#appShell")) {
    const needsName = !state.profile.name.trim();

    $("#nameScreen").hidden = !needsName;
    $("#appShell").hidden = needsName;
  }
}

function initializeProfile() {
  const input = $("#userName");

  if (input) {
    input.value = state.profile.name || "";
  }

  $("#nameForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const name = input?.value.trim();

    if (!name) {
      showToast("Please enter your name.");
      return;
    }

    state.profile.name = name;
    save(STORAGE.profile, state.profile);

    renderProfile();
    showToast("Welcome to FocusFlow!");
  });

  $("#changeNameBtn")?.addEventListener("click", () => {
    const name = prompt(
      "Enter your name:",
      state.profile.name || ""
    );

    if (!name?.trim()) return;

    state.profile.name = name.trim();
    save(STORAGE.profile, state.profile);
    renderProfile();
  });

  renderProfile();
}

/* ---------- Subjects ---------- */

function renderSubjects() {
  const nav = $("#subjectNav");

  if (nav) {
    nav.innerHTML = state.subjects.map(subject => {
      const count = state.tasks.filter(task =>
        task.subject === subject && !isCompleted(task)
      ).length;

      return `
        <button type="button"
          class="subject-nav-item"
          data-subject-filter="${escapeHTML(subject)}">
          <span class="subject-dot"></span>
          <span>${escapeHTML(subject)}</span>
          <span class="subject-count">${count}</span>
        </button>
      `;
    }).join("");
  }

  const select = $("#taskSubject");

  if (select) {
    const previous = select.value;

    select.innerHTML = state.subjects.map(subject => `
      <option value="${escapeHTML(subject)}">
        ${escapeHTML(subject)}
      </option>
    `).join("");

    if (state.subjects.includes(previous)) {
      select.value = previous;
    }
  }

  const suggestions = $("#subjectSuggestions");

  if (suggestions) {
    suggestions.innerHTML = state.subjects.map(subject => `
      <option value="${escapeHTML(subject)}"></option>
    `).join("");
  }

  updateSidebarCounts();
}

function initializeSubjects() {
  $("#addSubjectBtn")?.addEventListener("click", openSubjectModal);

  $("#subjectForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const input = $("#newSubjectName");
    const name = input?.value.trim().replace(/\s+/g, " ");

    if (!name) {
      showToast("Enter a subject name.");
      return;
    }

    if (state.subjects.some(subject =>
      subject.toLowerCase() === name.toLowerCase()
    )) {
      showToast("Subject already exists.");
      return;
    }

    state.subjects.push(name);
    save(STORAGE.subjects, state.subjects);

    renderSubjects();
    closeModal("subjectModal");

    if (input) input.value = "";

    showToast("Subject added.");
  });

  $("#subjectNav")?.addEventListener("click", event => {
    const button = event.target.closest("[data-subject-filter]");

    if (!button) return;

    state.selectedSubject = button.dataset.subjectFilter;
    state.search = "";

    if ($("#searchInput")) {
      $("#searchInput").value = "";
    }

    renderTaskList();
  });

  renderSubjects();
}

function openSubjectModal() {
  if ($("#subjectModal")) {
    openModal("subjectModal");
    $("#newSubjectName")?.focus();
    return;
  }

  const name = prompt("Enter subject name:");

  if (!name?.trim()) return;

  const cleanName = name.trim();

  if (state.subjects.includes(cleanName)) {
    showToast("Subject already exists.");
    return;
  }

  state.subjects.push(cleanName);
  save(STORAGE.subjects, state.subjects);
  renderSubjects();
}

/* ---------- Theme ---------- */

function applyTheme(theme) {
  const dark = theme === "dark";

  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", dark);
  document.body.classList.toggle("dark", dark);

  save(STORAGE.theme, dark ? "dark" : "light");
}

function initializeTheme() {
  applyTheme(load(STORAGE.theme, "light"));

  $("#themeToggle")?.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme;

    applyTheme(current === "dark" ? "light" : "dark");
  });
}

/* ---------- Modals ---------- */

function openModal(id) {
  const modal = document.getElementById(id);

  if (!modal) return;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  const modal = document.getElementById(id);

  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  if (!document.querySelector(".modal-backdrop.open")) {
    document.body.classList.remove("modal-open");
  }
}

function initializeModals() {
  document.addEventListener("click", event => {
    const closeButton = event.target.closest(
      "[data-close-modal], .modal-close, .close-modal"
    );

    if (closeButton) {
      const modal = closeButton.closest(".modal-backdrop");

      if (modal) closeModal(modal.id);
    }

    if (
      event.target.classList.contains("modal-backdrop") &&
      event.target.id
    ) {
      closeModal(event.target.id);
    }

    const openButton = event.target.closest("[data-open-modal]");

    if (openButton) {
      openModal(openButton.dataset.openModal);
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $$(".modal-backdrop.open").forEach(modal => {
        closeModal(modal.id);
      });
    }
  });
}

/* ---------- Task Form ---------- */

function openTaskModal(task = null, defaults = {}) {
  const form = $("#taskForm");

  if (!form) {
    showToast("Task form not found.");
    return;
  }

  state.editingTask = task?.id || null;
  form.reset();

  const values = {
    taskId: task?.id || "",
    taskTitle: task?.title || "",
    taskSubject: task?.subject || state.subjects[0] || "College",
    taskPriority: task?.priority || "medium",
    taskDate: task?.date || defaults.date || dateKey(new Date()),
    taskTime: task?.time || defaults.time || "09:00",
    taskDuration: task?.duration || 30,
    taskRepeat: task?.repeat || "none",
    taskNotes: task?.notes || ""
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);

    if (element) element.value = value;
  });

  if ($("#taskInbox")) {
    $("#taskInbox").checked = task ? Boolean(task.inbox) : false;
  }

  if ($("#modalTitle")) {
    $("#modalTitle").textContent = task ? "Edit task" : "Add a task";
  }

  if ($("#saveTaskBtn")) {
    $("#saveTaskBtn").textContent = task ? "Save changes" : "Add task";
  }

  openModal("taskModal");
  setTimeout(() => $("#taskTitle")?.focus(), 50);
}

function initializeTaskForm() {
  $("#quickAddBtn")?.addEventListener("click", () => openTaskModal());
  $("#addTaskBtn")?.addEventListener("click", () => openTaskModal());

  $("#taskForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const title = $("#taskTitle")?.value.trim();

    if (!title) {
      showToast("Enter a task title.");
      return;
    }

    const data = normalizeTask({
      id: $("#taskId")?.value || makeId(),
      title,
      subject: $("#taskSubject")?.value || "College",
      priority: $("#taskPriority")?.value || "medium",
      date: $("#taskDate")?.value || dateKey(new Date()),
      time: $("#taskTime")?.value || "09:00",
      duration: $("#taskDuration")?.value || 30,
      repeat: $("#taskRepeat")?.value || "none",
      notes: $("#taskNotes")?.value.trim() || "",
      inbox: Boolean($("#taskInbox")?.checked)
    });

    if (state.editingTask) {
      const index = state.tasks.findIndex(task =>
        task.id === state.editingTask
      );

      if (index !== -1) {
        data.status = state.tasks[index].status;
        data.completed = state.tasks[index].completed;
        data.completedAt = state.tasks[index].completedAt;

        state.tasks[index] = data;
      }
    } else {
      state.tasks.push(data);
    }

    saveTasks();

    closeModal("taskModal");
    renderApp();

    showToast("Task saved.");
    state.editingTask = null;
  });
}

/* ---------- Task Actions ---------- */

function completeTask(id) {
  const task = state.tasks.find(item => item.id === id);

  if (!task) return;

  const completed = isCompleted(task);

  task.status = completed ? "pending" : "completed";
  task.completed = !completed;
  task.completedAt = completed ? null : new Date().toISOString();

  saveTasks();
  renderApp();

  showToast(completed ? "Task reopened." : "Task completed!");
}

function deleteTask(id) {
  const task = state.tasks.find(item => item.id === id);

  if (!task || !confirm(`Delete "${task.title}"?`)) return;

  state.tasks = state.tasks.filter(item => item.id !== id);

  saveTasks();
  renderApp();

  showToast("Task deleted.");
}

function initializeTaskActions() {
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-task-action]");

    if (!button) return;

    const id = button.dataset.taskId;

    if (!id) return;

    const task = state.tasks.find(item => item.id === id);

    switch (button.dataset.taskAction) {
      case "complete":
        completeTask(id);
        break;

      case "delete":
        deleteTask(id);
        break;

      case "edit":
        if (task) openTaskModal(task);
        break;

      case "focus":
        if (task) {
          state.selectedFocusTask = task.id;
          openFocusModal();
        }
        break;
    }
  });
}

/* ---------- Task List ---------- */

function getVisibleTasks() {
  let tasks = [...state.tasks];

  if (state.page === "today") {
    tasks = tasks.filter(task =>
      sameDay(task.date, new Date()) && !task.inbox
    );
  } else if (state.page === "upcoming") {
    tasks = tasks.filter(task =>
      getTaskDateTime(task) >= startOfDay(new Date())
    );
  } else if (state.page === "inbox") {
    tasks = tasks.filter(task => task.inbox);
  } else if (state.page === "completed") {
    tasks = tasks.filter(isCompleted);
  }

  if (state.selectedSubject) {
    tasks = tasks.filter(task =>
      task.subject === state.selectedSubject
    );
  }

  if (state.filter === "pending") {
    tasks = tasks.filter(task => !isCompleted(task));
  } else if (state.filter === "completed") {
    tasks = tasks.filter(isCompleted);
  } else if (state.filter === "high") {
    tasks = tasks.filter(task => task.priority === "high");
  }

  if (state.search) {
    const query = state.search.toLowerCase();

    tasks = tasks.filter(task =>
      task.title.toLowerCase().includes(query) ||
      task.subject.toLowerCase().includes(query) ||
      task.notes.toLowerCase().includes(query)
    );
  }

  tasks.sort((a, b) => {
    if (state.sort === "title") {
      return a.title.localeCompare(b.title);
    }

    if (state.sort === "priority") {
      const priority = { high: 3, medium: 2, low: 1 };

      return priority[b.priority] - priority[a.priority];
    }

    return getTaskDateTime(a) - getTaskDateTime(b);
  });

  return tasks;
}

function renderTaskList() {
  const container = $("#taskList");

  if (!container) return;

  const tasks = getVisibleTasks();

  if (!tasks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✓</div>
        <h3>Nothing on your list</h3>
        <p>Add a task to start planning your day.</p>
        <button type="button" class="btn btn-primary" id="emptyAddTask">
          Add task
        </button>
      </div>
    `;

    $("#emptyAddTask")?.addEventListener("click", () => openTaskModal());

    return;
  }

  container.innerHTML = tasks.map(task => `
    <article class="task-card ${isCompleted(task) ? "is-complete" : ""}"
      data-task-id="${escapeHTML(task.id)}">

      <button type="button"
        class="task-check ${isCompleted(task) ? "checked" : ""}"
        data-task-action="complete"
        data-task-id="${escapeHTML(task.id)}"
        aria-label="Complete task">
        ${isCompleted(task) ? "✓" : ""}
      </button>

      <div class="task-main">
        <h3 class="task-title">${escapeHTML(task.title)}</h3>

        <div class="task-meta">
          <span>${escapeHTML(task.subject)}</span>
          <span>${escapeHTML(task.time)}</span>
          <span>${task.duration} min</span>
          <span class="priority-${escapeHTML(task.priority)}">
            ${escapeHTML(task.priority)}
          </span>
        </div>

        ${task.notes
          ? `<p class="task-notes">${escapeHTML(task.notes)}</p>`
          : ""}
      </div>

      <div class="task-actions">
        <button type="button" data-task-action="focus"
          data-task-id="${escapeHTML(task.id)}">Focus</button>

        <button type="button" data-task-action="edit"
          data-task-id="${escapeHTML(task.id)}">Edit</button>

        <button type="button" data-task-action="delete"
          data-task-id="${escapeHTML(task.id)}">Delete</button>
      </div>
    </article>
  `).join("");
}

// Compatibility with any older calls in the app.
function renderTasks() {
  renderTaskList();
}

/* ---------- Calendar ---------- */

function startOfWeek(date) {
  const result = startOfDay(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));

  return result;
}

function renderCalendarHeader() {
  const label = $("#calendarDateLabel");

  if (!label) return;

  if (state.calendar === "day") {
    label.textContent = state.date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } else if (state.calendar === "week") {
    const first = startOfWeek(state.date);
    const last = dateOffset(first, 6);

    label.textContent =
      `${first.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
      })} – ${last.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })}`;
  } else {
    label.textContent = state.date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });
  }
}

function calendarTaskMarkup(task) {
  return `
    <button type="button"
      class="calendar-task priority-${escapeHTML(task.priority)}"
      data-task-action="edit"
      data-task-id="${escapeHTML(task.id)}">
      ${escapeHTML(task.time)} ${escapeHTML(task.title)}
    </button>
  `;
}

function renderCalendar() {
  const container = $("#calendarView");

  if (!container) return;

  renderCalendarHeader();

  if (state.calendar === "day") {
    const key = dateKey(state.date);

    const tasks = state.tasks.filter(task =>
      task.date === key && !task.inbox
    );

    container.innerHTML = `
      <div class="day-calendar">
        ${Array.from({ length: 15 }, (_, index) => index + 6)
          .map(hour => {
            const time = `${pad(hour)}:00`;

            const matching = tasks.filter(task =>
              Number(task.time.split(":")[0]) === hour
            );

            return `
              <div class="calendar-hour"
                data-date="${key}" data-time="${time}">
                <div class="calendar-hour-label">${time}</div>

                <div class="calendar-hour-content">
                  ${matching.map(calendarTaskMarkup).join("")}

                  <button type="button" class="calendar-add"
                    data-calendar-add="${key}"
                    data-time="${time}">+</button>
                </div>
              </div>
            `;
          }).join("")}
      </div>
    `;
  } else if (state.calendar === "week") {
    const first = startOfWeek(state.date);

    container.innerHTML = `
      <div class="week-calendar">
        ${Array.from({ length: 7 }, (_, index) => dateOffset(first, index))
          .map(date => {
            const key = dateKey(date);

            const tasks = state.tasks.filter(task =>
              task.date === key && !task.inbox
            );

            return `
              <section class="week-day" data-date="${key}">
                <header>
                  <span>${date.toLocaleDateString("en-IN", {
                    weekday: "short"
                  })}</span>
                  <strong>${date.getDate()}</strong>
                </header>

                <button type="button" class="week-add-slot"
                  data-calendar-add="${key}" data-time="09:00">
                  + Add
                </button>

                ${tasks.map(calendarTaskMarkup).join("")}
              </section>
            `;
          }).join("")}
      </div>
    `;
  } else {
    const first = new Date(
      state.date.getFullYear(),
      state.date.getMonth(),
      1
    );

    const gridStart = startOfWeek(first);

    container.innerHTML = `
      <div class="month-calendar">
        <div class="month-weekdays">
          ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            .map(day => `<span>${day}</span>`).join("")}
        </div>

        <div class="month-grid">
          ${Array.from({ length: 42 }, (_, index) =>
            dateOffset(gridStart, index)
          ).map(date => {
            const key = dateKey(date);

            const tasks = state.tasks.filter(task =>
              task.date === key && !task.inbox
            );

            return `
              <div class="month-day ${
                date.getMonth() !== state.date.getMonth()
                  ? "outside-month"
                  : ""
              }" data-date="${key}">
                <button type="button" class="month-day-number"
                  data-select-date="${key}">
                  ${date.getDate()}
                </button>

                ${tasks.slice(0, 3).map(calendarTaskMarkup).join("")}

                <button type="button" class="month-add"
                  data-calendar-add="${key}" data-time="09:00">+</button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }
}

function initializeCalendar() {
  $$("[data-calendar]").forEach(button => {
    button.addEventListener("click", () => {
      state.calendar = button.dataset.calendar;

      $$("[data-calendar]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      renderCalendar();
    });
  });

  $("#prevDate")?.addEventListener("click", () => {
    if (state.calendar === "day") {
      state.date = dateOffset(state.date, -1);
    } else if (state.calendar === "week") {
      state.date = dateOffset(state.date, -7);
    } else {
      state.date = new Date(
        state.date.getFullYear(),
        state.date.getMonth() - 1,
        1
      );
    }

    renderCalendar();
  });

  $("#nextDate")?.addEventListener("click", () => {
    if (state.calendar === "day") {
      state.date = dateOffset(state.date, 1);
    } else if (state.calendar === "week") {
      state.date = dateOffset(state.date, 7);
    } else {
      state.date = new Date(
        state.date.getFullYear(),
        state.date.getMonth() + 1,
        1
      );
    }

    renderCalendar();
  });

  $("#goToday")?.addEventListener("click", () => {
    state.date = startOfDay(new Date());
    renderCalendar();
  });

  $("#calendarView")?.addEventListener("click", event => {
    const addButton = event.target.closest("[data-calendar-add]");

    if (addButton) {
      openTaskModal(null, {
        date: addButton.dataset.calendarAdd,
        time: addButton.dataset.time
      });

      return;
    }

    const dateButton = event.target.closest("[data-select-date]");

    if (dateButton) {
      state.date = parseDate(dateButton.dataset.selectDate);
      state.calendar = "day";

      $$("[data-calendar]").forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.calendar === "day"
        );
      });

      renderCalendar();
    }
  });
}

/* ---------- Search / Filters ---------- */

function initializeFilters() {
  $("#searchInput")?.addEventListener("input", event => {
    state.search = event.target.value.trim();
    renderTaskList();
  });

  $("#filterStatus")?.addEventListener("change", event => {
    state.filter = event.target.value;
    renderTaskList();
  });

  $("#sortTasks")?.addEventListener("change", event => {
    state.sort = event.target.value;
    renderTaskList();
  });

  $("#showAllTasks")?.addEventListener("click", () => {
    state.page = "all";
    state.selectedSubject = null;
    renderApp();
  });
}

/* ---------- Navigation ---------- */

function initializeNavigation() {
  $$(".nav-item[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      state.page = button.dataset.view;
      state.selectedSubject = null;

      $$(".nav-item[data-view]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      const titles = {
        today: ["Today", "Your day, organized."],
        upcoming: ["Upcoming", "Plan what comes next."],
        inbox: ["Inbox", "Tasks waiting to be scheduled."],
        completed: ["Completed", "Look at what you've accomplished."],
        analytics: ["Study insights", "See your progress over time."],
        about: ["About FocusFlow", "Your personal study planner."]
      };

      const [title, subtitle] = titles[state.page] || ["FocusFlow", ""];

      if ($("#pageTitle")) $("#pageTitle").textContent = title;
      if ($("#pageSubtitle")) $("#pageSubtitle").textContent = subtitle;
      if ($("#breadcrumbCurrent")) {
        $("#breadcrumbCurrent").textContent = title;
      }

      const pages = $$(".app-view, [data-page]");

      pages.forEach(section => {
        const name = section.dataset.page ||
          section.id.replace(/Page$/, "").replace(/^view-/, "");

        section.hidden = name !== state.page;
        section.classList.toggle("active", name === state.page);
      });

      renderApp();

      $("#sidebar")?.classList.remove("open");
      $("#mobileScrim")?.classList.remove("visible");
    });
  });

  $("#menuToggle")?.addEventListener("click", () => {
    $("#sidebar")?.classList.toggle("open");
    $("#mobileScrim")?.classList.toggle("visible");
  });

  $("#mobileScrim")?.addEventListener("click", () => {
    $("#sidebar")?.classList.remove("open");
    $("#mobileScrim")?.classList.remove("visible");
  });
}

/* ---------- Dashboard ---------- */

function updateSidebarCounts() {
  const todayCount = $("#todayCount");
  const inboxCount = $("#inboxCount");

  if (todayCount) {
    todayCount.textContent = state.tasks.filter(task =>
      sameDay(task.date, new Date()) &&
      !task.inbox &&
      !isCompleted(task)
    ).length;
  }

  if (inboxCount) {
    inboxCount.textContent = state.tasks.filter(task =>
      task.inbox && !isCompleted(task)
    ).length;
  }
}

function renderDashboardMetrics() {
  const today = getTodayTasks();
  const completed = today.filter(isCompleted);

  const metrics = {
    plannedTasks: today.length,
    completedToday: completed.length,
    completionRate: today.length
      ? Math.round(completed.length / today.length * 100)
      : 0,
    plannedToday: today.filter(task => !isCompleted(task))
      .reduce((sum, task) => sum + task.duration, 0),
    focusToday: state.stats.dailyFocus[dateKey(new Date())] || 0,
    streakCount: state.stats.streak || 0
  };

  Object.entries(metrics).forEach(([id, value]) => {
    const element = document.getElementById(id);

    if (!element) return;

    if (id === "completionRate") {
      element.textContent = `${value}%`;
    } else if (id === "plannedToday" || id === "focusToday") {
      element.textContent = `${value} min`;
    } else {
      element.textContent = value;
    }
  });

  updateSidebarCounts();
}

function renderTaskPreviews() {
  const subjectOverview = $("#subjectOverview");

  if (subjectOverview) {
    subjectOverview.innerHTML = state.subjects.map(subject => {
      const count = state.tasks.filter(task =>
        task.subject === subject &&
        sameDay(task.date, new Date())
      ).length;

      return `
        <div class="subject-overview-row">
          <span>${escapeHTML(subject)}</span>
          <strong>${count}</strong>
        </div>
      `;
    }).join("");
  }
}

/* ---------- Pomodoro ---------- */

const TIMER_MODES = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60
};

function formatTime(seconds) {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function updateTimerDisplay() {
  if ($("#timerTime")) {
    $("#timerTime").textContent = formatTime(state.timerRemaining);
  }

  if ($("#timerCaption")) {
    $("#timerCaption").textContent = {
      focus: "Time to focus",
      short: "Take a short break",
      long: "Recharge with a long break"
    }[state.timerMode];
  }

  if ($("#timerStart")) {
    $("#timerStart").textContent = state.timerRunning ? "Pause" : "Start";
  }

  if ($("#sessionCount")) {
    $("#sessionCount").textContent =
      state.stats.completedSessions || 0;
  }
}

function stopTimer() {
  clearInterval(state.timerInterval);

  state.timerInterval = null;
  state.timerRunning = false;

  updateTimerDisplay();
}

function selectTimerMode(mode) {
  if (!(mode in TIMER_MODES)) return;

  stopTimer();

  state.timerMode = mode;
  state.timerSeconds = TIMER_MODES[mode];
  state.timerRemaining = state.timerSeconds;

  $$("[data-timer-mode]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.timerMode === mode
    );
  });

  updateTimerDisplay();
}

function startTimer() {
  if (state.timerRunning) {
    stopTimer();
    return;
  }

  state.timerRunning = true;
  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    state.timerRemaining--;

    if (state.timerRemaining <= 0) {
      stopTimer();
      finishTimerSession();
      return;
    }

    updateTimerDisplay();
  }, 1000);
}

function resetTimer() {
  stopTimer();
  state.timerRemaining = state.timerSeconds;
  updateTimerDisplay();
}

function finishTimerSession() {
  if (state.timerMode === "focus") {
    const minutes = Math.round(state.timerSeconds / 60);
    const today = dateKey(new Date());

    state.stats.totalFocusMinutes =
      (state.stats.totalFocusMinutes || 0) + minutes;

    state.stats.completedSessions =
      (state.stats.completedSessions || 0) + 1;

    state.stats.dailyFocus[today] =
      (state.stats.dailyFocus[today] || 0) + minutes;

    const last = state.stats.lastStudyDate;
    const yesterday = dateKey(dateOffset(new Date(), -1));

    if (last !== today) {
      state.stats.streak = last === yesterday
        ? (state.stats.streak || 0) + 1
        : 1;

      state.stats.lastStudyDate = today;
    }

    if (state.selectedFocusTask) {
      const task = state.tasks.find(item =>
        item.id === state.selectedFocusTask
      );

      if (task) {
        task.focusMinutes = (task.focusMinutes || 0) + minutes;
        saveTasks();
      }
    }

    save(STORAGE.stats, state.stats);
    showToast("Focus session completed!");
    renderApp();
  } else {
    showToast("Break complete!");
  }

  state.timerRemaining = state.timerSeconds;
  updateTimerDisplay();
}

function openFocusModal() {
  openModal("focusModal");

  const task = state.tasks.find(item =>
    item.id === state.selectedFocusTask
  );

  if ($("#focusSelectedTask")) {
    $("#focusSelectedTask").textContent = task
      ? `Focusing on: ${task.title}`
      : "Time to focus.";
  }

  updateTimerDisplay();
}

function initializeTimer() {
  $$("[data-timer-mode]").forEach(button => {
    button.addEventListener("click", () => {
      selectTimerMode(button.dataset.timerMode);
    });
  });

  $("#timerStart")?.addEventListener("click", startTimer);
  $("#timerReset")?.addEventListener("click", resetTimer);

  $("#openFocusBtn")?.addEventListener("click", () => {
    state.selectedFocusTask = null;
    openFocusModal();
  });

  $("#focusBannerBtn")?.addEventListener("click", () => {
    state.selectedFocusTask = null;
    openFocusModal();
  });

  updateTimerDisplay();
}

/* ---------- Analytics ---------- */

function renderAnalytics() {
  const completed = state.tasks.filter(isCompleted).length;
  const total = state.tasks.length;
  const minutes = state.stats.totalFocusMinutes || 0;

  const metrics = $("#analyticsMetrics");

  if (metrics) {
    metrics.innerHTML = `
      <div class="analytics-metric">
        <span>Total tasks</span>
        <strong>${total}</strong>
      </div>
      <div class="analytics-metric">
        <span>Completed</span>
        <strong>${completed}</strong>
      </div>
      <div class="analytics-metric">
        <span>Focus time</span>
        <strong>${Math.floor(minutes / 60)}h ${minutes % 60}m</strong>
      </div>
      <div class="analytics-metric">
        <span>Sessions</span>
        <strong>${state.stats.completedSessions || 0}</strong>
      </div>
    `;
  }

  const subjects = $("#analyticsSubjects");

  if (subjects) {
    subjects.innerHTML = state.subjects.map(subject => {
      const totalMinutes = state.tasks
        .filter(task => task.subject === subject)
        .reduce((sum, task) => sum + (task.focusMinutes || 0), 0);

      return `
        <div class="subject-analytics-row">
          <span>${escapeHTML(subject)}</span>
          <strong>${totalMinutes} min</strong>
        </div>
      `;
    }).join("");
  }

  const weekTotal = $("#weekTotal");

  if (weekTotal) {
    const totalWeek = Array.from({ length: 7 }, (_, index) => {
      const date = dateKey(dateOffset(new Date(), index - 6));

      return state.stats.dailyFocus[date] || 0;
    }).reduce((sum, value) => sum + value, 0);

    weekTotal.textContent = `${totalWeek} min`;
  }
}

/* ---------- Global Render ---------- */

function renderApp() {
  renderProfile();
  renderSubjects();
  renderDashboardMetrics();
  renderCalendar();
  renderTaskList();
  renderTaskPreviews();

  if (state.page === "analytics") {
    renderAnalytics();
  }

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

/* ---------- Initialization ---------- */

function initializeApp() {
  state.tasks = Array.isArray(state.tasks)
    ? state.tasks.map(normalizeTask)
    : [];

  state.subjects = Array.isArray(state.subjects)
    ? [...new Set(state.subjects.filter(Boolean))]
    : [...DEFAULT_SUBJECTS];

  saveTasks();
  save(STORAGE.subjects, state.subjects);

  initializeProfile();
  initializeTheme();
  initializeModals();
  initializeSubjects();
  initializeTaskForm();
  initializeTaskActions();
  initializeCalendar();
  initializeFilters();
  initializeNavigation();
  initializeTimer();

  if ($("#topDate")) {
    $("#topDate").textContent = new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  }

  if ($("#footerYear")) {
    $("#footerYear").textContent = new Date().getFullYear();
  }

  renderApp();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp, {
    once: true
  });
} else {
  initializeApp();
}