import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ERROR_STATUS, type ErrorCode, type FieldErrors } from "@/lib/api/envelope";

/** Throw from any service; the route wrapper turns it into the API envelope. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export const notFound = (what: string) => new ApiError("NOT_FOUND", `${what} not found.`);

export const conflict = (message: string, fields?: FieldErrors) =>
  new ApiError("CONFLICT", message, fields);

export const invalid = (message: string, fields?: FieldErrors) =>
  new ApiError("VALIDATION", message, fields);

export function fieldsFromZod(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Unique-violation columns, from either Prisma's classic or adapter metadata. */
function uniqueFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
      }
    | undefined;
  const target = meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields;
  return Array.isArray(target) ? target.filter((f): f is string => typeof f === "string") : [];
}

/** Any thrown value → an ApiError. Unknown errors become INTERNAL. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) {
    return invalid("Some fields need attention.", fieldsFromZod(error));
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const fields = Object.fromEntries(
        uniqueFields(error)
          .filter((f) => f !== "schoolId")
          .map((f) => [f, "Already in use."]),
      );
      return conflict("That record already exists.", fields);
    }
    if (error.code === "P2025") return notFound("Record");
  }
  return new ApiError("INTERNAL", "Something went wrong. Try again.");
}
