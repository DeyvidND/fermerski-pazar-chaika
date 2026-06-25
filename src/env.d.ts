// Wire Astro's App.Locals to the Cloudflare adapter's Runtime so
// `ctx.locals.runtime.{ctx,caches,env}` is typed in middleware.ts.
// Runtime<T> is generic with default `object`; we use the default form.
type CFRuntime = import('@astrojs/cloudflare').Runtime;

declare namespace App {
  interface Locals extends CFRuntime {}
}

// Minimal structural shapes used by src/lib/api.ts.
interface SwrExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
interface SwrCache {
  match(request: Request | string): Promise<Response | undefined>;
  put(request: Request | string, response: Response): Promise<void>;
  delete(request: Request | string): Promise<boolean>;
}
interface SwrCacheStorage {
  readonly default: SwrCache;
  open(cacheName: string): Promise<SwrCache>;
}
