const dns = require("dns").promises;

(async () => {
  console.log("SRV...");
  console.log(await dns.resolveSrv("_mongodb._tcp.r-v.3xt6hzx.mongodb.net"));

  console.log("TXT...");
  try {
    const txt = await Promise.race([
      dns.resolveTxt("r-v.3xt6hzx.mongodb.net"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout after 10s")), 10000)
      ),
    ]);
    console.log(txt);
  } catch (err) {
    console.error("TXT Error:", err);
  }

  console.log("Done");
})();