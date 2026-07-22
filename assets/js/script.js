(() => {
  "use strict";

  const SPLASH_DURATION_MS = 3200;
  let studentsData = null;
  let currentStudent = null;
  let currentFamily = null;

  const screens = {
    splash: document.getElementById("splash-screen"),
    login: document.getElementById("login-screen"),
    picker: document.getElementById("picker-screen"),
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
      const savedPhone = sessionStorage.getItem("alhilla_phone");
      if (savedPhone) {
        const savedIndex = sessionStorage.getItem("alhilla_student_index");
        attemptLogin(savedPhone, { silent: true, autoIndex: savedIndex });
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
    const input = document.getElementById("phone-number");
    const errorBox = document.getElementById("login-error");

    input.addEventListener("input", () => {
      input.value = normalizeDigits(input.value);
      errorBox.textContent = "";
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const phone = normalizeDigits(input.value.trim());
      if (!phone) {
        errorBox.textContent = "الرجاء إدخال رقم الهاتف";
        return;
      }
      attemptLogin(phone, { errorBox });
    });
  }

  async function attemptLogin(phone, opts = {}) {
    const btn = document.getElementById("login-btn");
    const errorBox = opts.errorBox || document.getElementById("login-error");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "جارِ التحقق...";
    }
    try {
      const data = await loadStudents();
      await new Promise((r) => setTimeout(r, opts.silent ? 0 : 450));
      const family = data[phone];
      if (!family || !family.length) {
        if (!opts.silent) {
          errorBox.textContent = "رقم الهاتف غير صحيح أو غير مسجل في هذه الدورة";
        } else {
          sessionStorage.removeItem("alhilla_phone");
          sessionStorage.removeItem("alhilla_student_index");
          showScreen("login");
        }
        return;
      }
      sessionStorage.setItem("alhilla_phone", phone);
      currentFamily = family;

      if (family.length === 1) {
        selectStudent(0);
        return;
      }

      const idx = opts.autoIndex !== undefined && opts.autoIndex !== null ? parseInt(opts.autoIndex, 10) : NaN;
      if (!Number.isNaN(idx) && family[idx]) {
        selectStudent(idx);
        return;
      }

      renderPicker(family);
      showScreen("picker");
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

  function renderPicker(family) {
    const list = document.getElementById("picker-list");
    list.innerHTML = family
      .map(
        (s, i) => `<div class="picker-item" data-index="${i}">
          <div>
            <div class="picker-name">${s.name}</div>
            <div class="picker-meta">${s.teacher}</div>
          </div>
          <span class="arrow">⟵</span>
        </div>`
      )
      .join("");
    list.querySelectorAll(".picker-item").forEach((el) => {
      el.addEventListener("click", () => selectStudent(parseInt(el.dataset.index, 10)));
    });
  }

  function selectStudent(index) {
    if (!currentFamily || !currentFamily[index]) return;
    sessionStorage.setItem("alhilla_student_index", String(index));
    currentStudent = currentFamily[index];
    renderDashboard(currentStudent);
    const switchBtn = document.getElementById("switch-student-btn");
    switchBtn.style.display = currentFamily.length > 1 ? "" : "none";
    showScreen("dashboard");
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

    const g = student.grade || {};
    const isComplete = ["attendance", "achievement", "exam"].every(
      (k) => g[k] && g[k].score !== null && g[k].score !== undefined
    );
    const statusChip = document.getElementById("student-status");
    if (isComplete) {
      statusChip.style.display = "";
      statusChip.textContent = "✅ اكتملت الدورة والدرجة النهائية";
    } else {
      statusChip.style.display = "none";
    }

    renderStats(student);
    renderLog(student);
    renderGrade(student);
    renderPhoto(student);
  }

  const SPECIAL_DAYS = {
    "2026-07-22": { rowClass: "is-exam", badgeClass: "exam", label: "📝 يوم الاختبار النهائي" },
    "2026-07-23": { rowClass: "is-ceremony", badgeClass: "ceremony", label: "🎉 الحفل الختامي" },
  };

  function renderStats(student) {
    const today = todayIso();
    const total = student.log.length;
    const reviewed = student.log.filter((e) => e.murajaa).length;
    const attended = student.log.filter((e) => e.attended === true).length;
    const holidays = student.log.filter((e) => e.holiday).length;
    const remaining = student.log.filter((e) => e.date > today && !e.holiday).length;

    const stats = [
      { num: attended, lbl: "أيام الحضور المسجلة" },
      { num: reviewed, lbl: "أيام تمت فيها المراجعة" },
      { num: total - holidays, lbl: "أيام الدورة الفعلية" },
      { num: remaining, lbl: "أيام متبقية" },
      { num: student.juzMemorized !== null && student.juzMemorized !== undefined ? student.juzMemorized : "—", lbl: "عدد الأجزاء المحفوظة" },
    ];

    const grid = document.getElementById("stats-grid");
    grid.innerHTML = stats
      .map((s) => `<div class="stat-card"><div class="num">${s.num}</div><div class="lbl">${s.lbl}</div></div>`)
      .join("");
  }

  function attendanceCell(entry, today) {
    if (entry.date > today) return '<span class="badge upcoming">قادم</span>';
    if (entry.attended === true) return '<span class="badge present">✓ حاضر</span>';
    if (entry.attended === false) return '<span class="badge absent">✗ غائب</span>';
    return '<span class="badge upcoming">لم يُسجَّل بعد</span>';
  }

  function renderLog(student) {
    const today = todayIso();
    const rows = student.log
      .filter((entry) => !entry.holiday)
      .map((entry) => {
        let rowClass = "";
        let hifzCell;
        let murajaaCell;
        const special = SPECIAL_DAYS[entry.date];

        if (special) {
          rowClass = special.rowClass;
          hifzCell = murajaaCell = `<span class="badge ${special.badgeClass}">${special.label}</span>`;
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
          <td data-label="اليوم">${entry.day}</td>
          <td data-label="التاريخ">${formatArabicDate(entry.date)}</td>
          <td data-label="الحضور">${attendanceCell(entry, today)}</td>
          <td data-label="الحفظ">${hifzCell}</td>
          <td data-label="المراجعة">${murajaaCell}</td>
        </tr>`;
      })
      .join("");
    document.getElementById("log-body").innerHTML = rows;
  }

  function renderGrade(student) {
    const g = student.grade || {};
    const parts = [
      { key: "attendance", icon: "📅", label: "درجة الحضور" },
      { key: "achievement", icon: "📈", label: "درجة الإنجاز (الحفظ والمراجعة)" },
      { key: "exam", icon: "📝", label: "درجة الاختبار النهائي" },
    ];

    let total = 0;
    let totalMax = 0;
    let allGraded = true;

    const rowsHtml = parts
      .map((p) => {
        const item = g[p.key] || { score: null, max: 0 };
        totalMax += item.max || 0;
        const scopeNote = item.scope ? `<div class="grade-scope">${item.scope}</div>` : "";
        const noteNote = item.note ? `<div class="grade-scope">ℹ️ ${item.note}</div>` : "";

        if (item.score === null || item.score === undefined) {
          allGraded = false;
          return `<div class="grade-row-wrap">
            <div class="grade-row">
              <span class="grade-label">${p.icon} ${p.label} <small>(من ${item.max})</small></span>
              <span class="grade-value pending">قيد الانتظار</span>
            </div>
            ${scopeNote}${noteNote}
          </div>`;
        }
        const scoreRounded = Math.round(item.score * 100) / 100;
        total = Math.round((total + scoreRounded) * 100) / 100;
        return `<div class="grade-row-wrap">
          <div class="grade-row">
            <span class="grade-label">${p.icon} ${p.label} <small>(من ${item.max})</small></span>
            <span class="grade-value">${scoreRounded}</span>
          </div>
          ${scopeNote}${noteNote}
        </div>`;
      })
      .join("");

    const totalHtml = `<div class="grade-row grade-total">
      <span class="grade-label">🏆 الدرجة النهائية <small>(من ${totalMax})</small></span>
      <span class="grade-value ${allGraded ? "" : "pending"}">${allGraded ? total : "—"}</span>
    </div>`;

    const noteHtml = allGraded
      ? ""
      : `<p class="grade-note">سيتم إرفاق الدرجات أعلاه فور اعتمادها من إدارة الحلقات بعد انتهاء الدورة واختبار نهاية الفصل.</p>`;

    document.getElementById("grade-box").innerHTML = rowsHtml + totalHtml + noteHtml;
  }

  function renderPhoto(student) {
    const wrap = document.getElementById("photo-card-wrap");
    if (student.groupPhoto) {
      wrap.innerHTML = `
        <div class="video-card has-photo" id="open-photo" style="background-image:url('${student.groupPhoto}')">
          <div class="play-btn">🔍</div>
          <span class="video-caption">اضغط لعرض الصورة الجماعية</span>
        </div>`;
    } else {
      wrap.innerHTML = `
        <div class="video-card disabled" id="open-photo">
          <div class="play-btn">📷</div>
          <span class="video-caption">سيتم إضافة الصورة الجماعية قريبًا</span>
        </div>`;
    }
    document.getElementById("open-photo").addEventListener("click", () => openPhotoModal(student.groupPhoto));
  }

  function openPhotoModal(photoUrl) {
    const overlay = document.getElementById("media-modal");
    const box = document.getElementById("modal-box");
    if (photoUrl) {
      box.innerHTML = `
        <button class="modal-close" id="close-modal">✕</button>
        <img src="${photoUrl}" alt="الصورة الجماعية للحلقة" />`;
    } else {
      box.innerHTML = `
        <button class="modal-close" id="close-modal">✕</button>
        <div class="modal-placeholder">
          <div class="icon-circle">📷</div>
          <strong>لا توجد صورة جماعية متاحة حاليًا</strong>
          <p style="color:var(--ink-soft); font-size:13.5px; margin-top:8px;">
            سيقوم فريق حلقات الحُلّة برفع الصورة الجماعية للحلقة هنا فور توفرها.
          </p>
        </div>`;
    }
    overlay.classList.add("active");
    document.getElementById("close-modal").addEventListener("click", closeMediaModal);
  }

  function closeMediaModal() {
    const overlay = document.getElementById("media-modal");
    overlay.classList.remove("active");
    document.getElementById("modal-box").innerHTML = "";
  }

  document.getElementById("media-modal").addEventListener("click", (e) => {
    if (e.target.id === "media-modal") closeMediaModal();
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("alhilla_phone");
    sessionStorage.removeItem("alhilla_student_index");
    currentStudent = null;
    currentFamily = null;
    document.getElementById("phone-number").value = "";
    document.getElementById("login-error").textContent = "";
    showScreen("login");
  });

  document.getElementById("switch-student-btn").addEventListener("click", () => {
    if (!currentFamily) return;
    renderPicker(currentFamily);
    showScreen("picker");
  });

  document.getElementById("picker-back-btn").addEventListener("click", () => {
    if (currentStudent) {
      showScreen("dashboard");
      return;
    }
    sessionStorage.removeItem("alhilla_phone");
    sessionStorage.removeItem("alhilla_student_index");
    currentFamily = null;
    document.getElementById("phone-number").value = "";
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
