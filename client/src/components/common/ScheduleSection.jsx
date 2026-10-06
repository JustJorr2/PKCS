import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Maximize2, X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import schedule from "../../data/csSchedule.json";
import "../../styles/common/ScheduleSection.css";

const SLOT_RE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;

function readMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function currentSlotIndex(slots, nowMin) {
  return slots.findIndex((s) => {
    const m = SLOT_RE.exec(s.time);
    if (!m) return false;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const end = Number(m[3]) * 60 + Number(m[4]);
    return nowMin >= start && nowMin < end;
  });
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function Timeline({ group, nowMin, t }) {
  const nowIdx = currentSlotIndex(group.slots, nowMin);

  return (
    <ol className="sched-timeline">
      {group.slots.map((slot, i) => {
        const isNow = i === nowIdx;
        return (
          <li
            key={`${slot.time}-${i}`}
            className={`sched-slot${slot.kind === "break" ? " is-break" : ""}${isNow ? " is-now" : ""}`}
            aria-current={isNow ? "time" : undefined}
          >
            <div className="sched-time">
              <span>{slot.time}</span>
              {isNow && <span className="sched-now-pill">{t("schedule.now")}</span>}
            </div>
            <ul className="sched-tasks">
              {slot.tasks.map((task, j) => (
                <li key={j} className="sched-task">
                  <span className="sched-task-text">{task.text}</span>
                  {task.items && task.items.length > 0 && (
                    <ul className="sched-subtasks">
                      {task.items.map((item, k) => (
                        <li key={k}>{item}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function AreaBlock({
  area, grid, collapsible, open, onToggle, isOwn,
  pickedGroupId, onPickGroup, nowMin, t
}) {
  const groups = area.groups;
  const activeGroup = groups.find((g) => g.id === pickedGroupId) || groups[0];
  const showBody = !collapsible || open;

  return (
    <div className="sched-area">
      {collapsible ? (
        <button
          type="button"
          className="sched-area-head"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span className="sched-area-name">{area.id}</span>
          {isOwn && <span className="sched-own-pill">{t("schedule.myAreaBadge")}</span>}
          <ChevronDown size={18} className={`sched-chevron${open ? " is-open" : ""}`} aria-hidden="true" />
        </button>
      ) : (
        <h3 className="sched-area-title">{area.id}</h3>
      )}

      {showBody && (
        grid ? (
          <div className="sched-group-grid">
            {groups.map((g) => (
              <section key={g.id} className="sched-group-card">
                <h4 className="sched-group-title">{g.label}</h4>
                <Timeline group={g} nowMin={nowMin} t={t} />
              </section>
            ))}
          </div>
        ) : (
          <div className="sched-area-body">
            {groups.length > 1 && (
              <div className="sched-chips" role="group" aria-label={t("schedule.sections")}>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`sched-chip${g.id === activeGroup.id ? " is-active" : ""}`}
                    aria-pressed={g.id === activeGroup.id}
                    onClick={() => onPickGroup(g.id)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}
            {groups.length === 1 && <h4 className="sched-group-title">{activeGroup.label}</h4>}
            <Timeline group={activeGroup} nowMin={nowMin} t={t} />
          </div>
        )
      )}
    </div>
  );
}

/**
 * Work schedule for the Home pages.
 *
 * role: "worker" | "supervisor" | "admin"
 * area: the logged-in worker's area (worker.area). Ignored for other roles.
 */
export default function ScheduleSection({ role = "worker", area = null, variant = "section" }) {
  const { t } = useLanguage();
  const areas = schedule.areas;
  const isWorker = role === "worker";
  const ownArea = isWorker && areas.some((a) => a.id === area) ? area : null;

  const isPage = variant === "page";
  const wide = useMediaQuery("(min-width: 1000px)");
  const [selection, setSelection] = useState(ownArea ? "mine" : "all");
  const [touched, setTouched] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [openMap, setOpenMap] = useState({});
  const [groupPick, setGroupPick] = useState({});
  const [nowMin, setNowMin] = useState(readMinutes);

  // Side-by-side cards when expanded, or on a wide dedicated page.
  const showGrid = expanded || (isPage && wide);
  const Heading = isPage ? "h1" : "h2";

  const chooseSelection = (value) => {
    setTouched(true);
    setSelection(value);
  };

  // The worker's area can arrive after first render (fresh fetch on the page).
  // Until they pick a filter themselves, follow it.
  useEffect(() => {
    if (!touched) setSelection(ownArea ? "mine" : "all");
  }, [ownArea, touched]);

  // A worker whose area is missing can only see the whole schedule.
  const effectiveSelection = selection === "mine" && !ownArea ? "all" : selection;

  useEffect(() => {
    const id = setInterval(() => setNowMin(readMinutes()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const visibleAreas = useMemo(() => {
    if (effectiveSelection === "mine") return areas.filter((a) => a.id === ownArea);
    if (effectiveSelection === "all") {
      // Put a worker's own area first so it's the first thing they see.
      return ownArea
        ? [...areas].sort((a, b) => (a.id === ownArea ? -1 : b.id === ownArea ? 1 : 0))
        : areas;
    }
    return areas.filter((a) => a.id === effectiveSelection);
  }, [areas, effectiveSelection, ownArea]);

  const collapsible = visibleAreas.length > 1;
  const defaultOpenId = ownArea || areas[0]?.id;

  const toggleArea = (id) =>
    setOpenMap((prev) => ({ ...prev, [id]: !(prev[id] ?? id === defaultOpenId) }));

  return (
    <section className={`sched${isPage ? " sched--page" : ""}${expanded ? " sched--expanded" : ""}`} aria-labelledby="sched-heading">
      <div
        className="sched-panel"
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded ? "true" : undefined}
        aria-labelledby="sched-heading"
      >
        <div className="sched-head">
          <div className="sched-head-text">
            <Heading id="sched-heading">
              <CalendarDays size={20} aria-hidden="true" /> {t("schedule.title")}
            </Heading>
            <p>{t("schedule.subtitle")}</p>
          </div>
          <button
            type="button"
            className="sched-expand-btn"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? t("schedule.closeExpanded") : t("schedule.expand")}
          >
            {expanded ? <X size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            <span>{expanded ? t("schedule.closeExpanded") : t("schedule.expand")}</span>
          </button>
        </div>

        <div className="sched-toolbar">
          {isWorker ? (
            <div className="sched-segmented" role="group" aria-label={t("schedule.filterLabel")}>
              <button
                type="button"
                className={effectiveSelection === "mine" ? "is-active" : ""}
                aria-pressed={effectiveSelection === "mine"}
                disabled={!ownArea}
                onClick={() => chooseSelection("mine")}
              >
                {t("schedule.myArea")}{ownArea ? ` · ${ownArea}` : ""}
              </button>
              <button
                type="button"
                className={effectiveSelection === "all" ? "is-active" : ""}
                aria-pressed={effectiveSelection === "all"}
                onClick={() => chooseSelection("all")}
              >
                {t("schedule.wholeSchedule")}
              </button>
            </div>
          ) : (
            <label className="sched-select">
              <span>{t("common.area")}</span>
              <select value={effectiveSelection} onChange={(e) => chooseSelection(e.target.value)}>
                <option value="all">{t("schedule.wholeSchedule")}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.id}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {isWorker && !ownArea && <p className="sched-hint">{t("schedule.noAreaAssigned")}</p>}

        <div className="sched-body">
          {visibleAreas.length === 0 ? (
            <p className="sched-empty">{t("schedule.empty")}</p>
          ) : (
            visibleAreas.map((a) => (
              <AreaBlock
                key={a.id}
                area={a}
                grid={showGrid}
                collapsible={collapsible}
                open={openMap[a.id] ?? a.id === defaultOpenId}
                onToggle={() => toggleArea(a.id)}
                isOwn={a.id === ownArea}
                pickedGroupId={groupPick[a.id]}
                onPickGroup={(gid) => setGroupPick((prev) => ({ ...prev, [a.id]: gid }))}
                nowMin={nowMin}
                t={t}
              />
            ))
          )}
          <p className="sched-note">{t("schedule.note")}</p>
        </div>
      </div>
    </section>
  );
}