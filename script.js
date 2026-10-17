
"use strict";

/* ==========================================
   FOCUSFLOW — TASK MANAGER + POMODORO TIMER
========================================== */

// ---------- HTML ELEMENTS ----------

const taskForm = document.getElementById("taskForm");
const subjectInput = document.getElementById("subject");
const taskInput = document.getElementById("task");
const deadlineInput = document.getElementById("deadline");
const durationInput = document.getElementById("duration");
const priorityInput = document.getElementById("priority");

const formTitle = document.getElementById("formTitle");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEdit");

const taskList = document.getElementById("taskList");
const searchInput = document.getElementById("searchInput");
const filterStatus = document.getElementById("filterStatus");
const sortTasks = document.getElementById("sortTasks");

const totalElement = document.getElementById("total");
const completedElement = document.getElementById("completed");
const pendingElement = document.getElementById("pending");
const percentElement = document.getElementById("percent");
const progressBar = document.getElementById("bar");
const progressTrack = document.getElementById("progressTrack");

const taskCountElement = document.getElementById("taskCount");
const subjectOverview = document.getElementById("subjectOverview");
const currentDateElement = document.getElementById("currentDate");
const toastElement = document.getElementById("toast");

// ---------- TASK STORAGE ----------

const STORAGE_KEY = "focusFlowTasksV1";

let tasks = loadTasks();
let editingTaskId = null;
let toastTimeout = null;

function loadTasks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    return Array.isArray(data)
      ? data.filter(
          task =>
            task &&
            typeof task.id === "string" &&
            typeof task.subject === "string" &&
            typeof task.title === "string"
        )
      : [];
  } catch (error) {
    console.error("Unable to load tasks:", error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.error("Unable to save tasks:", error);
    showToast("Unable to save tasks in this browser.");
    return false;
  }
}

// ---------- GENERAL HELPERS ----------

function createId() {
  return window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHTML(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value).replace(/[&<>"']/g, char => entities[char]);
}

function showToast(message) {
  if (!toastElement) return;

  toastElement.textContent = message;
  toastElement.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toastElement.classList.remove("show");
  }, 2600);
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "No deadline";

  const parts = value.split("-");
  if (parts.length !== 3) return value;

  const date = new Date(+parts[0], +parts[1] - 1, +parts[2]);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (!hours) return `${remaining} min`;
  if (!remaining) return `${hours} hr`;

  return `${hours} hr ${remaining} min`;
}

function isOverdue(task) {
  return (
    !task.completed &&
    task.deadline &&
    task.deadline < getLocalDateString()
  );
}

// ---------- INITIALIZE DATE ----------

if (currentDateElement) {
  currentDateElement.textContent = new Date().toLocaleDateString(
    "en-IN",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );
}

if (deadlineInput && !deadlineInput.value) {
  deadlineInput.value = getLocalDateString();
}

// ---------- ADD AND EDIT TASKS ----------

taskForm.addEventListener("submit", event => {
  event.preventDefault();

  const subject = subjectInput.value.trim();
  const title = taskInput.value.trim();
  const deadline = deadlineInput.value;
  const duration = Number(durationInput.value);
  const priority = priorityInput.value;

  if (!subject || !title || !deadline) {
    showToast("Please fill in all required fields.");
    return;
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    showToast("Select a valid study duration.");
    return;
  }

  if (!["High", "Medium", "Low"].includes(priority)) {
    showToast("Select a valid priority.");
    return;
  }

  if (editingTaskId) {
    const index = tasks.findIndex(t => t.id === editingTaskId);

    if (index === -1) {
      showToast("Task not found.");
      resetForm();
      return;
    }

    const previousTask = tasks[index];

    tasks[index] = {
      ...previousTask,
      subject,
      title,
      deadline,
      duration,
      priority
    };

    if (!saveTasks()) {
      tasks[index] = previousTask;
      return;
    }

    showToast("Task updated successfully!");
  } else {
    const newTask = {
      id: createId(),
      subject,
      title,
      deadline,
      duration,
      priority,
      completed: false,
      createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);

    if (!saveTasks()) {
      tasks.shift();
      return;
    }

    showToast("Study task added successfully!");
  }

  resetForm();
  renderApp();
});

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingTaskId = id;

  subjectInput.value = task.subject;
  taskInput.value = task.title;
  deadlineInput.value = task.deadline;
  durationInput.value = String(task.duration);
  priorityInput.value = task.priority;

  formTitle.textContent = "Edit Study Task";
  submitBtn.textContent = "Save Changes";
  cancelEditBtn.hidden = false;

  document.getElementById("add-task").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  subjectInput.focus();
}

function resetForm() {
  taskForm.reset();
  editingTaskId = null;

  formTitle.textContent = "Add a Study Task";
  submitBtn.textContent = "+ Add Task";
  cancelEditBtn.hidden = true;

  deadlineInput.value = getLocalDateString();
}

cancelEditBtn.addEventListener("click", resetForm);

// ---------- COMPLETE TASK ----------

function toggleTask(id) {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const previous = tasks[index].completed;
  tasks[index].completed = !previous;

  if (!saveTasks()) {
    tasks[index].completed = previous;
    return;
  }

  showToast(
    tasks[index].completed
      ? "Great work! Task completed."
      : "Task marked as pending."
  );

  renderApp();
}

// ---------- DELETE TASK ----------

function deleteTask(id) {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const removed = tasks.splice(index, 1)[0];

  if (!saveTasks()) {
    tasks.splice(index, 0, removed);
    return;
  }

  if (editingTaskId === id) resetForm();

  showToast("Task deleted.");
  renderApp();
}

// ---------- SEARCH, FILTER AND SORT ----------

function getVisibleTasks() {
  const query = searchInput.value.trim().toLowerCase();
  const status = filterStatus.value;
  const sortBy = sortTasks.value;

  const visible = tasks.filter(task => {
    const matchesSearch =
      task.subject.toLowerCase().includes(query) ||
      task.title.toLowerCase().includes(query);

    const matchesStatus =
      status === "all" ||
      (status === "completed" && task.completed) ||
      (status === "pending" && !task.completed);

    return matchesSearch && matchesStatus;
  });

  const priorityOrder = { High: 1, Medium: 2, Low: 3 };

  visible.sort((a, b) => {
    if (sortBy === "priority") {
      return (priorityOrder[a.priority] || 4) -
        (priorityOrder[b.priority] || 4);
    }

    if (sortBy === "subject") {
      return a.subject.localeCompare(b.subject);
    }

    return (a.deadline || "9999-12-31").localeCompare(
      b.deadline || "9999-12-31"
    );
  });

  return visible;
}

searchInput.addEventListener("input", renderTasks);
filterStatus.addEventListener("change", renderTasks);
sortTasks.addEventListener("change", renderTasks);

// ---------- DISPLAY TASKS ----------

function renderTasks() {
  const visibleTasks = getVisibleTasks();

  taskCountElement.textContent =
    `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;

  if (!visibleTasks.length) {
    taskList.innerHTML = `
      <div class="empty-state">
        ${tasks.length
          ? "No tasks match your search or filter."
          : "No study tasks yet. Add your first task above!"}
      </div>
    `;
    return;
  }

  taskList.innerHTML = visibleTasks.map(task => {
    const completed = Boolean(task.completed);
    const overdue = isOverdue(task);

    const status = completed
      ? "Completed"
      : overdue
        ? "Overdue"
        : "Pending";

    return `
      <article class="task ${completed ? "completed" : ""}">
        <div class="section-heading">
          <div>
            <h3>${escapeHTML(task.title)}</h3>
            <p>${escapeHTML(task.subject)}</p>
          </div>

          <span class="priority ${task.priority.toLowerCase()}">
            ${escapeHTML(task.priority)}
          </span>
        </div>

        <div class="task-meta">
          <span>Deadline: ${escapeHTML(formatDate(task.deadline))}</span>
          <span>Duration: ${escapeHTML(task.duration)} min</span>
          <span>${status}</span>
        </div>

        <div class="task-actions">
          <button type="button" class="secondary"
            data-action="toggle" data-id="${escapeHTML(task.id)}">
            ${completed ? "Mark Pending" : "Mark Complete"}
          </button>

          <button type="button" class="secondary"
            data-action="edit" data-id="${escapeHTML(task.id)}">
            Edit
          </button>

          <button type="button" class="danger"
            data-action="delete" data-id="${escapeHTML(task.id)}">
            Delete
          </button>
        </div>
      </article>
    `;
  }).join("");
}

// One listener handles buttons in all task cards.
taskList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "toggle") toggleTask(id);
  if (action === "edit") editTask(id);
  if (action === "delete") deleteTask(id);
});

// ---------- STATISTICS ----------

function renderStats() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;

  const percentage = total
    ? Math.round((completed / total) * 100)
    : 0;

  totalElement.textContent = total;
  completedElement.textContent = completed;
  pendingElement.textContent = pending;
  percentElement.textContent = `${percentage}%`;
  progressBar.style.width = `${percentage}%`;

  progressTrack.setAttribute("aria-valuenow", String(percentage));
}

// ---------- SUBJECT OVERVIEW ----------

function renderSubjects() {
  const subjects = new Map();

  tasks.forEach(task => {
    const name = task.subject.trim();

    if (!subjects.has(name)) {
      subjects.set(name, {
        total: 0,
        completed: 0,
        duration: 0
      });
    }

    const item = subjects.get(name);

    item.total++;
    item.duration += Number(task.duration) || 0;

    if (task.completed) item.completed++;
  });

  if (!subjects.size) {
    subjectOverview.innerHTML = `
      <div class="empty-state">
        Add tasks to see your subject overview.
      </div>
    `;
    return;
  }

  subjectOverview.innerHTML = [...subjects.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, item]) => {
      const percentage = Math.round(
        (item.completed / item.total) * 100
      );

      return `
        <div class="subject-item">
          <div class="section-heading">
            <h3>${escapeHTML(name)}</h3>
            <span>${percentage}%</span>
          </div>

          <p>${item.completed} of ${item.total} tasks completed</p>
          <p>Planned study time: ${formatDuration(item.duration)}</p>

          <div class="progress" role="progressbar"
            aria-valuemin="0" aria-valuemax="100"
            aria-valuenow="${percentage}">
            <div class="progress-bar"
              style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    }).join("");
}

function renderApp() {
  renderStats();
  renderTasks();
  renderSubjects();
}

// ==========================================
// POMODORO FOCUS TIMER
// ==========================================

const focusModeBtn = document.getElementById("focusMode");
const breakModeBtn = document.getElementById("breakMode");
const timerTime = document.getElementById("timerTime");
const timerLabel = document.getElementById("timerLabel");
const timerStartBtn = document.getElementById("timerStart");
const timerResetBtn = document.getElementById("timerReset");
const timerStatus = document.getElementById("timerStatus");
const timerMessage = document.getElementById("timerMessage");
const timerProgress = document.getElementById("timerProgress");
const timerCircle = document.getElementById("timerCircle");
const sessionCountElement = document.getElementById("sessionCount");

const TIMER_MODES = {
  focus: {
    seconds: 25 * 60,
    label: "FOCUS TIME",
    message: "Get comfortable, remove distractions, and begin."
  },
  break: {
    seconds: 5 * 60,
    label: "BREAK TIME",
    message: "Relax your mind, stretch, and recharge."
  }
};

const CIRCUMFERENCE = 2 * Math.PI * 96;

let activeTimerMode = "focus";
let remainingSeconds = TIMER_MODES.focus.seconds;
let timerInterval = null;
let timerRunning = false;
let completedFocusSessions = 0;
let timerEndTime = 0;

function renderTimer() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  timerTime.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  timerLabel.textContent = TIMER_MODES[activeTimerMode].label;

  const total = TIMER_MODES[activeTimerMode].seconds;
  const progress = remainingSeconds / total;

  timerProgress.style.strokeDasharray = CIRCUMFERENCE;
  timerProgress.style.strokeDashoffset =
    CIRCUMFERENCE * (1 - progress);

  focusModeBtn.classList.toggle(
    "active", activeTimerMode === "focus"
  );

  breakModeBtn.classList.toggle(
    "active", activeTimerMode === "break"
  );

  timerCircle.classList.toggle(
    "break-mode", activeTimerMode === "break"
  );

  timerStartBtn.textContent = timerRunning
    ? "Pause Timer"
    : remainingSeconds === 0
      ? "Start Again"
      : `Start ${activeTimerMode === "focus" ? "Focus" : "Break"}`;

  timerStatus.textContent = timerRunning
    ? "Session in progress"
    : remainingSeconds === 0
      ? "Session completed"
      : "Ready to focus";

  sessionCountElement.textContent =
    `${completedFocusSessions} completed`;

  document.title = timerRunning
    ? `${timerTime.textContent} — FocusFlow`
    : "FocusFlow | Smart Study Planner";
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerRunning = false;
}

function updateTimer() {
  if (!timerRunning) return;

  remainingSeconds = Math.max(
    0,
    Math.ceil((timerEndTime - Date.now()) / 1000)
  );

  if (remainingSeconds === 0) {
    stopTimer();

    if (activeTimerMode === "focus") {
      completedFocusSessions++;
      timerMessage.textContent =
        "Focus session complete! Take a short break.";
    } else {
      timerMessage.textContent =
        "Break finished! You're ready for another focus session.";
    }

    renderTimer();

    showToast(
      activeTimerMode === "focus"
        ? "Focus session complete! Time for a break."
        : "Break finished! Ready to focus again?"
    );

    return;
  }

  renderTimer();
}

function startTimer() {
  if (timerRunning) {
    stopTimer();
    timerMessage.textContent = "Timer paused. Resume when ready.";
    renderTimer();
    return;
  }

  if (remainingSeconds <= 0) {
    remainingSeconds = TIMER_MODES[activeTimerMode].seconds;
  }

  timerRunning = true;
  timerEndTime = Date.now() + remainingSeconds * 1000;

  timerMessage.textContent = TIMER_MODES[activeTimerMode].message;

  timerInterval = setInterval(updateTimer, 250);
  renderTimer();
}

function selectTimerMode(mode) {
  if (!TIMER_MODES[mode]) return;

  stopTimer();
  activeTimerMode = mode;
  remainingSeconds = TIMER_MODES[mode].seconds;
  timerMessage.textContent = TIMER_MODES[mode].message;

  renderTimer();
}

function resetTimer() {
  stopTimer();
  remainingSeconds = TIMER_MODES[activeTimerMode].seconds;

  timerMessage.textContent =
    "Timer reset. Start whenever you're ready.";

  renderTimer();
}

focusModeBtn.addEventListener("click", () => {
  selectTimerMode("focus");
});

breakModeBtn.addEventListener("click", () => {
  selectTimerMode("break");
});

timerStartBtn.addEventListener("click", startTimer);
timerResetBtn.addEventListener("click", resetTimer);

// ---------- START APPLICATION ----------

renderApp();
renderTimer();
