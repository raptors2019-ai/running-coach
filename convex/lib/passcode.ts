/**
 * The app is public with no login, so anything that spends money (Anthropic
 * calls) or writes uploaded files is gated behind one shared passcode.
 */
export function checkPasscode(passcode: string) {
  const expected = process.env.COACH_PASSCODE ?? "Oakville5k";
  if (passcode !== expected) throw new Error("Wrong passcode");
}
