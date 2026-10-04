import { extensionForMime, pickRecorderMime } from "./sticker-video";

describe("recorder format choice", () => {
  it("prefers MP4 when the browser can write it", () => {
    expect(pickRecorderMime((m) => m.startsWith("video/mp4"))).toBe("video/mp4;codecs=avc1.42E01E");
    expect(pickRecorderMime((m) => m === "video/mp4")).toBe("video/mp4");
  });

  it("falls back to WebM, then gives up", () => {
    expect(pickRecorderMime((m) => m === "video/webm;codecs=vp9")).toBe("video/webm;codecs=vp9");
    expect(pickRecorderMime(() => false)).toBeNull();
  });

  it("names the file by container", () => {
    expect(extensionForMime("video/mp4;codecs=avc1.42E01E")).toBe("mp4");
    expect(extensionForMime("video/webm")).toBe("webm");
  });
});
