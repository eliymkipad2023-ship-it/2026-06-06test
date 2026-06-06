/**
 * タスク管理アプリ
 * 勉強や仕事の進捗を管理するシンプルなアプリ。
 * データはブラウザの localStorage に保存される（サーバー不要）。
 */
(function () {
  "use strict";

  const STORAGE_KEY = "task-manager.tasks.v1";

  // カテゴリ・優先度の表示ラベル
  const CATEGORY_LABELS = {
    study: "📚 勉強",
    work: "💼 仕事",
    other: "🌱 その他",
  };
  const PRIORITY_LABELS = {
    high: "🔴 高",
    medium: "🟡 中",
    low: "🔵 低",
  };

  // アプリの状態
  let tasks = loadTasks();
  let statusFilter = "all"; // all | active | done
  let categoryFilter = "all"; // all | study | work | other

  // DOM 要素
  const form = document.getElementById("taskForm");
  const titleInput = document.getElementById("titleInput");
  const categoryInput = document.getElementById("categoryInput");
  const priorityInput = document.getElementById("priorityInput");
  const dueInput = document.getElementById("dueInput");
  const taskList = document.getElementById("taskList");
  const emptyState = document.getElementById("emptyState");
  const clearDoneBtn = document.getElementById("clearDoneBtn");

  // --- 永続化 ---------------------------------------------------------------

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("タスクの読み込みに失敗しました", e);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error("タスクの保存に失敗しました", e);
    }
  }

  // --- タスク操作 -----------------------------------------------------------

  function addTask(title, category, priority, due) {
    tasks.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title,
      category: category,
      priority: priority,
      due: due || null,
      done: false,
      createdAt: Date.now(),
    });
    saveTasks();
    render();
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.done = !task.done;
      saveTasks();
      render();
    }
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
  }

  function clearDone() {
    const doneCount = tasks.filter((t) => t.done).length;
    if (doneCount === 0) return;
    if (!confirm(`完了した ${doneCount} 件のタスクを削除しますか？`)) return;
    tasks = tasks.filter((t) => !t.done);
    saveTasks();
    render();
  }

  // --- 期限の判定 -----------------------------------------------------------

  function getDueStatus(due) {
    if (!due) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(due + "T00:00:00");
    const diffDays = Math.round((dueDate - today) / 86400000);
    if (diffDays < 0) return "overdue";
    if (diffDays <= 2) return "due-soon";
    return "normal";
  }

  function formatDue(due) {
    const status = getDueStatus(due);
    const dateStr = due.replace(/-/g, "/");
    if (status === "overdue") return "⚠️ 期限切れ " + dateStr;
    if (status === "due-soon") return "⏰ " + dateStr;
    return "📅 " + dateStr;
  }

  // --- 描画 -----------------------------------------------------------------

  function getFilteredTasks() {
    return tasks.filter((t) => {
      const statusOk =
        statusFilter === "all" ||
        (statusFilter === "active" && !t.done) ||
        (statusFilter === "done" && t.done);
      const categoryOk =
        categoryFilter === "all" || t.category === categoryFilter;
      return statusOk && categoryOk;
    });
  }

  function updateSummary() {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const active = total - done;
    const rate = total === 0 ? 0 : Math.round((done / total) * 100);

    document.getElementById("statTotal").textContent = total;
    document.getElementById("statActive").textContent = active;
    document.getElementById("statDone").textContent = done;
    document.getElementById("statRate").textContent = rate + "%";
    document.getElementById("progressFill").style.width = rate + "%";
  }

  function createTaskElement(task) {
    const li = document.createElement("li");
    li.className = "task-item priority-" + task.priority + (task.done ? " done" : "");

    // チェックボックス
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", "完了切り替え");
    checkbox.addEventListener("change", () => toggleTask(task.id));

    // 本文
    const body = document.createElement("div");
    body.className = "task-body";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const catTag = document.createElement("span");
    catTag.className = "tag";
    catTag.textContent = CATEGORY_LABELS[task.category] || task.category;
    meta.appendChild(catTag);

    const priTag = document.createElement("span");
    priTag.className = "tag";
    priTag.textContent = PRIORITY_LABELS[task.priority] || task.priority;
    meta.appendChild(priTag);

    if (task.due) {
      const dueTag = document.createElement("span");
      const dueStatus = getDueStatus(task.due);
      dueTag.className = "tag" + (dueStatus === "overdue" || dueStatus === "due-soon" ? " " + dueStatus : "");
      dueTag.textContent = formatDue(task.due);
      meta.appendChild(dueTag);
    }

    body.appendChild(title);
    body.appendChild(meta);

    // 削除ボタン
    const delBtn = document.createElement("button");
    delBtn.className = "task-delete";
    delBtn.textContent = "🗑️";
    delBtn.setAttribute("aria-label", "削除");
    delBtn.addEventListener("click", () => deleteTask(task.id));

    li.appendChild(checkbox);
    li.appendChild(body);
    li.appendChild(delBtn);
    return li;
  }

  function render() {
    updateSummary();

    const filtered = getFilteredTasks();
    taskList.innerHTML = "";

    if (filtered.length === 0) {
      emptyState.style.display = "block";
      emptyState.textContent =
        tasks.length === 0
          ? "タスクはまだありません。上のフォームから追加しましょう！"
          : "条件に一致するタスクがありません。";
    } else {
      emptyState.style.display = "none";
      // 未完了を上に、その中で優先度順に並べる
      const order = { high: 0, medium: 1, low: 2 };
      const sorted = filtered.slice().sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return order[a.priority] - order[b.priority];
      });
      sorted.forEach((task) => taskList.appendChild(createTaskElement(task)));
    }
  }

  // --- イベント -------------------------------------------------------------

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    addTask(title, categoryInput.value, priorityInput.value, dueInput.value);
    form.reset();
    priorityInput.value = "medium";
    titleInput.focus();
  });

  clearDoneBtn.addEventListener("click", clearDone);

  // フィルターボタン（状態 / カテゴリ）
  document.getElementById("statusFilters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    statusFilter = btn.dataset.status;
    setActive("statusFilters", btn);
    render();
  });

  document.getElementById("categoryFilters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    categoryFilter = btn.dataset.category;
    setActive("categoryFilters", btn);
    render();
  });

  function setActive(groupId, activeBtn) {
    const buttons = document.getElementById(groupId).querySelectorAll(".filter-btn");
    buttons.forEach((b) => b.classList.toggle("active", b === activeBtn));
  }

  // 初期描画
  render();
})();
