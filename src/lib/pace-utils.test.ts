import { paceToSeconds, formatPaceDisplay, formatDuration } from "./pace-utils";

describe("paceToSeconds", () => {
  it("parses plain M:SS", () => {
    expect(paceToSeconds("7:17")).toBe(437);
  });
  it("parses Strava-synced pace with /km suffix", () => {
    expect(paceToSeconds("7:17/km")).toBe(437);
    expect(paceToSeconds("4:38 /km")).toBe(278);
  });
  it("returns NaN for garbage", () => {
    expect(paceToSeconds("")).toBeNaN();
    expect(paceToSeconds("fast")).toBeNaN();
  });
});

describe("formatPaceDisplay", () => {
  it("always renders exactly one /km unit", () => {
    expect(formatPaceDisplay("7:17")).toBe("7:17/km");
    expect(formatPaceDisplay("7:17/km")).toBe("7:17/km");
  });
});

describe("formatDuration", () => {
  it("renders MM:SS under an hour", () => {
    expect(formatDuration(552)).toBe("9:12");
  });
});
