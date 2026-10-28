(function () {
  var PR = { 1: { n: "Urgent" }, 2: { n: "Important" }, 3: { n: "Medium" }, 4: { n: "Someday" } };
  var tasks = [];
  var focusId = null;
  var store = null, goalStore = null, goals = [], habitStore = null, habits = [];
  var $ = function (id) { return document.getElementById(id); };
  var CHECK = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l4 4 8-9"/></svg>';

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function stageName(n) { return String(n).replace(/^\s*(?:etap|stage|phase)\s*\d+\s*[:.\-–]\s*/i, ""); }
  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- storage: Supabase (per-user, synced) or this browser ---------- */
  function localStore(KEY) {
    var subs = [];
    function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
    function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} subs.forEach(function (f) { f(a); }); }
    return {
      local: true,
      subscribe: function (f) { subs.push(f); f(load()); },
      put: function (t) { var a = load().filter(function (x) { return x.id !== t.id; }); a.push(t); save(a); return Promise.resolve(); },
      remove: function (id) { save(load().filter(function (x) { return x.id !== id; })); return Promise.resolve(); }
    };
  }
  function write(p) { return p.catch(function (e) { toast("Could not save" + (e && e.code === "invalid_argument" ? " (no write permission)" : "")); }); }

  /* ---------- streak ---------- */
  function streak() {
    var days = {};
    tasks.forEach(function (t) { if (t.done && t.doneAt) days[dayKey(t.doneAt)] = 1; });
    var d = new Date(), n = 0;
    if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ---------- render ---------- */
  function taskEl(t) {
    var li = document.createElement("li");
    li.className = "task" + (t.done ? " done" : "") + (t.id === focusId && !t.done ? " focus" : "");
    li.dataset.p = t.priority;
    var steps = (t.steps || []).map(function (s, i) {
      return '<li class="step' + (s.done ? " sdone" : "") + '"><button type="button" role="checkbox" aria-checked="' + !!s.done +
        '" aria-label="Step: ' + esc(s.t) + '" data-step="' + i + '">' + (s.done ? "✓" : "") + '</button><span>' + esc(s.t) + "</span></li>";
    }).join("");
    li.innerHTML =
      '<div class="line"><button type="button" class="chk" role="checkbox" aria-checked="' + !!t.done + '" aria-label="Check off: ' + esc(t.text) + '" data-act="toggle">' + CHECK + "</button>" +
      '<span class="txt">' + esc(t.text) + '</span><span class="tag">' + PR[t.priority].n + "</span></div>" +
      (steps ? '<ul class="steps">' + steps + "</ul>" : "") +
      '<div class="tools">' +
      (!t.done ? '<button type="button" class="ai" data-act="split">✨ Break into steps</button>' : "") +
      '<button type="button" data-act="del">Delete</button></div>';
    li.dataset.id = t.id;
    return li;
  }

  function render() {
    var open = tasks.filter(function (t) { return !t.done; }).sort(function (a, b) { return a.priority - b.priority || a.created - b.created; });
    var today = dayKey(Date.now());
    var doneAll = tasks.filter(function (t) { return t.done; }).sort(function (a, b) { return b.doneAt - a.doneAt; });
    var doneToday = doneAll.filter(function (t) { return t.doneAt && dayKey(t.doneAt) === today; }).length;
    var total = open.length + doneToday;

    var ol = $("openList"); ol.innerHTML = "";
    open.forEach(function (t) { ol.appendChild(taskEl(t)); });
    var dl = $("doneList"); dl.innerHTML = "";
    doneAll.slice(0, 30).forEach(function (t) { dl.appendChild(taskEl(t)); });

    $("openH").hidden = !open.length;
    $("empty").hidden = !!open.length;
    $("empty").innerHTML = doneToday && !open.length
      ? "<b>Everything done 🎉</b>Take a break. You earned it."
      : "<b>Calm and empty ✨</b>Add your first task above. Even a tiny one counts.";
    $("doneWrap").hidden = !doneAll.length;
    $("doneSum").textContent = "Done (" + doneAll.length + ")";
    $("pickBtn").hidden = open.length < 2 || !!(focusId && open.some(function (t) { return t.id === focusId; }));

    var pct = total ? Math.round(doneToday / total * 100) : 0;
    $("barFill").style.width = pct + "%";
    $("bar").setAttribute("aria-valuenow", pct);
    $("progText").textContent = total ? "Today: " + doneToday + " of " + total + " done (" + pct + "%)" : "Add your first task";

    mood(total, doneToday);

    var s = streak();
    $("streak").hidden = s < 1;
    $("streakN").textContent = s;
    $("streakL").textContent = s === 1 ? "day in a row" : "days in a row";

    var f = open.filter(function (t) { return t.id === focusId; })[0];
    var sw = $("spotWrap");
    if (f) {
      sw.innerHTML = '<div class="spot"><small>Do just this one now</small><p>' + esc(f.text) + '</p><div class="acts"><button type="button" data-spot="done">Done! ✓</button><button type="button" class="ghost" data-spot="again">Pick another</button><button type="button" class="ghost" data-spot="close">Close</button></div></div>';
    } else { sw.innerHTML = ""; focusId = null; }
  }

  /* ---------- mascot ---------- */
  var CHEERS = {
    start: ["YOU CAN DO IT!", "One tiny step is enough!", "Start small. I believe in you!", "YOU'VE GOT THIS!"],
    going: ["Look at you go!", "Keep going, you're on fire!", "YOU CAN DO IT!", "Nice! Next one?"],
    done: ["SO PROUD OF YOU!", "All done! Dance time!", "You did it! YOU CAN DO IT, and you DID!"]
  };
  var cheerKey = "", cheerIdx = 0;
  function mood(total, doneToday) {
    var key = total && doneToday >= total ? "done" : doneToday ? "going" : "start";
    if (key === cheerKey) return;
    cheerKey = key; cheerIdx = 0;
    $("bubble").textContent = CHEERS[key][0];
  }
  $("bear").addEventListener("click", function () {
    var list = CHEERS[cheerKey || "start"];
    cheerIdx = (cheerIdx + 1) % list.length;
    $("bubble").textContent = list[cheerIdx];
    burst($("bear"), true);
  });

  /* ---------- actions ---------- */
  function byId(id) { return tasks.filter(function (t) { return t.id === id; })[0]; }
  function newId() { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  $("addForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("newText").value.trim();
    if (!v) { $("newText").focus(); return; }
    var p = +document.querySelector("input[name=prio]:checked").value;
    write(store.put({ id: newId(), text: v, priority: p, done: false, created: Date.now(), steps: [] }));
    $("newText").value = ""; $("newText").focus();
  });

  function toggle(t, origin) {
    var done = !t.done;
    var up = Object.assign({}, t, { done: done, doneAt: done ? Date.now() : null });
    if (done) { burst(origin); if (t.id === focusId) focusId = null; }
    write(store.put(up));
  }

  function pick(avoid) {
    var open = tasks.filter(function (t) { return !t.done; });
    if (!open.length) return;
    var top = Math.min.apply(null, open.map(function (t) { return t.priority; }));
    var pool = open.filter(function (t) { return t.priority === top && t.id !== avoid; });
    if (!pool.length) pool = open.filter(function (t) { return t.id !== avoid; });
    if (!pool.length) pool = open;
    focusId = pool[Math.floor(Math.random() * pool.length)].id;
    render();
    $("spotWrap").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  $("pickBtn").addEventListener("click", function () { pick(); });

  $("spotWrap").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var t = byId(focusId);
    if (b.dataset.spot === "done" && t) toggle(t, b);
    if (b.dataset.spot === "again") pick(focusId);
    if (b.dataset.spot === "close") { focusId = null; render(); }
  });

  function splitTask(t, btn) {
    Promise.resolve(ai).then(function (sample) {
      btn.disabled = true; btn.textContent = "Thinking…";
      var prompt = "Break this task into 3 to 6 very small, concrete steps in English, for a person with ADHD. The first step must take under 2 minutes. Each step starts with a verb and has at most 8 words. Task: \"" + t.text.replace(/"/g, "'") + "\". Reply with only a JSON array of strings, e.g. [\"step 1\",\"step 2\"].";
      return sample.json(prompt, { modelTier: "quick" }).then(function (arr) {
        var steps = (Array.isArray(arr) ? arr : (arr && arr.steps) || []).filter(function (s) { return typeof s === "string" && s.trim(); }).slice(0, 6).map(function (s) { return { t: s.trim(), done: false }; });
        if (!steps.length) throw new Error("empty");
        return write(store.put(Object.assign({}, byId(t.id) || t, { steps: steps })));
      });
    }).catch(function (e) {
      toast(e && e.code === "not_granted" ? "Add your Anthropic API key with the AI key button at the bottom" : "AI did not respond, please try again");
      render();
    });
  }

  function onList(e) {
    var li = e.target.closest(".task"); if (!li) return;
    var t = byId(li.dataset.id); if (!t) return;
    var step = e.target.closest("[data-step]");
    if (step) {
      var steps = t.steps.map(function (s) { return Object.assign({}, s); });
      var i = +step.dataset.step; steps[i].done = !steps[i].done;
      if (steps[i].done) burst(step, true);
      write(store.put(Object.assign({}, t, { steps: steps })));
      return;
    }
    var b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "toggle") toggle(t, b);
    if (b.dataset.act === "del") write(store.remove(t.id));
    if (b.dataset.act === "split") splitTask(t, b);
  }
  $("openList").addEventListener("click", onList);
  $("doneList").addEventListener("click", onList);

  /* ---------- confetti ---------- */
  var cv = $("fx"), cx = cv.getContext("2d"), parts = [], raf = 0;
  var COLORS = ["#e6338f", "#ff8ac2", "#f97316", "#8b5cf6", "#0ea5c6", "#facc15"];
  function size() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
  addEventListener("resize", size); size();
  function burst(el, small) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var r = el.getBoundingClientRect(), x = (r.left + r.width / 2) * devicePixelRatio, y = (r.top + r.height / 2) * devicePixelRatio;
    var n = small ? 14 : 60;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (small ? 3 : 7) * (0.4 + Math.random()) * devicePixelRatio;
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4 * devicePixelRatio, w: (4 + Math.random() * 6) * devicePixelRatio, c: COLORS[i % COLORS.length], r: Math.random() * 6, life: 70 + Math.random() * 30 });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    cx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(function (p) { return p.life > 0; });
    parts.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.3 * devicePixelRatio; p.vx *= 0.99; p.r += 0.2; p.life--;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.globalAlpha = Math.min(1, p.life / 25); cx.fillStyle = p.c;
      cx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); cx.restore();
    });
    raf = parts.length ? requestAnimationFrame(tick) : 0;
    if (!raf) cx.clearRect(0, 0, cv.width, cv.height);
  }

  /* ---------- goals ---------- */
  function renderGoals() {
    var box = $("goalList"); box.innerHTML = "";
    goals.slice().sort(function (a, b) { return b.created - a.created; }).forEach(function (g) {
      var all = 0, done = 0;
      g.stages.forEach(function (st) { st.tasks.forEach(function (t) { all++; if (t.done) done++; }); });
      var pct = all ? Math.round(done / all * 100) : 0;
      var el = document.createElement("div"); el.className = "goal"; el.dataset.id = g.id;
      el.innerHTML = '<div class="goal-h"><h3>' + esc(g.title) + '</h3><button type="button" data-g="del">Delete goal</button></div>' +
        '<div class="bar" role="progressbar" aria-valuenow="' + pct + '" aria-label="Goal progress"><i style="width:' + pct + '%"></i></div>' +
        '<small class="note" style="text-align:left">' + done + " of " + all + " tasks (" + pct + "%)</small>" +
        g.stages.map(function (st, si) {
          var d = st.tasks.filter(function (t) { return t.done; }).length;
          return '<div class="stage"><h4><span class="l">Stage ' + (si + 1) + ": " + esc(stageName(st.name)) + '</span><span class="cnt">' + d + "/" + st.tasks.length + '</span><button type="button" class="x" data-g="delstage" data-s="' + si + '" aria-label="Delete stage ' + esc(stageName(st.name)) + '">✕</button></h4>' +
            st.tasks.map(function (t, ti) {
              return '<div class="gt' + (t.done ? " gdone" : "") + '"><button type="button" class="gc" role="checkbox" aria-checked="' + !!t.done +
                '" aria-label="' + esc(t.t) + '" data-s="' + si + '" data-t="' + ti + '" data-g="chk">' + (t.done ? "✓" : "") + "</button><span>" + esc(t.t) + "</span>" +
                (t.done ? "" : '<button type="button" class="today" data-s="' + si + '" data-t="' + ti + '" data-g="today"' + (t.sent ? " disabled" : "") + ">" + (t.sent ? "On Today" : "+ Today") + "</button>") +
                '<button type="button" class="x" data-s="' + si + '" data-t="' + ti + '" data-g="deltask" aria-label="Delete task ' + esc(t.t) + '">✕</button></div>';
            }).join("") +
            '<form class="inl" data-f="task" data-s="' + si + '"><input type="text" maxlength="100" autocomplete="off" placeholder="+ your own task in this stage" aria-label="Own task in stage ' + esc(stageName(st.name)) + '"><button type="submit">Add</button></form></div>';
        }).join("") +
        '<form class="inl" data-f="stage"><input type="text" maxlength="60" autocomplete="off" placeholder="+ new stage" aria-label="New stage"><button type="submit">Add stage</button></form>';
      box.appendChild(el);
    });
    $("goalEmpty").hidden = !!goals.length;
  }

  function normStages(v) {
    var arr = Array.isArray(v) ? v : (v && v.stages) || [];
    return arr.slice(0, 6).map(function (st) {
      var ts = (st && (st.tasks) || []).filter(function (x) { return typeof x === "string" && x.trim(); }).slice(0, 6);
      return { name: String((st && (st.name)) || "Stage").slice(0, 60), tasks: ts.map(function (x) { return { t: x.trim().slice(0, 100), done: false }; }) };
    }).filter(function (st) { return st.tasks.length; });
  }

  $("goalForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("goalText").value.trim();
    if (!v) { $("goalText").focus(); return; }
    var btn = $("goalBtn");
    Promise.resolve(ai).then(function (sample) {
      btn.disabled = true; btn.textContent = "Planning…";
      var prompt = "A person with ADHD wants to achieve this goal: \"" + v.replace(/"/g, "'") + "\". Plan the path in English: 3 to 5 stages from basics to the goal, each with 3 to 5 small, concrete tasks (each starts with a verb, at most 10 words, doable in 5 to 45 minutes). Give each stage a short name without a number. Reply with only JSON in this format: {\"stages\":[{\"name\":\"stage name\",\"tasks\":[\"task\"]}]}.";
      return sample.json(prompt, { modelTier: "default" }).then(function (r) {
        var stages = normStages(r);
        if (!stages.length) throw new Error("empty");
        $("goalText").value = "";
        return write(goalStore.put({ id: newId(), title: v, stages: stages, created: Date.now() }));
      });
    }).catch(function (err) {
      toast(err && err.code === "not_granted" ? "Add your Anthropic API key with the AI key button at the bottom" : "AI did not respond, please try again");
    }).then(function () { btn.disabled = false; btn.textContent = "Plan it ✨"; });
  });

  $("goalList").addEventListener("click", function (e) {
    var b = e.target.closest("[data-g]"); if (!b) return;
    var card = b.closest(".goal"); var g = goals.filter(function (x) { return x.id === card.dataset.id; })[0]; if (!g) return;
    if (b.dataset.g === "del") { write(goalStore.remove(g.id)); return; }
    var copy = JSON.parse(JSON.stringify(g)), st = copy.stages[+b.dataset.s], t = st && st.tasks[+b.dataset.t];
    if (b.dataset.g === "delstage") { copy.stages.splice(+b.dataset.s, 1); write(goalStore.put(copy)); return; }
    if (b.dataset.g === "deltask") { copy.stages[+b.dataset.s].tasks.splice(+b.dataset.t, 1); write(goalStore.put(copy)); return; }
    if (b.dataset.g === "chk") { t.done = !t.done; if (t.done) burst(b, true); }
    if (b.dataset.g === "today") {
      t.sent = true;
      write(store.put({ id: newId(), text: t.t, priority: 2, done: false, created: Date.now(), steps: [] }));
      toast("Added to Today");
    }
    write(goalStore.put(copy));
  });

  $("goalOwn").addEventListener("click", function () {
    var v = $("goalText").value.trim();
    if (!v) { toast("Type a goal name first"); $("goalText").focus(); return; }
    $("goalText").value = "";
    write(goalStore.put({ id: newId(), title: v, stages: [], created: Date.now() }));
  });

  $("goalPasteToggle").addEventListener("click", function () {
    var box = $("pasteBox"); box.hidden = !box.hidden;
    $("goalPasteToggle").setAttribute("aria-expanded", !box.hidden);
    if (!box.hidden) $("pasteText").focus();
  });
  function parsePlan(text) {
    var stages = [], cur = null;
    text.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim(); if (!line) return;
      var isStage = /^#+\s*/.test(line) || /^(stage|phase|etap|faza)\b/i.test(line) || /:\s*$/.test(line);
      if (isStage) {
        var name = line.replace(/^#+\s*/, "").replace(/:\s*$/, "").replace(/^(stage|phase|etap|faza)\s*\d*\s*[:.)\-–]?\s*/i, "").trim() || line;
        cur = { name: name.slice(0, 60), tasks: [] }; stages.push(cur);
      } else {
        var t = line.replace(/^([-*•–▪◦]|\d+[.)]|\[ ?\])\s*/, "").trim(); if (!t) return;
        if (!cur) { cur = { name: "Plan", tasks: [] }; stages.push(cur); }
        cur.tasks.push({ t: t.slice(0, 100), done: false });
      }
    });
    return stages;
  }
  $("pasteGo").addEventListener("click", function () {
    var stages = parsePlan($("pasteText").value);
    if (!stages.length) { toast("Paste a plan first"); $("pasteText").focus(); return; }
    var title = $("goalText").value.trim() || "My plan";
    write(goalStore.put({ id: newId(), title: title, stages: stages, created: Date.now() }));
    $("pasteText").value = ""; $("goalText").value = ""; $("pasteBox").hidden = true;
    $("goalPasteToggle").setAttribute("aria-expanded", "false");
    toast("Plan added");
  });

  $("goalList").addEventListener("submit", function (e) {
    var f = e.target.closest("form[data-f]"); if (!f) return;
    e.preventDefault();
    var v = f.querySelector("input").value.trim(); if (!v) return;
    var card = f.closest(".goal"); var g = goals.filter(function (x) { return x.id === card.dataset.id; })[0]; if (!g) return;
    var copy = JSON.parse(JSON.stringify(g));
    if (f.dataset.f === "stage") copy.stages.push({ name: v, tasks: [] });
    else copy.stages[+f.dataset.s].tasks.push({ t: v, done: false });
    write(goalStore.put(copy));
  });

  /* ---------- habits ---------- */
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var PRESETS = ["🇪🇸 Spanish", "🇬🇧 English", "💧 Drink water", "📖 Read", "🏃 Exercise", "🧘 Meditate"];
  $("chips").innerHTML = PRESETS.map(function (n) { return '<button type="button" data-preset="' + esc(n) + '">' + esc(n) + "</button>"; }).join("");

  function weekDates() {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    var mon = (d.getDay() + 6) % 7; d.setDate(d.getDate() - mon);
    var out = [];
    for (var i = 0; i < 7; i++) { out.push(dayKey(d.getTime())); d.setDate(d.getDate() + 1); }
    return out;
  }
  function habitStreak(days) {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    var n = 0;
    if (!days[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);
    while (days[dayKey(d.getTime())]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function renderHabits() {
    var box = $("habitList"); box.innerHTML = "";
    var wk = weekDates(), today = dayKey(Date.now());
    habits.slice().sort(function (a, b) { return a.created - b.created; }).forEach(function (h) {
      var days = h.days || {};
      var inWeek = wk.filter(function (k) { return days[k]; }).length;
      var total = Object.keys(days).length;
      var counts = [0, 0, 0, 0, 0, 0, 0];
      Object.keys(days).forEach(function (k) { var p = k.split("-"); counts[(new Date(+p[0], +p[1] - 1, +p[2]).getDay() + 6) % 7]++; });
      var best = Math.max.apply(null, counts);
      var bestTxt = best ? FULL[counts.indexOf(best)] : "no data yet";
      var done = !!days[today], st = habitStreak(days);
      var el = document.createElement("div"); el.className = "habit"; el.dataset.id = h.id;
      el.innerHTML = '<div class="goal-h"><h3>' + esc(h.name) + '</h3><button type="button" data-h="del">Delete</button></div>' +
        '<button type="button" class="sw" role="switch" aria-checked="' + done + '" data-h="today"><span class="knob">' + (done ? "✓" : "→") + "</span>" + (done ? "Done today!" : "Slide to mark done today") + "</button>" +
        '<div class="hmeta"><span>🔥 <b>' + st + "</b> " + (st === 1 ? "day" : "days") + " in a row</span><span><b>" + inWeek + "</b> of 7 this week</span></div>" +
        '<div class="bar" role="progressbar" aria-valuenow="' + Math.round(inWeek / 7 * 100) + '" aria-label="Week progress"><i style="width:' + Math.round(inWeek / 7 * 100) + '%"></i></div>' +
        '<div class="wk">' + wk.map(function (k, i) {
          return '<button type="button" class="wd' + (days[k] ? " on" : "") + (k === today ? " today" : "") + '" data-h="day" data-d="' + k + '" aria-pressed="' + !!days[k] + '" aria-label="' + FULL[i] + (days[k] ? ", done" : ", not done") + '"' + (k > today ? " disabled" : "") + "><i></i><span>" + DAYS[i] + "</span></button>";
        }).join("") + "</div>" +
        '<small class="note" style="text-align:left">' + total + " days done in total. Most often on: " + bestTxt + ". Tap a bar to fix a past day.</small>";
      box.appendChild(el);
    });
    $("habitEmpty").hidden = !!habits.length;
  }
  function addHabit(name) {
    name = name.trim(); if (!name) return;
    write(habitStore.put({ id: newId(), name: name.slice(0, 40), days: {}, created: Date.now() }));
  }
  $("habitForm").addEventListener("submit", function (e) { e.preventDefault(); addHabit($("habitText").value); $("habitText").value = ""; });
  $("chips").addEventListener("click", function (e) { var b = e.target.closest("[data-preset]"); if (b) addHabit(b.dataset.preset); });
  $("habitList").addEventListener("click", function (e) {
    var b = e.target.closest("[data-h]"); if (!b) return;
    var card = b.closest(".habit"); var h = habits.filter(function (x) { return x.id === card.dataset.id; })[0]; if (!h) return;
    if (b.dataset.h === "del") { write(habitStore.remove(h.id)); return; }
    var copy = JSON.parse(JSON.stringify(h)); copy.days = copy.days || {};
    var key = b.dataset.h === "today" ? dayKey(Date.now()) : b.dataset.d;
    if (copy.days[key]) delete copy.days[key]; else { copy.days[key] = true; burst(b, true); }
    write(habitStore.put(copy));
  });

  var TABS = { today: ["tabToday", "viewToday"], goals: ["tabGoals", "viewGoals"], habits: ["tabHabits", "viewHabits"] };
  function showTab(name) {
    Object.keys(TABS).forEach(function (k) {
      $(TABS[k][1]).hidden = k !== name;
      $(TABS[k][0]).setAttribute("aria-selected", k === name);
    });
  }
  $("tabToday").addEventListener("click", function () { showTab("today"); });
  $("tabGoals").addEventListener("click", function () { showTab("goals"); });
  $("tabHabits").addEventListener("click", function () { showTab("habits"); });

  /* ---------- quote of the day ---------- */
  var QUOTES = [
    ["The journey of a thousand miles begins with a single step.", "Lao Tzu"],
    ["We are what we repeatedly do. Excellence, then, is not an act, but a habit.", "Will Durant"],
    ["What you do today can improve all your tomorrows.", "Ralph Marston"],
    ["Do what you can, with what you have, where you are.", "Theodore Roosevelt"],
    ["It does not matter how slowly you go as long as you do not stop.", "Confucius"],
    ["It is not that we have a short time to live, but that we waste a lot of it.", "Seneca"],
    ["Don't watch the clock; do what it does. Keep going.", "Sam Levenson"],
    ["A year from now you may wish you had started today.", "Karen Lamb"],
    ["Small deeds done are better than great deeds planned.", "Peter Marshall"],
    ["Energy and persistence conquer all things.", "Benjamin Franklin"],
    ["I learned that courage was not the absence of fear, but the triumph over it.", "Nelson Mandela"],
    ["Start where you are. Use what you have. Do what you can.", "Arthur Ashe"],
    ["The only way to do great work is to love what you do.", "Steve Jobs"],
    ["Success is the sum of small efforts, repeated day in and day out.", "Robert Collier"],
    ["Nothing will work unless you do.", "Maya Angelou"],
    ["He who has a why to live can bear almost any how.", "Friedrich Nietzsche"],
    ["You don't have to be great to start, but you have to start to be great.", "Zig Ziglar"],
    ["The expert in anything was once a beginner.", "Helen Hayes"],
    ["Fall seven times, stand up eight.", "Japanese proverb"],
    ["Done is better than perfect.", "Sheryl Sandberg"],
    ["Do the hard jobs first. The easy jobs will take care of themselves.", "Dale Carnegie"],
    ["Focus on being productive instead of busy.", "Tim Ferriss"],
    ["Little by little, one travels far.", "J. R. R. Tolkien"],
    ["The future depends on what you do today.", "Mahatma Gandhi"],
    ["Well done is better than well said.", "Benjamin Franklin"],
    ["Perfect is the enemy of good.", "Voltaire"],
    ["You miss 100% of the shots you don't take.", "Wayne Gretzky"],
    ["You can't use up creativity. The more you use, the more you have.", "Maya Angelou"],
    ["Whether you think you can, or you think you can't, you're right.", "Henry Ford"],
    ["What we think, we become.", "Buddha"]
  ];
  (function () {
    var n = new Date(), day = Math.floor((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - Date.UTC(n.getFullYear(), 0, 0)) / 864e5);
    var q = QUOTES[day % QUOTES.length];
    $("quoteText").textContent = "\u201C" + q[0] + "\u201D";
    $("quoteBy").textContent = "\u2014 " + q[1];
  })();

  /* ---------- boot ---------- */
  var h = new Date().getHours();
  var greet = h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Hi" : "Good evening";
  $("hello").innerHTML = greet + "! What are we <em>doing</em> today?";
  $("date").textContent = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  function start(s, gs, hs) {
    store = s; goalStore = gs; habitStore = hs;
    $("note").textContent = s.local ? "Tasks are saved only in this browser (no account)." : "Your tasks are private and synced to your account.";
    s.subscribe(function (list) { tasks = list; render(); });
    gs.subscribe(function (list) { goals = list; renderGoals(); });
    hs.subscribe(function (list) { habits = list; renderHabits(); });
  }
  render(); renderGoals(); renderHabits();

  function startLocal() {
    $("auth").hidden = true; $("app").hidden = false;
    start(localStore("dailyfocus-tasks"), localStore("dailyfocus-goals"), localStore("dailyfocus-habits"));
  }

  /* each row belongs to one user; Postgres row-level security enforces it (see supabase/schema.sql) */
  function supaStore(client, table, uid) {
    var cache = [], subs = [];
    function emit() { subs.forEach(function (f) { f(cache.slice()); }); }
    function load() {
      return client.from(table).select("id,data").then(function (r) {
        if (r.error) { toast("Could not load your data"); return; }
        cache = r.data.map(function (row) { return Object.assign({}, row.data, { id: row.id }); });
        emit();
      });
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
    return {
      local: false,
      subscribe: function (f) { subs.push(f); f(cache.slice()); load(); },
      put: function (t) {
        var body = Object.assign({}, t); delete body.id;
        var i = cache.findIndex(function (x) { return x.id === t.id; });
        if (i >= 0) cache[i] = t; else cache.push(t);
        emit();
        return Promise.resolve(client.from(table).upsert({ user_id: uid, id: t.id, data: body }, { onConflict: "user_id,id" })).then(function (r) { if (r.error) throw r.error; });
      },
      remove: function (id) {
        cache = cache.filter(function (x) { return x.id !== id; }); emit();
        return Promise.resolve(client.from(table).delete().eq("id", id)).then(function (r) { if (r.error) throw r.error; });
      }
    };
  }

  /* ---------- AI: bring your own Anthropic key ---------- */
  var KEY_NAME = "dailyfocus-anthropic-key";
  function getKey() { try { return localStorage.getItem(KEY_NAME) || ""; } catch (e) { return ""; } }
  var ai = {
    json: function (prompt) {
      var key = getKey();
      if (!key) return Promise.reject({ code: "not_granted" });
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 1500, messages: [{ role: "user", content: prompt }] })
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw { code: "ai_error" };
          var text = (d.content && d.content[0] && d.content[0].text) || "";
          var m = text.match(/[\[{][\s\S]*[\]}]/);
          if (!m) throw { code: "ai_error" };
          return JSON.parse(m[0]);
        });
      });
    }
  };
  $("keyBtn").addEventListener("click", function () { $("keyInput").value = getKey(); $("keyDlg").showModal(); });
  $("keyForm").addEventListener("submit", function (e) {
    if (e.submitter && e.submitter.value === "save") {
      try { localStorage.setItem(KEY_NAME, $("keyInput").value.trim()); toast("AI key saved"); } catch (err) { toast("Could not save the key"); }
    }
  });
  $("keyClear").addEventListener("click", function () {
    try { localStorage.removeItem(KEY_NAME); } catch (e) {}
    $("keyInput").value = ""; toast("AI key removed");
  });

  /* ---------- boot: sign-in with Supabase when configured ---------- */
  var cfg = window.DAILY_FOCUS_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
    startLocal();
  } else {
    var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    var started = false;
    function showAuth() { $("app").hidden = true; $("auth").hidden = false; }
    function begin(session) {
      if (started) return; started = true;
      var uid = session.user.id;
      $("auth").hidden = true; $("app").hidden = false;
      $("who").textContent = session.user.email || "";
      $("outBtn").hidden = false;
      start(supaStore(client, "tasks", uid), supaStore(client, "goals", uid), supaStore(client, "habits", uid));
    }
    client.auth.getSession().then(function (r) { if (r.data.session) begin(r.data.session); else showAuth(); });
    client.auth.onAuthStateChange(function (ev, session) {
      if (ev === "SIGNED_IN" && session) begin(session);
      if (ev === "SIGNED_OUT") location.reload();
    });
    $("authForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = $("authBtn"); btn.disabled = true;
      client.auth.signInWithOtp({ email: $("authEmail").value.trim(), options: { emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
        $("authMsg").textContent = r.error ? "Could not send the link: " + r.error.message : "Check your email for the sign-in link.";
        btn.disabled = false;
      });
    });
    $("authLocal").addEventListener("click", startLocal);
    $("outBtn").addEventListener("click", function () { client.auth.signOut(); });
  }
})();
