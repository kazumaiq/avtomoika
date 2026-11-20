import { soundEngine } from '../audio/soundEngine';

export interface YandexGamesSDK {
  adv: {
    showFullscreenAdv: (params: {
      callbacks: {
        onOpen?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (error: unknown) => void;
        onOffline?: () => void;
      };
    }) => void;
    showRewardedVideo: (params: {
      callbacks: {
        onOpen?: () => void;
        onRewarded?: () => void;
        onClose?: () => void;
        onError?: (error: unknown) => void;
      };
    }) => void;
    showBannerAdv?: () => Promise<{ stickyAdvIsShowing: boolean; reason?: string }>;
    hideBannerAdv?: () => Promise<{ stickyAdvIsShowing: boolean }>;
  };
  features?: {
    LoadingAPI?: {
      ready: () => void;
    };
    GameplayAPI?: {
      start: () => void;
      stop: () => void;
    };
  };
  environment?: {
    i18n?: {
      lang?: string;
    };
  };
}

declare global {
  interface Window {
    YaGames?: {
      init: () => Promise<YandexGamesSDK>;
    };
    ysdk?: YandexGamesSDK;
  }
}

export type AdPlacementType = 'rewarded' | 'fullscreen';

export interface SimulatedAdState {
  active: boolean;
  kind: AdPlacementType;
  title: string;
  rewardLabel: string;
  secondsLeft: number;
  totalSeconds: number;
  canClaim: boolean;
}

type SimAdListener = (state: SimulatedAdState | null) => void;

class YandexAdService {
  private ysdk: YandexGamesSDK | null = null;
  private initialized = false;
  private lastFullscreenAt = 0;
  private simState: SimulatedAdState | null = null;
  private simListeners = new Set<SimAdListener>();
  private simTimer: number | null = null;
  private simResolve: ((rewarded: boolean) => void) | null = null;
  private wasMutedBeforeAd = false;

  /**
   * Initializes Yandex Games SDK if running inside Yandex Games iframe,
   * or falls back cleanly to built-in interactive ad simulator for standalone/local testing.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window === 'undefined') return;

    // 1. Check if YaGames is already injected or loadable
    try {
      if (window.YaGames && typeof window.YaGames.init === 'function') {
        this.ysdk = await window.YaGames.init();
        window.ysdk = this.ysdk;
        this.ysdk.features?.LoadingAPI?.ready?.();
        return;
      }
    } catch (err) {
      console.warn('[AdService] YaGames.init fallback to simulator:', err);
    }
  }

  isNativeYandexSdk(): boolean {
    return this.ysdk !== null;
  }

  notifyGameplayStart(): void {
    try {
      this.ysdk?.features?.GameplayAPI?.start?.();
    } catch {
      // ignore
    }
  }

  notifyGameplayStop(): void {
    try {
      this.ysdk?.features?.GameplayAPI?.stop?.();
    } catch {
      // ignore
    }
  }

  subscribeSimAd(listener: SimAdListener): () => void {
    this.simListeners.add(listener);
    listener(this.simState);
    return () => {
      this.simListeners.delete(listener);
    };
  }

  private emitSimState(): void {
    for (const l of this.simListeners) {
      l(this.simState ? { ...this.simState } : null);
    }
  }

  private pauseAudioAndGame(onPauseGame: (paused: boolean) => void): void {
    this.wasMutedBeforeAd = soundEngine.isMuted();
    soundEngine.setMuted(true);
    this.notifyGameplayStop();
    onPauseGame(true);
  }

  private resumeAudioAndGame(onPauseGame: (paused: boolean) => void): void {
    if (!this.wasMutedBeforeAd) {
      soundEngine.setMuted(false);
    }
    onPauseGame(false);
    this.notifyGameplayStart();
  }

  /**
   * Shows a Rewarded Video Ad (via Yandex Games SDK `ysdk.adv.showRewardedVideo` or built-in 3s simulator).
   * Resolves to `true` only if the user watched the ad to completion.
   */
  showRewardedVideo(params: {
    title: string;
    rewardLabel: string;
    onPauseGame: (paused: boolean) => void;
  }): Promise<boolean> {
    if (this.ysdk?.adv?.showRewardedVideo) {
      return new Promise<boolean>((resolve) => {
        let rewarded = false;
        this.ysdk!.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => {
              this.pauseAudioAndGame(params.onPauseGame);
            },
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => {
              this.resumeAudioAndGame(params.onPauseGame);
              resolve(rewarded);
            },
            onError: () => {
              this.resumeAudioAndGame(params.onPauseGame);
              resolve(false);
            },
          },
        });
      });
    }

    // Fallback interactive Rewarded Video simulator (3 seconds)
    return this.runSimulatedAd({
      kind: 'rewarded',
      title: params.title,
      rewardLabel: params.rewardLabel,
      durationSec: 3,
      onPauseGame: params.onPauseGame,
    });
  }

  /**
   * Shows an Interstitial / Fullscreen Ad between shifts (respects 120s frequency cooldown).
   */
  showFullscreenAd(params: {
    title?: string;
    onPauseGame: (paused: boolean) => void;
  }): Promise<boolean> {
    const now = Date.now();
    // Respect Yandex Games recommendation: at least 90-120s between fullscreen interstitials
    if (now - this.lastFullscreenAt < 95_000) {
      return Promise.resolve(false);
    }
    this.lastFullscreenAt = now;

    if (this.ysdk?.adv?.showFullscreenAdv) {
      return new Promise<boolean>((resolve) => {
        this.pauseAudioAndGame(params.onPauseGame);
        this.ysdk!.adv.showFullscreenAdv({
          callbacks: {
            onOpen: () => {
              // already paused
            },
            onClose: (wasShown) => {
              this.resumeAudioAndGame(params.onPauseGame);
              resolve(Boolean(wasShown));
            },
            onError: () => {
              this.resumeAudioAndGame(params.onPauseGame);
              resolve(false);
            },
            onOffline: () => {
              this.resumeAudioAndGame(params.onPauseGame);
              resolve(false);
            },
          },
        });
      });
    }

    // In standalone mode, show a quick 2-second non-intrusive interstitial break every 2nd shift
    return this.runSimulatedAd({
      kind: 'fullscreen',
      title: params.title ?? 'Межсменная рекламная пауза',
      rewardLabel: 'Переход к следующему рабочему дню',
      durationSec: 2,
      onPauseGame: params.onPauseGame,
    });
  }

  private runSimulatedAd(params: {
    kind: AdPlacementType;
    title: string;
    rewardLabel: string;
    durationSec: number;
    onPauseGame: (paused: boolean) => void;
  }): Promise<boolean> {
    if (this.simTimer !== null) {
      window.clearInterval(this.simTimer);
      this.simTimer = null;
    }

    this.pauseAudioAndGame(params.onPauseGame);

    return new Promise<boolean>((resolve) => {
      this.simResolve = (rewarded: boolean) => {
        this.resumeAudioAndGame(params.onPauseGame);
        resolve(rewarded);
      };

      this.simState = {
        active: true,
        kind: params.kind,
        title: params.title,
        rewardLabel: params.rewardLabel,
        secondsLeft: params.durationSec,
        totalSeconds: params.durationSec,
        canClaim: false,
      };
      this.emitSimState();

      this.simTimer = window.setInterval(() => {
        if (!this.simState) return;
        const nextSec = Math.max(0, this.simState.secondsLeft - 1);
        this.simState = {
          ...this.simState,
          secondsLeft: nextSec,
          canClaim: nextSec === 0,
        };
        this.emitSimState();

        if (nextSec === 0) {
          if (this.simTimer !== null) {
            window.clearInterval(this.simTimer);
            this.simTimer = null;
          }
          // Auto-close fullscreen interstitial immediately when timer hits 0
          if (params.kind === 'fullscreen') {
            window.setTimeout(() => this.completeSimulatedAd(true), 300);
          }
        }
      }, 1000);
    });
  }

  completeSimulatedAd(claimReward: boolean): void {
    if (this.simTimer !== null) {
      window.clearInterval(this.simTimer);
      this.simTimer = null;
    }
    const canReward = claimReward && (this.simState?.canClaim ?? false);
    this.simState = null;
    this.emitSimState();
    const res = this.simResolve;
    this.simResolve = null;
    if (res) {
      res(canReward);
    }
  }
}

export const adService = new YandexAdService();
