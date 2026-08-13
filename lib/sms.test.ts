import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { classifySmsKeyword, verifyTwilioSignature } from "@/lib/sms";

describe("classifySmsKeyword", () => {
  it("recognizes the carrier-standard opt-out words", () => {
    for (const word of ["STOP", "stop", " Stop ", "UNSUBSCRIBE", "cancel", "QUIT", "end", "stopall"]) {
      expect(classifySmsKeyword(word)).toBe("stop");
    }
  });

  it("recognizes opt-in words", () => {
    for (const word of ["START", "start", "unstop", "YES"]) {
      expect(classifySmsKeyword(word)).toBe("start");
    }
  });

  it("strips punctuation carriers and keyboards add", () => {
    expect(classifySmsKeyword("STOP.")).toBe("stop");
    expect(classifySmsKeyword("stop!")).toBe("stop");
  });

  // The whole point of matching the full body rather than searching for the
  // substring: a sentence containing "stop" is a message, not an opt-out.
  // Getting this wrong silently unsubscribes people who were replying.
  it("does not treat a sentence containing a keyword as a command", () => {
    expect(classifySmsKeyword("please don't stop sending these")).toBeNull();
    expect(classifySmsKeyword("can we start at 5 instead?")).toBeNull();
    expect(classifySmsKeyword("thanks!")).toBeNull();
    expect(classifySmsKeyword("")).toBeNull();
  });
});

describe("verifyTwilioSignature", () => {
  const authToken = "test_auth_token";
  const url = "https://example.com/api/webhooks/twilio";
  const params = { From: "+15551234567", Body: "STOP", MessageSid: "SM123" };

  function sign(signedUrl: string, signedParams: Record<string, string>, token: string): string {
    const payload = Object.keys(signedParams)
      .sort()
      .reduce((acc, key) => acc + key + signedParams[key], signedUrl);
    return crypto.createHmac("sha1", token).update(Buffer.from(payload, "utf-8")).digest("base64");
  }

  it("accepts a correctly signed request", () => {
    expect(verifyTwilioSignature(url, params, sign(url, params, authToken), authToken)).toBe(true);
  });

  it("rejects a signature made with the wrong auth token", () => {
    expect(verifyTwilioSignature(url, params, sign(url, params, "wrong_token"), authToken)).toBe(false);
  });

  it("rejects when a parameter was tampered with in transit", () => {
    const signature = sign(url, params, authToken);
    const tampered = { ...params, From: "+15559999999" };
    expect(verifyTwilioSignature(url, tampered, signature, authToken)).toBe(false);
  });

  it("rejects when the URL does not match the one Twilio signed", () => {
    const signature = sign(url, params, authToken);
    expect(verifyTwilioSignature("https://evil.example/api/webhooks/twilio", params, signature, authToken)).toBe(false);
  });

  // timingSafeEqual throws on a length mismatch instead of returning false,
  // so a garbage signature has to be length-checked before comparison or the
  // route 500s instead of cleanly rejecting.
  it("rejects a malformed signature without throwing", () => {
    expect(() => verifyTwilioSignature(url, params, "short", authToken)).not.toThrow();
    expect(verifyTwilioSignature(url, params, "short", authToken)).toBe(false);
    expect(verifyTwilioSignature(url, params, "", authToken)).toBe(false);
  });

  it("is order-independent across parameters", () => {
    const reordered = { MessageSid: "SM123", Body: "STOP", From: "+15551234567" };
    expect(verifyTwilioSignature(url, reordered, sign(url, params, authToken), authToken)).toBe(true);
  });
});
