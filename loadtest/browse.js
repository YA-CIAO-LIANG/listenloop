// k6 load test (D133): people browsing and opening practices, signed out
// and signed in, against a local production build with the stand-in
// Supabase and fake AI providers (never the real database).
//
//   VUS=100 k6 run loadtest/browse.js      (or: npm run loadtest -- 100)
//
// Each virtual user opens the home page, a video's page, its day 1
// practice, the learning hub, and the public materials, pausing 1–3 s
// like a person, for DURATION (default 60 s).
import http from "k6/http";
import { check, sleep } from "k6";
import encoding from "k6/encoding";
import { Trend } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://localhost:3300";
const VUS = Number(__ENV.VUS || 100);
const DURATION = __ENV.DURATION || "60s";

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: VUS },
        { duration: DURATION, target: VUS },
        { duration: "5s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const pages = {
  home: new Trend("page_home", true),
  video: new Trend("page_video", true),
  practice: new Trend("page_practice", true),
  learn: new Trend("page_learn", true),
  explore: new Trend("page_explore", true),
};

/** A signed-in session the stand-in accepts, like e2e/fixtures.ts. */
function sessionCookie(id) {
  const b64 = (value) => encoding.b64encode(JSON.stringify(value), "rawurl");
  const email = `${id}@example.com`;
  const exp = 4102444800; // 2100
  const token = [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({ sub: id, email, aud: "authenticated", role: "authenticated", exp }),
    b64("signature"),
  ].join(".");
  return `base64-${b64({
    access_token: token,
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user: { id, email, aud: "authenticated", role: "authenticated" },
  })}`;
}

function open(name, path, params) {
  const response = http.get(`${BASE}${path}`, {
    ...params,
    tags: { page: name },
    redirects: 0,
  });
  pages[name].add(response.timings.duration);
  check(response, { [`${name} 200`]: (r) => r.status === 200 });
  sleep(1 + Math.random() * 2);
}

export default function browse() {
  // A third of the visitors are signed in.
  const signedIn = __VU % 3 === 0;
  const params = signedIn
    ? { cookies: { "sb-localhost-auth-token": sessionCookie(`load-${__VU}`) } }
    : {};
  open("home", "/", params);
  open("video", "/videos/sintel", params);
  open("practice", "/videos/sintel/day/1", params);
  open("learn", "/learn", params);
  open("explore", "/explore", params);
}
