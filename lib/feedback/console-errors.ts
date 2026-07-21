// F1 (build-queue.md): captures recent genuine JS errors for the feedback
// widget's diagnostic mini-report. Deliberately does NOT wrap
// console.error() wholesale and stringify its arguments — app code
// sometimes logs objects or strings alongside an error (e.g.
// `console.error("save failed", formValues)`), and capturing those would
// risk pulling exactly the form/note/student data this widget must never
// collect. Only an actual Error instance's own .name/.message (code-level
// text, never app data) is ever kept, from three sources: uncaught
// exceptions, unhandled promise rejections, and any console.error() call
// whose arguments happen to include a real Error object.

export interface FeedbackConsoleError {
  message: string;
  at: string;
}

const MAX_ERRORS = 5;
const MESSAGE_MAX_LENGTH = 300;

let errors: FeedbackConsoleError[] = [];
let installed = false;

function push(message: string) {
  errors = [...errors, { message: message.slice(0, MESSAGE_MAX_LENGTH), at: new Date().toISOString() }].slice(
    -MAX_ERRORS
  );
}

export function installFeedbackErrorCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    push(e.message || e.error?.message || "Unknown error");
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason as unknown;
    push(reason instanceof Error ? reason.message : "Unhandled promise rejection");
  });

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const err = args.find((a): a is Error => a instanceof Error);
    if (err) push(`${err.name}: ${err.message}`);
    originalConsoleError(...args);
  };
}

export function getFeedbackConsoleErrors(): FeedbackConsoleError[] {
  return errors;
}
