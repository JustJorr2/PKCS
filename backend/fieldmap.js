const FIELD_MAP = {
  worker: {
  en: "Worker",
  id: "Pekerja"
  },

  supervisor: {
  en: "Supervisor",
  id: "Supervisor"
  },

  ratedByType: {
  en: "Rated By Type",
  id: "Tipe Penilai"
  },

  month: {
  en: "Month",
  id: "Bulan"
  },

  average: {
  en: "Average",
  id: "Rata-rata"
  },

  workAreaCompliance: {
  en: "Work Area Compliance",
  id: "Kepatuhan Area Kerja"
  },

  taskCompletion: {
  en: "Task Completion",
  id: "Penyelesaian Tugas"
  },

  cleanliness: {
  en: "Cleanliness",
  id: "Kebersihan"
  },

  wasteManagement: {
  en: "Waste Management",
  id: "Pengelolaan Sampah"
  },

  organization: {
  en: "Organization",
  id: "Kerapihan"
  },

  uniformCompliance: {
  en: "Uniform Compliance",
  id: "Kepatuhan Seragam"
  },

  independence: {
  en: "Independence",
  id: "Kemandirian"
  },

  initiative: {
  en: "Initiative",
  id: "Inisiatif"
  },

  teamworkSupport: {
  en: "Teamwork Support",
  id: "Kerja Sama Tim"
  },

  punctuality: {
  en: "Punctuality",
  id: "Ketepatan Waktu"
  },

  attendance: {
  en: "Attendance",
  id: "Kehadiran"
  },

  leaveOnTime: {
  en: "Leave Work On Time",
  id: "Pulang Sesuai Jam Kerja"
  }
};


// Reverse map (for import)
const REVERSE_MAP = {};
Object.entries(FIELD_MAP).forEach(([key, val]) => {
  REVERSE_MAP[val.en] = key;
  REVERSE_MAP[val.id] = key;
});

module.exports = { FIELD_MAP, REVERSE_MAP };