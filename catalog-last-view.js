(function () {
  const BASE_STORAGE_KEY = "bargig:last-catalog-view:v1";

  function getSiteScope() {
    const path = String(window.location?.pathname || "/")
      .replace(/\/(?:index|catalog)\.html$/i, "/")
      .replace(/\/+/g, "/")
      .replace(/\/$/, "");
    return path || "/";
  }

  function storageKey() {
    return `${BASE_STORAGE_KEY}:${getSiteScope()}`;
  }

  function clampPage(page, catalog) {
    const parsed = Number.parseInt(page, 10);
    if (!Number.isFinite(parsed)) return 1;
    const maxPage = Math.max(1, Number(catalog?.pages || 1));
    return Math.min(Math.max(parsed, 1), maxPage);
  }

  function findCatalog(catalogs, id) {
    if (!Array.isArray(catalogs) || !id) return null;
    return catalogs.find((catalog) => catalog?.id === id) || null;
  }

  function normalizeRecord(catalogs, rawRecord) {
    if (!rawRecord || typeof rawRecord !== "object") return null;
    const catalogId = String(rawRecord.catalogId || "").trim();
    const catalog = findCatalog(catalogs, catalogId);
    if (!catalog) return null;

    return {
      catalogId,
      catalog,
      page: clampPage(rawRecord.page, catalog),
      viewerMode: rawRecord.viewerMode === "scroll" ? "scroll" : "single",
      updatedAt: Number(rawRecord.updatedAt || 0) || Date.now()
    };
  }

  function read(catalogs) {
    try {
      const value = window.localStorage?.getItem(storageKey());
      if (!value) return null;
      return normalizeRecord(catalogs, JSON.parse(value));
    } catch (_error) {
      return null;
    }
  }

  function save(catalogs, nextRecord) {
    const record = normalizeRecord(catalogs, {
      catalogId: nextRecord?.catalogId,
      page: nextRecord?.page,
      viewerMode: nextRecord?.viewerMode,
      updatedAt: nextRecord?.updatedAt || Date.now()
    });

    if (!record) return null;

    try {
      window.localStorage?.setItem(storageKey(), JSON.stringify({
        catalogId: record.catalogId,
        page: record.page,
        viewerMode: record.viewerMode,
        updatedAt: record.updatedAt
      }));
    } catch (_error) {
      return null;
    }

    return record;
  }

  function formatTime(updatedAt) {
    const date = new Date(updatedAt);
    if (!Number.isFinite(date.getTime())) return "";

    const now = new Date();
    const dateKey = (value) => [value.getFullYear(), value.getMonth(), value.getDate()].join("-");
    const time = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(date);

    if (dateKey(date) === dateKey(now)) return `נשמר היום ב־${time}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (dateKey(date) === dateKey(yesterday)) return `נשמר אתמול ב־${time}`;

    const formattedDate = new Intl.DateTimeFormat("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
    return `נשמר ב־${formattedDate} בשעה ${time}`;
  }

  function formatLocation(record) {
    if (!record?.catalog) return "";
    const totalPages = Math.max(1, Number(record.catalog.pages || 1));
    return `${record.catalog.title || "קטלוג"} · עמוד ${record.page} מתוך ${totalPages}`;
  }

  window.BargigLastView = {
    read,
    save,
    formatLocation,
    formatTime
  };
}());
