/* =========================================
   FocusFlow — Smart Student Study Planner
   Part 1: Setup, storage, profile, subjects
========================================= */

"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

const STORAGE = {
  profile: "focusFlowProfileV2",
  tasks: "focusFlowTasksV1",
  subjects: "focusFlowSubjectsV2",
  theme: "focusFlowThemeV2",
  stats: "focusFlowStatsV2"
};

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
  date: startOfDay(new Date()),
  calendar: "day",
  filter: "all",
  sort: "date",
  search: "",
  editingTask: null,
  selectedFocusTask: null,
  timerMode: "focus",
  timerSeconds: 25 * 60,
  timerRemaining: 25 * 60,
  timerRunning: false,
  timerInterval: null,
  sessionCount: 0
};

function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? structuredCloneSafe(fallback) : JSON.parse(value);
  } catch (error) {
    console.warn("Storage read failed:", key, error);
    return structuredCloneSafe(fallback);
  }
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Storage save failed:", key, error);
    showToast("Browser storage save nahi ho paya.");
  }
}

function saveTasks() {
  save(STORAGE.tasks, state.tasks);
}

function saveSubjects() {
  save(STORAGE.subjects, state.subjects);
}

function saveStats() {
  save(STORAGE.stats, state.stats);
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function parseDate(value) {
  if (!value) return startOfDay(new Date());

  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return startOfDay(new Date());
  }

  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat("en-IN", options).format(date);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function makeId() {
  return window.crypto?.randomUUID?.() ||
    `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show", "visible", "active");
  toast.setAttribute("role", "status");

  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.classList.remove("show", "visible", "active");
  }, 2600);
}

function sameDay(first, second) {
  return dateKey(parseDate(first)) === dateKey(parseDate(second));
}

function isToday(date) {
  return dateKey(date) === dateKey(new Date());
}

function getTaskDate(task) {
  return parseDate(task.date);
}

function getTaskDuration(task) {
  const value = Number(task.duration);
  return Number.isFinite(value) && value > 0 ? value : 30;
}

function getTaskTime(task) {
  return task.time || "09:00";
}

function getTaskDateTime(task) {
  const date = getTaskDate(task);
  const [hours, minutes] = getTaskTime(task).split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function isCompleted(task) {
  return task.status === "completed" || task.completed === true;
}

function normalizeTask(task) {
  return {
    id: task.id || makeId(),
    title: String(task.title || "Untitled task"),
    subject: task.subject || "College",
    priority: ["low", "medium", "high"].includes(task.priority)
      ? task.priority
      : "medium",
    date: task.date || dateKey(new Date()),
    time: task.time || "09:00",
    duration: Number(task.duration) || 30,
    repeat: task.repeat || "none",
    notes: task.notes || "",
    inbox: Boolean(task.inbox),
    status: isCompleted(task) ? "completed" : "pending",
    completed: isCompleted(task),
    createdAt: task.createdAt || new Date().toISOString(),
    completedAt: task.completedAt || null
  };
}

/* ---------- Profile ---------- */

function renderProfile() {
  const name = state.profile.name || "Student";
  const firstName = name.trim().split(/\s+/)[0] || "Student";
  const initials = name.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  const welcome = $("#welcomeEyebrow");
  if (welcome) welcome.textContent = `WELCOME BACK, ${firstName.toUpperCase()}`;

  const title = $("#pageTitle");
  if (title && !title.dataset.customTitle) {
    title.textContent = "Your day, organized.";
  }

  const avatar = $("#profileAvatar");
  if (avatar) avatar.textContent = initials || "S";

  const sidebarName = $("#sidebarName");
  if (sidebarName) sidebarName.textContent = name;

  const sidebarAvatar = $("#sidebarAvatar");
  if (sidebarAvatar) sidebarAvatar.textContent = initials || "S";

  const screen = $("#nameScreen");
  const shell = $("#appShell");

  if (screen && shell) {
    const needsName = !state.profile.name.trim();
    screen.hidden = !needsName;
    shell.hidden = needsName;
  }
}

function initializeProfile() {
  const form = $("#nameForm");
  const input = $("#userName");

  if (input) input.value = state.profile.name || "";

  form?.addEventListener("submit", event => {
    event.preventDefault();

    const name = input?.value.trim();
    if (!name) {
      showToast("Apna naam enter karo.");
      input?.focus();
      return;
    }

    state.profile.name = name;
    save(STORAGE.profile, state.profile);
    renderProfile();
    showToast(`Welcome, ${name.split(/\s+/)[0]}!`);
  });

  $("#changeNameBtn")?.addEventListener("click", () => {
    const name = prompt("Apna naam enter karo:", state.profile.name || "");
    if (name === null) return;

    if (!name.trim()) {
      showToast("Naam blank nahi ho sakta.");
      return;
    }

    state.profile.name = name.trim();
    save(STORAGE.profile, state.profile);
    renderProfile();
  });

  renderProfile();
}

/* ---------- Subjects ---------- */

function normalizeSubjectName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function renderSubjects() {
  const nav = $("#subjectNav");
  if (nav) {
    nav.innerHTML = state.subjects.map(subject => {
      const count = state.tasks.filter(task =>
        task.subject === subject && !isCompleted(task)
      ).length;

      return `
        <button class="subject-nav-item" type="button"
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

    select.innerHTML = state.subjects.map(subject =>
      `<option value="${escapeHTML(subject)}">${escapeHTML(subject)}</option>`
    ).join("");

    if (state.subjects.includes(previous)) select.value = previous;
  }

  const suggestions = $("#subjectSuggestions");
  if (suggestions) {
    suggestions.innerHTML = state.subjects.map(subject =>
      `<option value="${escapeHTML(subject)}"></option>`
    ).join("");
  }

  updateSidebarCounts();
}

function initializeSubjects() {
  $("#addSubjectBtn")?.addEventListener("click", () => {
    openSubjectModal();
  });

  $("#subjectForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const input = $("#newSubjectName");
    const name = normalizeSubjectName(input?.value);

    if (!name) {
      showToast("Subject ka naam likho.");
      return;
    }

    if (state.subjects.some(item =>
      item.toLowerCase() === name.toLowerCase()
    )) {
      showToast("Ye subject pehle se hai.");
      return;
    }

    state.subjects.push(name);
    saveSubjects();
    renderSubjects();
    closeModal("subjectModal");

    if (input) input.value = "";
    showToast("Subject add ho gaya.");
  });

  $("#subjectNav")?.addEventListener("click", event => {
    const button = event.target.closest("[data-subject-filter]");
    if (!button) return;

    state.search = "";
    state.filter = "all";
    state.selectedSubject = button.dataset.subjectFilter;

    const search = $("#searchInput");
    if (search) search.value = "";

    renderTasks();
    showToast(`${state.selectedSubject} tasks`);
  });

  renderSubjects();
}

function openSubjectModal() {
  const modal = $("#subjectModal");
  if (!modal) {
    const name = prompt("New subject ka naam:");
    if (!name) return;

    const clean = normalizeSubjectName(name);
    if (!clean || state.subjects.includes(clean)) {
      showToast("Subject invalid hai ya pehle se hai.");
      return;
    }

    state.subjects.push(clean);
    saveSubjects();
    renderSubjects();
    return;
  }

  openModal("subjectModal");
  $("#newSubjectName")?.focus();
}

/* ---------- Theme ---------- */

function initializeTheme() {
  const savedTheme = load(STORAGE.theme, "light");
  applyTheme(savedTheme);

  $("#themeToggle")?.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme ||
      (document.body.classList.contains("dark") ? "dark" : "light");

    applyTheme(current === "dark" ? "light" : "dark");
  });
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";

  document.documentElement.dataset.theme = normalized;
  document.documentElement.classList.toggle("dark", normalized === "dark");
  document.body.classList.toggle("dark", normalized === "dark");
  save(STORAGE.theme, normalized);

  const button = $("#themeToggle");
  if (button) {
    button.setAttribute(
      "aria-label",
      normalized === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    button.title = normalized === "dark" ? "Light mode" : "Dark mode";
  }
}
/* =========================================
   Part 2: Modal handling and task management
========================================= */

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
      if (modal?.id) closeModal(modal.id);
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
      document.querySelectorAll(".modal-backdrop.open").forEach(modal => {
        closeModal(modal.id);
      });
    }
  });
}

/* ---------- Task modal ---------- */

function openTaskModal(task = null, defaults = {}) {
  const form = $("#taskForm");
  if (!form) {
    showToast("Task form HTML mein nahi mila.");
    return;
  }

  state.editingTask = task ? task.id : null;
  form.reset();

  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.value = value ?? "";
  };

  setValue("taskId", task?.id || "");
  setValue("taskTitle", task?.title || "");
  setValue(
    "taskSubject",
    task?.subject || state.subjects[0] || "College"
  );
  setValue("taskPriority", task?.priority || "medium");
  setValue("taskDate", task?.date || defaults.date || dateKey(new Date()));
  setValue("taskTime", task?.time || defaults.time || "09:00");
  setValue("taskDuration", task?.duration || 30);
  setValue("taskRepeat", task?.repeat || "none");
  setValue("taskNotes", task?.notes || "");

  const inbox = $("#taskInbox");
  if (inbox) inbox.checked = task ? Boolean(task.inbox) : false;

  const title = $("#modalTitle");
  if (title) title.textContent = task ? "Edit task" : "Add a task";

  const saveButton = $("#saveTaskBtn");
  if (saveButton) {
    saveButton.textContent = task ? "Save changes" : "Add task";
  }

  openModal("taskModal");
  setTimeout(() => $("#taskTitle")?.focus(), 50);
}

function initializeTaskForm() {
  $("#quickAddBtn")?.addEventListener("click", () => openTaskModal());
  $("#addTaskBtn")?.addEventListener("click", () => openTaskModal());
  $("#emptyAddTask")?.addEventListener("click", () => openTaskModal());

  $("#taskForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const title = $("#taskTitle")?.value.trim();
    if (!title) {
      showToast("Task ka title likho.");
      $("#taskTitle")?.focus();
      return;
    }

    const taskData = normalizeTask({
      id: $("#taskId")?.value || makeId(),
      title,
      subject: $("#taskSubject")?.value || state.subjects[0] || "College",
      priority: $("#taskPriority")?.value || "medium",
      date: $("#taskDate")?.value || dateKey(new Date()),
      time: $("#taskTime")?.value || "09:00",
      duration: Number($("#taskDuration")?.value) || 30,
      repeat: $("#taskRepeat")?.value || "none",
      notes: $("#taskNotes")?.value.trim() || "",
      inbox: Boolean($("#taskInbox")?.checked)
    });

    if (state.editingTask) {
      const index = state.tasks.findIndex(
        task => task.id === state.editingTask
      );

      if (index !== -1) {
        taskData.status = state.tasks[index].status;
        taskData.completed = state.tasks[index].completed;
        taskData.completedAt = state.tasks[index].completedAt;
        state.tasks[index] = taskData;
      }
    } else {
      state.tasks.push(taskData);
    }

    saveTasks();
    closeModal("taskModal");
    renderApp();
    showToast(state.editingTask ? "Task update ho gaya." : "Task add ho gaya.");
    state.editingTask = null;
  });
}

/* ---------- Task actions ---------- */

function completeTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;

  const wasCompleted = isCompleted(task);
  task.status = wasCompleted ? "pending" : "completed";
  task.completed = !wasCompleted;
  task.completedAt = wasCompleted ? null : new Date().toISOString();

  saveTasks();
  renderApp();
  showToast(wasCompleted ? "Task pending kar diya." : "Task complete ho gaya.");
}

function deleteTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;

  if (!confirm(`"${task.title}" delete karna hai?`)) return;

  state.tasks = state.tasks.filter(item => item.id !== id);
  saveTasks();
  renderApp();
  showToast("Task delete ho gaya.");
}

function moveTask(id, date, time) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;

  task.date = date;
  if (time) task.time = time;

  saveTasks();
  renderApp();
}

function initializeTaskActions() {
  document.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-task-action]");
    if (!actionButton) return;

    const item = actionButton.closest("[data-task-id]");
    const id = actionButton.dataset.taskId || item?.dataset.taskId;
    if (!id) return;

    switch (actionButton.dataset.taskAction) {
      case "complete":
        completeTask(id);
        break;

      case "edit": {
        const task = state.tasks.find(task => task.id === id);
        if (task) openTaskModal(task);
        break;
      }

      case "delete":
        deleteTask(id);
        break;

      case "focus": {
        const task = state.tasks.find(task => task.id === id);
        if (task) {
          state.selectedFocusTask = task.id;
          openFocusModal();
        }
        break;
      }
    }
  });
}

/* ---------- Task list ---------- */

function getVisibleTasks() {
  let tasks = [...state.tasks];

  if (state.page === "inbox") {
    tasks = tasks.filter(task => task.inbox);
  } else if (state.page === "today") {
    tasks = tasks.filter(task => sameDay(task.date, new Date()));
  } else if (state.page === "upcoming") {
    tasks = tasks.filter(task =>
      getTaskDateTime(task) >= startOfDay(new Date())
    );
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
    if (state.sort === "priority") {
      const weights = { high: 3, medium: 2, low: 1 };
      return weights[b.priority] - weights[a.priority];
    }

    if (state.sort === "title") {
      return a.title.localeCompare(b.title);
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
    return;
  }

  container.innerHTML = tasks.map(task => `
    <article class="task-card ${isCompleted(task) ? "is-complete" : ""}"
      data-task-id="${escapeHTML(task.id)}"
      draggable="true">

      <button type="button"
        class="task-check ${isCompleted(task) ? "checked" : ""}"
        data-task-action="complete"
        data-task-id="${escapeHTML(task.id)}"
        aria-label="Mark task complete">
        ${isCompleted(task) ? "✓" : ""}
      </button>

      <div class="task-main">
        <h3 class="task-title">${escapeHTML(task.title)}</h3>
        <div class="task-meta">
          <span>${escapeHTML(task.subject)}</span>
          <span>${escapeHTML(task.time)}</span>
          <span>${getTaskDuration(task)} min</span>
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
          data-task-id="${escapeHTML(task.id)}" title="Focus">
          Focus
        </button>
        <button type="button" data-task-action="edit"
          data-task-id="${escapeHTML(task.id)}" title="Edit">
          Edit
        </button>
        <button type="button" data-task-action="delete"
          data-task-id="${escapeHTML(task.id)}" title="Delete">
          Delete
        </button>
      </div>
    </article>
  `).join("");
}

/* ---------- Calendar ---------- */

function startOfWeek(date) {
  const result = startOfDay(date);
  const day = result.getDay();
  result.setDate(result.getDate() - ((day + 6) % 7));
  return result;
}

function endOfWeek(date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return result;
}

function monthLabel(date) {
  return formatDate(date, { month: "long", year: "numeric" });
}

function renderCalendarHeader() {
  const label = $("#calendarDateLabel");
  if (!label) return;

  if (state.calendar === "day") {
    label.textContent = formatDate(state.date, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } else if (state.calendar === "week") {
    const first = startOfWeek(state.date);
    const last = endOfWeek(state.date);

    label.textContent =
      `${formatDate(first, { day: "numeric", month: "short" })} – ` +
      `${formatDate(last, { day: "numeric", month: "short", year: "numeric" })}`;
  } else {
    label.textContent = monthLabel(state.date);
  }
}

function calendarTaskMarkup(task) {
  return `
    <button type="button"
      class="calendar-task priority-${escapeHTML(task.priority)}"
      data-task-action="edit"
      data-task-id="${escapeHTML(task.id)}"
      title="${escapeHTML(task.title)}">
      <span>${escapeHTML(task.time)}</span>
      ${escapeHTML(task.title)}
    </button>
  `;
}

function renderDayCalendar() {
  const date = state.date;
  const key = dateKey(date);
  const tasks = state.tasks
    .filter(task => task.date === key && !task.inbox)
    .sort((a, b) => getTaskTime(a).localeCompare(getTaskTime(b)));

  const hours = Array.from({ length: 15 }, (_, index) => index + 6);

  return `
    <div class="day-calendar">
      <div class="calendar-day-heading">
        ${formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
      </div>
      ${hours.map(hour => {
        const time = `${pad(hour)}:00`;
        const matching = tasks.filter(task =>
          Number(getTaskTime(task).split(":")[0]) === hour
        );

        return `
          <div class="calendar-hour" data-date="${key}" data-time="${time}">
            <div class="calendar-hour-label">${time}</div>
            <div class="calendar-hour-content">
              ${matching.map(calendarTaskMarkup).join("")}
              <button type="button" class="calendar-add"
                data-calendar-add="${key}" data-time="${time}"
                aria-label="Add task at ${time}">+</button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderWeekCalendar() {
  const first = startOfWeek(state.date);
  const days = Array.from({ length: 7 }, (_, index) => dateOffset(first, index));

  return `
    <div class="week-calendar">
      ${days.map(date => {
        const key = dateKey(date);
        const tasks = state.tasks
          .filter(task => task.date === key && !task.inbox)
          .sort((a, b) => getTaskTime(a).localeCompare(getTaskTime(b)));

        return `
          <section class="week-day ${isToday(date) ? "is-today" : ""}"
            data-date="${key}">
            <header>
              <span>${formatDate(date, { weekday: "short" })}</span>
              <strong>${date.getDate()}</strong>
            </header>
            <button type="button" class="week-add-slot"
              data-calendar-add="${key}" data-time="09:00">+ Add</button>
            <div class="week-day-tasks">
              ${tasks.map(calendarTaskMarkup).join("")}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderMonthCalendar() {
  const first = new Date(state.date.getFullYear(), state.date.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) =>
    dateOffset(gridStart, index)
  );

  return `
    <div class="month-calendar">
      <div class="month-weekdays">
        ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          .map(day => `<span>${day}</span>`).join("")}
      </div>
      <div class="month-grid">
        ${days.map(date => {
          const key = dateKey(date);
          const tasks = state.tasks.filter(task =>
            task.date === key && !task.inbox
          );

          return `
            <div class="month-day
              ${date.getMonth() !== state.date.getMonth() ? "outside-month" : ""}
              ${isToday(date) ? "is-today" : ""}"
              data-date="${key}">
              <button type="button" class="month-day-number"
                data-select-date="${key}">${date.getDate()}</button>
              ${tasks.slice(0, 3).map(calendarTaskMarkup).join("")}
              ${tasks.length > 3
                ? `<span class="more-tasks">+${tasks.length - 3} more</span>`
                : ""}
              <button type="button" class="month-add"
                data-calendar-add="${key}" data-time="09:00">+</button>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderCalendar() {
  const container = $("#calendarView");
  if (!container) return;

  renderCalendarHeader();

  if (state.calendar === "day") {
    container.innerHTML = renderDayCalendar();
  } else if (state.calendar === "week") {
    container.innerHTML = renderWeekCalendar();
  } else {
    container.innerHTML = renderMonthCalendar();
  }
}

function initializeCalendar() {
  $$("[data-calendar]").forEach(button => {
    button.addEventListener("click", () => {
      state.calendar = button.dataset.calendar;

      $$("[data-calendar]").forEach(item => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
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

  $("#calendarView")?.addEventListener("dragstart", event => {
    const taskCard = event.target.closest("[data-task-id]");
    if (!taskCard) return;

    state.draggedTaskId = taskCard.dataset.taskId;
    event.dataTransfer?.setData("text/plain", state.draggedTaskId);
  });

  $("#calendarView")?.addEventListener("dragover", event => {
    if (event.target.closest("[data-date]")) {
      event.preventDefault();
    }
  });

  $("#calendarView")?.addEventListener("drop", event => {
    const target = event.target.closest("[data-date]");
    if (!target || !state.draggedTaskId) return;

    event.preventDefault();
    moveTask(state.draggedTaskId, target.dataset.date);
    state.draggedTaskId = null;
  });
}

/* ---------- Search and filters ---------- */

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
/* =========================================
   Part 3: Navigation, Pomodoro, Analytics
   and App Initialization
========================================= */

/* ---------- Date helper ---------- */

function dateOffset(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
}

/* ---------- Navigation ---------- */

function initializeNavigation() {
  const navItems = $$(".nav-item[data-view]");

  navItems.forEach(button => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;

      state.page = view;
      state.selectedSubject = null;

      navItems.forEach(item => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-current", item === button ? "page" : "false");
      });

      const pageTitles = {
        today: ["Today", "Your day, organized."],
        upcoming: ["Upcoming", "Plan what comes next."],
        inbox: ["Inbox", "Tasks waiting to be scheduled."],
        completed: ["Completed", "Look at what you've accomplished."],
        analytics: ["Insights", "See your progress over time."],
        about: ["About FocusFlow", "Your personal study planner."]
      };

      const [title, subtitle] = pageTitles[view] ||
        [view.charAt(0).toUpperCase() + view.slice(1), ""];

      const pageTitle = $("#pageTitle");
      const pageSubtitle = $("#pageSubtitle");
      const breadcrumb = $("#breadcrumbCurrent");

      if (pageTitle) pageTitle.textContent = title;
      if (pageSubtitle) pageSubtitle.textContent = subtitle;
      if (breadcrumb) breadcrumb.textContent = title;

      $$(".app-view, [data-page]").forEach(section => {
        const sectionView =
          section.dataset.page ||
          section.id.replace(/Page$/, "").replace(/^view-/, "");

        const active = sectionView === view;
        section.hidden = !active;
        section.classList.toggle("active", active);
      });

      if (view === "analytics") renderAnalytics();
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

/* ---------- Dashboard metrics ---------- */

function getTodayTasks() {
  return state.tasks.filter(task =>
    sameDay(task.date, new Date()) && !task.inbox
  );
}

function renderDashboardMetrics() {
  const todayTasks = getTodayTasks();
  const completed = todayTasks.filter(isCompleted);
  const plannedMinutes = todayTasks
    .filter(task => !isCompleted(task))
    .reduce((sum, task) => sum + getTaskDuration(task), 0);

  const metrics = {
    todayCount: todayTasks.filter(task => !isCompleted(task)).length,
    plannedToday: plannedMinutes,
    plannedTasks: todayTasks.length,
    completedToday: completed.length,
    completionRate: todayTasks.length
      ? Math.round(completed.length / todayTasks.length * 100)
      : 0,
    focusToday: state.stats.dailyFocus[dateKey(new Date())] || 0,
    inboxCount: state.tasks.filter(task =>
      task.inbox && !isCompleted(task)
    ).length
  };

  Object.entries(metrics).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (!element) return;

    if (id === "plannedToday") {
      element.textContent = `${value} min`;
    } else if (id === "focusToday") {
      element.textContent = `${value} min`;
    } else if (id === "completionRate") {
      element.textContent = `${value}%`;
    } else {
      element.textContent = value;
    }
  });

  const streak = $("#streakCount");
  if (streak) streak.textContent = state.stats.streak || 0;

  const focusMinutes = $("#focusMinutes");
  if (focusMinutes) {
    focusMinutes.textContent =
      state.stats.totalFocusMinutes || 0;
  }

  updateSidebarCounts();
}

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

/* ---------- Focus / Pomodoro timer ---------- */

const TIMER_MODES = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60
};

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainingSeconds = safe % 60;

  return `${pad(minutes)}:${pad(remainingSeconds)}`;
}

function updateTimerDisplay() {
  const time = $("#timerTime");
  const face = $("#timerFace");
  const progress = $("#timerProgress");
  const caption = $("#timerCaption");

  if (time) time.textContent = formatTime(state.timerRemaining);

  if (face) {
    face.setAttribute("aria-label", formatTime(state.timerRemaining));
    face.classList.toggle("is-running", state.timerRunning);
  }

  if (progress) {
    const total = TIMER_MODES[state.timerMode] || TIMER_MODES.focus;
    const fraction = total
      ? (total - state.timerRemaining) / total
      : 0;

    progress.style.setProperty("--progress", `${fraction * 100}%`);
    progress.style.strokeDashoffset = String(1 - fraction);
  }

  if (caption) {
    const captions = {
      focus: "Time to focus",
      short: "Take a short break",
      long: "Recharge with a long break"
    };
    caption.textContent = captions[state.timerMode] || captions.focus;
  }

  const startButton = $("#timerStart");
  if (startButton) {
    startButton.textContent = state.timerRunning ? "Pause" : "Start";
    startButton.setAttribute(
      "aria-label",
      state.timerRunning ? "Pause timer" : "Start timer"
    );
  }

  const sessionCount = $("#sessionCount");
  if (sessionCount) {
    sessionCount.textContent = state.stats.completedSessions || 0;
  }
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  state.timerRunning = false;
  updateTimerDisplay();
}

function selectTimerMode(mode) {
  if (!Object.hasOwn(TIMER_MODES, mode)) return;

  stopTimer();
  state.timerMode = mode;
  state.timerSeconds = TIMER_MODES[mode];
  state.timerRemaining = TIMER_MODES[mode];

  $$("[data-timer-mode]").forEach(button => {
    const active = button.dataset.timerMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  updateTimerDisplay();
}

function startTimer() {
  if (state.timerRunning) {
    stopTimer();
    return;
  }

  if (state.timerRemaining <= 0) {
    state.timerRemaining = state.timerSeconds;
  }

  state.timerRunning = true;
  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    state.timerRemaining -= 1;

    if (state.timerRemaining <= 0) {
      state.timerRemaining = 0;
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

    updateStudyStreak(today);
    saveStats();

    state.sessionCount += 1;
    showToast("Focus session complete! Great work.");

    if (state.selectedFocusTask) {
      const task = state.tasks.find(
        item => item.id === state.selectedFocusTask
      );

      if (task) {
        task.focusMinutes = (task.focusMinutes || 0) + minutes;
        saveTasks();
      }
    }

    renderApp();
  } else {
    showToast("Break complete. Ready for another session?");
  }

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("FocusFlow", {
      body: state.timerMode === "focus"
        ? "Focus session complete. Take a break!"
        : "Break complete. Time to get back to work."
    });
  }

  state.timerRemaining = state.timerSeconds;
  updateTimerDisplay();
}

function updateStudyStreak(today) {
  const last = state.stats.lastStudyDate;

  if (last === today) return;

  const yesterday = dateKey(dateOffset(new Date(), -1));

  if (last === yesterday) {
    state.stats.streak = (state.stats.streak || 0) + 1;
  } else {
    state.stats.streak = 1;
  }

  state.stats.lastStudyDate = today;
}

function openFocusModal() {
  openModal("focusModal");

  const task = state.tasks.find(
    item => item.id === state.selectedFocusTask
  );

  const selected = $("#focusSelectedTask");
  if (selected) {
    selected.textContent = task
      ? `Focusing on: ${task.title}`
      : "Choose a task and start focusing.";
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

  $("#timerMessage")?.addEventListener("click", () => {
    if ("Notification" in window &&
        Notification.permission === "default") {
      Notification.requestPermission();
    }
  });

  updateTimerDisplay();
}

/* ---------- Analytics ---------- */

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = dateOffset(new Date(), index - 6);
    const key = dateKey(date);

    return {
      date,
      key,
      label: formatDate(date, { weekday: "short" }),
      minutes: state.stats.dailyFocus[key] || 0
    };
  });
}

function renderWeeklyChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const days = getLastSevenDays();
  const maximum = Math.max(30, ...days.map(day => day.minutes));

  container.innerHTML = `
    <div class="simple-bar-chart">
      ${days.map(day => {
        const height = Math.max(3, day.minutes / maximum * 100);

        return `
          <div class="chart-bar-wrap" title="${day.minutes} focus minutes">
            <div class="chart-bar"
              style="height:${height}%"
              aria-label="${day.minutes} minutes"></div>
            <span class="chart-label">${escapeHTML(day.label)}</span>
            <span class="chart-value">${day.minutes}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderSubjectAnalytics() {
  const container = $("#analyticsSubjects");
  if (!container) return;

  const totals = {};

  state.tasks.forEach(task => {
    totals[task.subject] = (totals[task.subject] || 0) +
      (Number(task.focusMinutes) || 0);
  });

  const entries = Object.entries(totals)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    container.innerHTML = "<p>No subject activity yet.</p>";
    return;
  }

  const maximum = Math.max(1, ...entries.map(entry => entry[1]));

  container.innerHTML = entries.map(([subject, minutes]) => `
    <div class="subject-analytics-row">
      <div class="subject-analytics-heading">
        <span>${escapeHTML(subject)}</span>
        <strong>${minutes} min</strong>
      </div>
      <div class="subject-progress-track">
        <div class="subject-progress-fill"
          style="width:${minutes / maximum * 100}%"></div>
      </div>
    </div>
  `).join("");
}

function renderAnalytics() {
  renderWeeklyChart("analyticsChart");
  renderSubjectAnalytics();

  const metrics = $("#analyticsMetrics");
  if (metrics) {
    const completed = state.tasks.filter(isCompleted).length;
    const total = state.tasks.length;
    const minutes = state.stats.totalFocusMinutes || 0;
    const sessions = state.stats.completedSessions || 0;

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
        <span>Focus sessions</span>
        <strong>${sessions}</strong>
      </div>
    `;
  }

  const weekTotal = $("#weekTotal");
  if (weekTotal) {
    const total = getLastSevenDays()
      .reduce((sum, day) => sum + day.minutes, 0);

    weekTotal.textContent = `${total} min`;
  }
}

/* ---------- Today's task preview ---------- */

function renderTaskPreviews() {
  const todayTasks = getTodayTasks()
    .sort((a, b) => getTaskDateTime(a) - getTaskDateTime(b));

  const preview = $("#plannedTasks");
  if (preview && preview.tagName === "UL") {
    preview.innerHTML = todayTasks.slice(0, 5).map(task => `
      <li data-task-id="${escapeHTML(task.id)}">
        <span>${escapeHTML(task.title)}</span>
        <span>${escapeHTML(task.time)}</span>
      </li>
    `).join("");
  }

  const subjectOverview = $("#subjectOverview");
  if (subjectOverview) {
    const counts = state.subjects.map(subject => ({
      subject,
      count: state.tasks.filter(task =>
        task.subject === subject &&
        sameDay(task.date, new Date())
      ).length
    }));

    subjectOverview.innerHTML = counts.map(item => `
      <div class="subject-overview-row">
        <span>${escapeHTML(item.subject)}</span>
        <strong>${item.count}</strong>
      </div>
    `).join("");
  }

  renderWeeklyChart("weekChart");
}

/* ---------- Global render ---------- */

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

/* ---------- Initial data cleanup ---------- */

function initializeData() {
  state.tasks = Array.isArray(state.tasks)
    ? state.tasks.map(normalizeTask)
    : [];

  state.subjects = Array.isArray(state.subjects)
    ? state.subjects
        .map(normalizeSubjectName)
        .filter(Boolean)
    : [...DEFAULT_SUBJECTS];

  state.subjects = [...new Set(state.subjects)];

  saveTasks();
  saveSubjects();
}

/* ---------- Start application ---------- */

function initializeApp() {
  initializeData();
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

  const dateElement = $("#topDate");
  if (dateElement) {
    dateElement.textContent = formatDate(new Date(), {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  }

  const year = $("#footerYear");
  if (year) year.textContent = new Date().getFullYear();

  renderApp();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}