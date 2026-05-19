import { ApiError } from "../api/client";

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  let msg: string;
  if (error instanceof ApiError) {
    msg = error.code ? `[${error.code}] ${error.message}` : error.message;
  } else if (error instanceof Error) {
    msg = error.message;
  } else {
    msg = String(error);
  }
  return <div className="error">{msg}</div>;
}
