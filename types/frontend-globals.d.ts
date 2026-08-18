import type { FeatureCapabilities } from "./frontend-contracts.js";

declare global {
  interface NetworkInformation extends EventTarget {
    effectiveType?: string;
    saveData?: boolean;
    downlink?: number;
  }

  interface NavigatorUAData {
    mobile?: boolean;
    platform?: string;
  }

  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
    msDoNotTrack?: string | null;
    userAgentData?: NavigatorUAData;
    globalPrivacyControl?: boolean;
  }

  interface Window {
    __BARGIG_RELEASE_ID__?: string;
    __BARGIG_DISABLE_TELEMETRY__?: boolean;
    __BARGIG_ENABLE_TELEMETRY__?: boolean;
    __BARGIG_ENABLE_VITALS_DIAGNOSTICS__?: boolean;
    __BARGIG_WEB_VITALS__?: Record<string, unknown>;
    doNotTrack?: string | null;
  }

  interface Document {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
    webkitFullscreenEnabled?: boolean;
    mozFullScreenEnabled?: boolean;
    msFullscreenEnabled?: boolean;
    webkitExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  }

  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  }

  interface PerformanceEntry {
    type?: string;
    value?: number;
    hadRecentInput?: boolean;
  }

  interface PerformanceObserverInit {
    durationThreshold?: number;
  }

  const SEARCH_INDEX_SCRIPT_SRC: string;

  /** Test-only source export registry stripped from production bundles. */
  var __BARGIG_TEST_EXPORTS__: Record<string, unknown> | undefined;

  const __BARGIG_FEATURE_CAPABILITIES__: FeatureCapabilities;
}

export {};
