// ============================================================
// Mobile Utilities — Viewport, Orientation Lock, Fullscreen
// ============================================================

/** True on touch-primary devices (phones / tablets) */
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(pointer: coarse)').matches
  );
}

/** Get true visible viewport dimensions (accounts for iOS/Android URL bar) */
export function getViewportSize(): { width: number; height: number } {
  const vv = window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return { width: vv.width, height: vv.height };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Returns true when screen is in portrait orientation on a phone/narrow viewport
 * (also triggers in browser DevTools mobile portrait emulator for easy testing).
 */
export function shouldPromptLandscape(): boolean {
  const { width, height } = getViewportSize();
  const isPortrait = height > width;
  if (!isPortrait) return false;
  return isTouchDevice() || width <= 900;
}

/** Check whether fullscreen is currently active */
export function isFullscreen(): boolean {
  const doc = document as Document & { webkitFullscreenElement?: Element };
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
}

/** Check whether Fullscreen API is supported on this browser */
export function supportsFullscreen(): boolean {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
}

/**
 * Request fullscreen and attempt to lock orientation to landscape.
 * Must be triggered from a user gesture (click / tap).
 */
export async function requestLandscapeFullscreen(): Promise<boolean> {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };

  try {
    if (!isFullscreen()) {
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    }
  } catch {
    // Fullscreen may be blocked (e.g., iOS Safari non-PWA) — continue gracefully
  }

  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (orientation?.lock) {
      await orientation.lock('landscape');
      return true;
    }
  } catch {
    // Orientation lock unsupported on iOS Safari — user rotates physically
  }

  return isFullscreen();
}

/** Toggle fullscreen mode cleanly */
export async function toggleFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
  };

  if (isFullscreen()) {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    } catch {
      /* ignore */
    }
  } else {
    await requestLandscapeFullscreen();
  }
}
