(() => {
  "use strict";
  const hostname = window.location.hostname;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  if (window.location.protocol === "http:" && !isLocalHost) {
    window.location.replace(`https:${window.location.href.slice(window.location.protocol.length)}`);
  }
})();
