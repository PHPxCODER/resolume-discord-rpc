export { Detector, parseWindowsTasklist, parseUnixPgrep, COMMANDS, RESOLUME_PRODUCTS } from './detector';
export type { Platform, RunCommand, DetectorOptions, ResolumeProductId, ResolumeProduct } from './detector';
export { Presence, RECONNECT_DELAY_MS } from './presence';
export type {
  ActivityDetails,
  ActivityPayload,
  DiscordRpcClient,
  DiscordRpcClientUser,
  PresenceStatus,
  PresenceOptions,
} from './presence';
export { CompositionWatcher } from './composition-watcher';
export type { CompositionUpdate, CompositionWatcherOptions, FetchImpl } from './composition-watcher';
