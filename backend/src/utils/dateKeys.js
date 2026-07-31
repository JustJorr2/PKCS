function getMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getPreviousMonthKey() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getAllowedMonthsForRole(role) {
  if (role === "worker") {
    const months = [];

    for (let i = 1; i <= 2; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      months.push(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      );
    }

    return new Set(months);
  }

  return new Set([
    getMonthKey(),
    getPreviousMonthKey()
  ]);
}

function getLastThreeMonths() {
  const months = [];
  for (let i = 0; i < 3; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
  }
  return new Set(months);
}

module.exports = {
  getMonthKey,
  getPreviousMonthKey,
  getAllowedMonthsForRole,
  getLastThreeMonths
};
