export { Detector, parseWindowsTasklist, parseUnixPgrep, COMMANDS, RESOLUME_PRODUCTS } from './detector';
export type { Platform, RunCommand, DetectorOptions, ResolumeProductId, ResolumeProduct } from './detector';
export { Presence, RECONNECT_DELAY_MS } from './presence';
export type {
  ActivityButton,
  ActivityDetails,
  ActivityPayload,
  DiscordRpcClient,
  DiscordRpcClientUser,
  PresenceStatus,
  PresenceOptions,
} from './presence';
export { CompositionWatcher, PUSH_POLL_DELAY_MS } from './composition-watcher';
export type {
  CompositionUpdate,
  CompositionWatcherOptions,
  CompositionSocket,
  CreateWebSocket,
  FetchImpl,
} from './composition-watcher';
export { PatchWatcher } from './patch-watcher';
export type { PatchUpdate, PatchWatcherOptions } from './patch-watcher';
