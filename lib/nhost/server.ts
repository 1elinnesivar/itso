import { createServerClient } from "@nhost/nhost-js";
import { DEFAULT_SESSION_KEY, type StoredSession } from "@nhost/nhost-js/session";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { getNhostEnv } from "./env";

function parseSession(value?: string): StoredSession | null {
  if (!value) return null;
  try { return JSON.parse(value) as StoredSession; } catch {}
  try { return JSON.parse(decodeURIComponent(value)) as StoredSession; } catch { return null; }
}

export async function createNhostServerClient() {
  const store = await cookies();
  return createServerClient({
    ...getNhostEnv(),
    storage: {
      get: () => {
        return parseSession(store.get(DEFAULT_SESSION_KEY)?.value);
      },
      set: (session) => {
        try { store.set(DEFAULT_SESSION_KEY, JSON.stringify(session)); } catch {}
      },
      remove: () => {
        try { store.delete(DEFAULT_SESSION_KEY); } catch {}
      },
    },
  });
}

export async function refreshNhostSession(request: NextRequest, response: NextResponse) {
  const client = createServerClient({
    ...getNhostEnv(),
    storage: {
      get: () => {
        return parseSession(request.cookies.get(DEFAULT_SESSION_KEY)?.value);
      },
      set: (session) => response.cookies.set(DEFAULT_SESSION_KEY, JSON.stringify(session), {
        path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30,
      }),
      remove: () => response.cookies.delete(DEFAULT_SESSION_KEY),
    },
  });
  try {
    return await client.refreshSession(60);
  } catch {
    response.cookies.delete(DEFAULT_SESSION_KEY);
    return null;
  }
}
