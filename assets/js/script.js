(() => {
  "use strict";

  const SPLASH_DURATION_MS = 3200;
  let studentsData = null;
  let currentStudent = null;

  const screens = {
    splash: document.getElementById("splash-screen"),
    login: document.getElementById("login-screen"),
    dashboard: document.getElementById("dashboard-screen"),
  };

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove("active", "fade-transition"));
    screens[name].classList.add("active", "fade-transition");
  }

  function normalizeDigits(str) {
    const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
    const persian = "۰۱۲۳۴۵۶۷۸۹";
    return String(str)
      .split("")
      .map((ch) => {
        let i = arabicIndic.indexOf(ch);
        if (i > -1) return String(i);
        i = persian.indexOf(ch);
        if (i > -1) return String(i);
        return ch;
      })
      .join("")
      .replace(/[^0-9]/g, "");
  }

  async function loadStudents() {
    if (studentsData) return studentsData;
    const res = await fetch("assets/data/students.json");
    studentsData = await res.json();
    return studentsData;
  }

  // ---------------- Splash ----------------
  function initSplash() {
    let advanced = false;
    const goLogin = () => {
      if (advanced) return;
      advanced = true;
      const savedId = sessionStorage.getItem("alhilla_civil_id");
      if (savedId) {
        attemptLogin(savedId, { silent: true });
      } else {
        showScreen("login");
      }
    };
    const timer = setTimeout(goLogin, SPLASH_DURATION_MS);
    document.getElementById("skip-splash").addEventListener("click", (e) => {
      e.stopPropagation();
      clearTimeout(timer);
      goLogin();
    });
    screens.splash.addEventListener("click", () => {
      clearTimeout(timer);
      goLogin();
    });
  }

  // ---------------- Login ----------------
  function initLogin() {
    const form = document.getElementById("login-form");
    const input = document.getElementById("civil-id");
    const errorBox = document.getElementById("login-error");

    input.addEventListener("input", () => {
      input.value = normalizeDigits(input.value);
      errorBox.textContent = "";
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = normalizeDigits(input.value.trim());
      if (!id) {
        errorBox.textContent = "الرجاء إدخال الرقم المدني";
        return;
      }
      attemptLogin(id, { errorBox });
    });
  }

  async function attemptLogin(civilId, opts = {}) {
    const btn = document.getElementById("login-btn");
    const errorBox = opts.errorBox || document.getElementById("login-error");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "جارِ التحقق...";
    }
    try {
      const data = await loadStudents();
      await new Promise((r) => setTimeout(r, opts.silent ? 0 : 450));
      const student = data[civilId];
      if (!student) {
        if (!opts.silent) {
          errorBox.textContent = "الرقم المدني غير صحيح أو غير مسجل في هذه الدورة";
        } else {
          sessionStorage.removeItem("alhilla_civil_id");
          showScreen("login");
        }
        return;
      }
      sessionStorage.setItem("alhilla_civil_id", civilId);
      currentStudent = student;
      renderDashboard(student);
      showScreen("dashboard");
    } catch (err) {
      console.error(err);
      if (!opts.silent) {
        errorBox.textContent = "تعذّر تحميل بيانات الطلاب، الرجاء المحاولة لاحقًا";
      } else {
        showScreen("login");
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "دخول";
      }
    }
  }

  // ---------------- Dashboard ----------------
  function formatArabicDate(isoStr) {
    const d = new Date(isoStr + "T00:00:00");
    return d.toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" });
  }

  function todayIso() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function renderDashboard(student) {
    document.getElementById("student-name").textContent = student.name;
    document.getElementById("student-program").textContent = student.program;
    document.getElementById("student-teacher").textContent = "👤 " + student.teacher;
    document.getElementById("student-level").textContent = "📖 " + student.level;
    document.getElementById("student-period").textContent =
      "🗓️ " + formatArabicDate(student.startDate) + " — " + formatArabicDate(student.endDate);

    renderStats(student);
    renderLog(student);
    renderGrade(student);
    renderVideo(student);
  }

  function renderStats(student) {
    const today = todayIso();
    const total = student.log.length;
    const reviewed = student.log.filter((e) => e.murajaa).length;
    const holidays = student.log.filter((e) => e.holiday).length;
    const remaining = student.log.filter((e) => e.date > today && !e.holiday).length;

    const stats = [
      { num: reviewed, lbl: "أيام تمت فيها المراجعة" },
      { num: total - holidays, lbl: "أيام الدورة الفعلية" },
      { num: remaining, lbl: "أيام متبقية" },
      { num: student.level.includes("30") ? "30" : "—", lbl: "عدد الأجزاء المحفوظة" },
    ];

    const grid = document.getElementById("stats-grid");
    grid.innerHTML = stats
      .map((s) => `<div class="stat-card"><div class="num">${s.num}</div><div class="lbl">${s.lbl}</div></div>`)
      .join("");
  }

  function renderLog(student) {
    const today = todayIso();
    const rows = student.log
      .map((entry) => {
        let rowClass = "";
        let hifzCell;
        let murajaaCell;

        if (entry.holiday) {
          rowClass = "is-holiday";
          hifzCell = murajaaCell = '<span class="badge holiday">إجازة</span>';
        } else if (entry.date > today) {
          rowClass = "is-upcoming";
          hifzCell = murajaaCell = '<span class="badge upcoming">قادم</span>';
        } else if (!entry.hifz && !entry.murajaa) {
          hifzCell = murajaaCell = '<span class="badge upcoming">لم تُسجَّل بيانات بعد</span>';
        } else {
          hifzCell = entry.hifz || "—";
          murajaaCell = entry.murajaa || "—";
        }

        if (entry.date === today) rowClass += " is-today";

        return `<tr class="${rowClass.trim()}">
          <td>${entry.day}</td>
          <td>${formatArabicDate(entry.date)}</td>
          <td>${hifzCell}</td>
          <td>${murajaaCell}</td>
        </tr>`;
      })
      .join("");
    document.getElementById("log-body").innerHTML = rows;
  }

  function renderGrade(student) {
    const box = document.getElementById("grade-box");
    if (student.finalGrade === null || student.finalGrade === undefined) {
      box.innerHTML = `
        <div class="icon-circle">⏳</div>
        <div class="txt">
          <strong>لم يتم رصد الدرجة بعد</strong>
          <span>سيتم إرفاق الدرجة النهائية للاختبار بعد انتهاء الدورة الصيفية مباشرة. تابع هذه الصفحة للاطلاع عليها فور اعتمادها.</span>
        </div>`;
    } else {
      box.innerHTML = `
        <div class="icon-circle">✅</div>
        <div class="txt">
          <strong>الدرجة النهائية: ${student.finalGrade}</strong>
          <span>تم اعتماد الدرجة من قبل إدارة الحلقات.</span>
        </div>`;
    }
  }

  function renderVideo(student) {
    const wrap = document.getElementById("video-card-wrap");
    if (student.video) {
      wrap.innerHTML = `
        <div class="video-card" id="open-video">
          <div class="play-btn">▶</div>
          <span class="video-caption">اضغط لعرض الفيديو</span>
        </div>`;
      document.getElementById("open-video").addEventListener("click", () => openVideoModal(student.video));
    } else {
      wrap.innerHTML = `
        <div class="video-card disabled" id="open-video">
          <div class="play-btn">▶</div>
          <span class="video-caption">سيتم إضافة الفيديو قريبًا</span>
        </div>`;
      document.getElementById("open-video").addEventListener("click", () => openVideoModal(null));
    }
  }

  function openVideoModal(videoUrl) {
    const overlay = document.getElementById("video-modal");
    const box = document.getElementById("modal-box");
    if (videoUrl) {
      box.innerHTML = `
        <button class="modal-close" id="close-modal">✕</button>
        <video src="${videoUrl}" controls autoplay></video>`;
    } else {
      box.innerHTML = `
        <button class="modal-close" id="close-modal">✕</button>
        <div class="modal-placeholder">
          <div class="icon-circle">🎬</div>
          <strong>لا يوجد فيديو متاح حاليًا</strong>
          <p style="color:var(--ink-soft); font-size:13.5px; margin-top:8px;">
            سيقوم فريق حلقات الحُلّة برفع فيديو تلاوة/إنجاز الطالب هنا فور توفره.
          </p>
        </div>`;
    }
    overlay.classList.add("active");
    document.getElementById("close-modal").addEventListener("click", closeVideoModal);
  }

  function closeVideoModal() {
    const overlay = document.getElementById("video-modal");
    overlay.classList.remove("active");
    document.getElementById("modal-box").innerHTML = "";
  }

  document.getElementById("video-modal").addEventListener("click", (e) => {
    if (e.target.id === "video-modal") closeVideoModal();
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("alhilla_civil_id");
    currentStudent = null;
    document.getElementById("civil-id").value = "";
    document.getElementById("login-error").textContent = "";
    showScreen("login");
  });

  // ---------------- Init ----------------
  document.addEventListener("DOMContentLoaded", () => {
    initSplash();
    initLogin();
    loadStudents().catch((err) => console.error("تعذر تحميل بيانات الطلاب مسبقًا", err));
  });
})();
