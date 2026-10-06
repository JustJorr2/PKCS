import { useEffect, useState } from "react";
import { usersService } from "../services/api";
import ScheduleSection from "../components/common/ScheduleSection";

/**
 * Shared Schedule page for every role.
 * The role comes from the logged-in user; only workers use an area.
 */
function SchedulePage({ worker }) {
  const [area, setArea] = useState(worker?.area ?? null);

  // The area is saved in localStorage at login, so it goes stale when an
  // admin assigns or changes it afterwards. Re-read it for workers.
  useEffect(() => {
    if (worker?.role !== "worker" || !worker?._id) return undefined;
    let active = true;

    usersService
      .getUserById(worker._id)
      .then((res) => {
        if (active) setArea(res.data?.worker?.area ?? null);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [worker?._id, worker?.role]);

  return (
    <div className="page-content">
      <ScheduleSection variant="page" role={worker?.role} area={area} />
    </div>
  );
}

export default SchedulePage;