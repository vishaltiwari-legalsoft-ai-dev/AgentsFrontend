/** The deadline and cancellation behaviour of the API client's one choke point.
 *
 *  `requestPolicy.test.ts` proves the rules; this proves they are actually
 *  wired into `request()` — that a backend which never answers now ends in a
 *  rejection (so `finally { setBusy(false) }` runs) instead of a promise that
 *  stays pending for the life of the tab.
 *
 *  `fetch` is stubbed with a promise that only settles when its signal aborts,
 *  which is exactly how the browser behaves against a wedged server.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDbCollections,
  isAbortError,
  RequestTimeoutError,
  seoAnalyzeSite,
  seoBrandDetail,
  setUnauthorizedHandler,
} from "./api";
import { DEFAULT_TIMEOUT_MS, SLOW_TIMEOUT_MS } from "./requestPolicy";

/** A server that accepts the connection and then never answers. */
function stubHangingFetch() {
  const fetchMock = vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return; // no signal: hangs for ever, which is the old bug
        if (signal.aborted) reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        signal.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        );
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setUnauthorizedHandler(() => {});
});

describe("request deadlines", () => {
  it("ends a hung request as a timeout instead of pending for ever", async () => {
    vi.useFakeTimers();
    stubHangingFetch();

    const pending = getDbCollections();
    const settled = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS);
    await settled;
  });

  it("says how long it waited, so the toast is honest", async () => {
    vi.useFakeTimers();
    stubHangingFetch();

    const pending = seoBrandDetail("brand-1");
    const settled = expect(pending).rejects.toThrow(/90 seconds/);

    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS);
    await settled;
  });

  it("does not cut off a crawl that legitimately runs for minutes", async () => {
    vi.useFakeTimers();
    stubHangingFetch();

    const pending = seoAnalyzeSite("brand-1"); // POST /api/seo-geo/site-review/:id
    let rejected = false;
    void pending.catch(() => {
      rejected = true;
    });

    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS * 2);
    expect(rejected).toBe(false);

    const settled = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(SLOW_TIMEOUT_MS);
    await settled;
  });

  it("passes fetch the signal it never used to get", async () => {
    vi.useFakeTimers();
    const fetchMock = stubHangingFetch();

    const pending = getDbCollections();
    const settled = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS);
    await settled;
  });
});

describe("caller cancellation", () => {
  it("rejects a superseded request as an abort, not as a failure to show", async () => {
    stubHangingFetch();
    const controller = new AbortController();

    const pending = seoBrandDetail("brand-1", { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toSatisfy(isAbortError);
    await expect(pending).rejects.not.toBeInstanceOf(RequestTimeoutError);
  });
});

describe("responses that stall halfway", () => {
  it("times out a reply whose body never finishes arriving", async () => {
    vi.useFakeTimers();
    // Headers land immediately, then the body stream stops. The deadline has to
    // stay armed past the headers or this hangs exactly like the old client did.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => ({
        ok: true,
        status: 200,
        json: () =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
            );
          }),
      }) as unknown as Response),
    );

    const pending = getDbCollections();
    const settled = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS);
    await settled;
  });
});

describe("responses that do arrive", () => {
  it("still parses a normal reply and leaves no timer armed to abort it", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ collections: [], connected: true }), { status: 200 })),
    );

    await expect(getDbCollections()).resolves.toMatchObject({ connected: true });
    // Nothing left to fire: a stray timer would abort a request that is done.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("still reports an expired session rather than a timeout", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));

    await expect(getDbCollections()).rejects.toThrow(/sign in again/);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
