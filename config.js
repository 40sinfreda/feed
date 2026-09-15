window.FEED_DEFAULT_WEBAPP = "https://script.google.com/macros/s/AKfycbwgUIItkfrC0bHqju2PQbG35sFt2DVTEX-yjrVvYXFL-GneuWUKZBob5g0NnyFVC0CvhA/exec";
window.FEED_DEFAULT_TOKEN = "feed-2026-hadar";
(function () {
  var url = window.FEED_DEFAULT_WEBAPP;
  var token = window.FEED_DEFAULT_TOKEN;
  try {
    var cfg = JSON.parse(localStorage.getItem("feed_sheets_cfg") || "{}");
    if (!cfg.webAppUrl) cfg.webAppUrl = url;
    if (!cfg.token) cfg.token = token;
    localStorage.setItem("feed_sheets_cfg", JSON.stringify(cfg));
  } catch (e) {
    localStorage.setItem("feed_sheets_cfg", JSON.stringify({ webAppUrl: url, token: token }));
  }
})();
